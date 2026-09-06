# 33. 未追踪代码块安全丢弃、Windows 盘符归一化与网络探活连接池治理

## 1. 知识点与问题背景 (Context & Problem Statement)

在 Tcode Studio 原生桌面微内核迭代到版本 2.0.0 的高并发系统巡检与真实工业开发测试中，暴露出三大系统级边界缺陷：
1. **未追踪文件（Untracked Files）行级 Diff 丢弃引发 Git 报错**：在 Monaco Diff 视图中，用户新增的代码文件在未执行 git add 之前属于 untracked 状态。当用户点击“放弃此改动”时，微内核执行 git apply --reverse 试图逆向应用补丁，但因该文件在 Git Index 中不存在而报错 error: <file>: does not exist in index，导致前端放弃改动操作失效。
2. **Windows 盘符大小写差异导致沙箱逃逸误判**：Windows 文件系统对大小写不敏感，但 Go 标准库的 filepath.Rel 严格按字符比对。当传入的工作区路径包含小写盘符（如 d:\...）而绝对路径规范化为大写盘符（如 D:\...）时，filepath.Rel 计算失败并报错 path escapes workspace sandbox，造成 LSP 编译器诊断与 AST 拓扑扫描被安全沙箱机制误杀。
3. **本地开发服务探活 TLS 握手失败与 Socket 泄漏**：在网络探活工具 pinger 中，系统对不带 scheme 的 URL 无脑自动添加 https:// 前缀。当开发者配置本地 Ollama 实例（如 localhost:11434）或局域网私有网关时，强制 HTTPS 导致 TLS 握手失败；且每次探测实例化独立 http.Transport，未开启连接池长连接复用，极易造成 Windows 临时端口耗尽。

---

## 2. 核心原理与知识内容 (Knowledge Content & Root Cause)

### 2.1 Git Apply 逆向补丁与未追踪状态物理对齐
- git apply --reverse 的工作原理是基于当前索引或工作区上下文回退改动。对于全量新增的未追踪文件（补丁头为 --- /dev/null），Git 无法在索引中找到基准文件，因此命令必定非零退出。
- **治理法则**：当检测到补丁源自 --- /dev/null（即未追踪新增文件）且 git apply --reverse 失败时，必须在工作区沙箱合法性校验通过的前提下，安全回退为物理文件删除（os.Remove），确保代码树与用户操作语义严格一致。

### 2.2 Windows 卷标驱动器盘符大小写归一化
- Windows API 与系统环境对卷标盘符大小写（如 C: vs c:）视为同一驱动器，但在跨平台文件路径计算中，Go 的 filepath.Rel(base, target) 使用简单的字符串前缀算法。若 base 为 D:\project 而 target 为 d:\project\file.go，Go 会认为两者位于不同驱动器分支，返回计算错误。
- **治理法则**：在所有涉及 filepath.Rel 边界校验的核心模块（如 lsp/diagnostics.go、ast/scanner.go、diff/differ.go、git_tool.go）中，统一引入 normalizeWindowsPath，在调用 filepath.Rel 之前将卷标统一归一化为大写字符（strings.ToUpper(vol) + p[len(vol):]）。

### 2.3 HTTP 连接池长连接复用与本地回环探测
- 在高性能桌面应用中，频繁发起网络测速探测若每次重新创建 http.Transport，将导致频繁的 TCP 握手与 TLS 协商，在快速切换与轮询下导致大量处于 TIME_WAIT 的套接字堆积。
- **治理法则**：构建包级单例 defaultTransport 与 defaultClient，设置 MaxIdleConns: 100、MaxIdleConnsPerHost: 20，并在响应处理完成后使用 io.Copy(io.Discard, io.LimitReader(resp.Body, 4096)) 排空 Body，以确保底层 TCP 连接能够安全归还连接池。同时，针对 localhost、127.0.0.1、0.0.0.0、[::1] 等本地回环地址智能补充 http:// 而非 https://，确保本地轻量服务正常探活。

---

## 3. 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 3.1 Differ 与 Git 算子未追踪还原安全回退
在 internal/diff/differ.go 与 plugins/tool/git/git_tool.go 中，重构丢弃与还原逻辑：
- 在 DiscardHunkPatch 中捕获 git apply --reverse 失败，若补丁以 --- /dev/null 开头，则校验路径合法性后回退执行 os.Remove(absPath)；
- 在 git_tool.go 的 RestoreFile 中引入路径有效性校验与沙箱内未追踪文件安全清理回退。

### 3.2 编译器诊断与 AST 扫描器盘符归一化
在 internal/lsp/diagnostics.go 与 internal/ast/scanner.go 中：
- 增加 normalizeWindowsPath 工具函数；
- 在 DiagnoseFile 与 ScanWorkspaceAST 中先将根目录与目标路径归一化后再执行 filepath.Rel；
- 在 ast/scanner.go 的 filepath.Walk 回调首行增加 if info == nil { return nil } 防御，规避底层文件读取异常导致的空指针解引用。

### 3.3 网络探活长连接池与本地协议自适应
在 internal/network/pinger.go 中：
- 声明包级共享的 defaultTransport 与 defaultClient；
- 探测 URL 协议补齐时优先识别本地回环：针对 localhost、127.0.0.1 等补齐 http://，针对公网渠道补齐 https://；
- 探测完成后通过 LimitReader 浅读排空 Body，支持连接池长连接复用。

---

## 4. 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **绝对禁止依赖单纯的 git apply 处理 untracked 文件**：Git 本身将未追踪文件视为主机工作区物理残留，必须在应用层提供无损的沙箱安全物理清理回退逻辑。
2. **Windows 路径大小写防御必须全链路覆盖**：跨平台 Go 桌面应用中，来自前端的路径输入与系统 API 返回的路径可能存在盘符大小写不一致，严禁直接使用字符串前缀判断，必须在 VolumeName 层做标准化。
3. **HTTP 探活必须 Fail-Closed 且禁止裸 Transport 泄露**：网络探测工具必须复用连接池，严禁每次调用新建 Client，且排空 Body 必须有限制（如 4KB），避免恶意或超长响应拖垮客户端。
