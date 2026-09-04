# 后端持久化假数据根除、前端硬编码彻底清理与 Go 原生单文件安装包全链路构建

> 归档分类：数据治理 / 原生安装器 / 纯净空状态 / 铁律 0.5 与 1.5 实践  
> 对应版本：Tcode Studio v2.0.0+  
> 遵循规约：`AGENTS.md`【铁律 0.5: 严禁假数据与 Demo 占位铁律】与【铁律 1.5: 强制闭环验证】

---

## ① 知识点与问题背景 (Context & Problem Statement)

在桌面端体验验收过程中，发现以下两类关键问题：
1. **假数据顽固复现**：此前已清理前端状态，但启动软件后会话列表中仍出现“架构重构与执行流设计 #核心架构”等假数据，对话舱出现固定硬编码气泡与假模型名称；
2. **安装包形态不合规**：一度使用了临时 7-Zip 自解压模块替代正式安装程序，导致缺失 Windows 安装向导界面、快捷方式创建、注册表联动与卸载器集成。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. 后端持久化存储自愈式“投毒”机制
在 `internal/session/store.go` 中，原实现包含如下逻辑：
```go
metas := s.List()
if len(metas) == 0 {
    s.initDefaults() // 写入写死的 sess1.json 到磁盘！
}
```
这导致哪怕用户或测试程序清空了 `~/.tcode/sessions/` 目录，一旦 Go 后端微内核实例启动，就会立即在磁盘物理重建包含假会话、假思考、假工具调用的 `sess1.json`，并通过 Wails IPC 重新暴露给前端。

### 2. 表现层硬编码假逻辑与假模型名称
- 模板中存在 `v-if="msg.id === 'msg_2'"` 的特定卡片判断；
- 下拉列表中硬编码了捏造的模型代号（如 `deepseek-v4-flash`, `gpt-5.6-sol`）；
- 场景标签固定硬编码为 5 个固定假标签，而非从实际会话中动态提取。

### 3. 正统 Windows 单文件安装向导架构
本项目已具备基于纯 Go + Win32/WinForms 原生架构的安装向导：
- `cmd/installer/main.go`：通过 `//go:embed` 内嵌 `assets/tcode.exe` 与 `assets/uninstall.exe`，支持命令行参数（`/S`, `-silent`, `-dir`）与原生无黑框文件夹选择器，负责快捷方式与注册表写入；
- `cmd/uninstaller/main.go`：负责自适应物理寻址、注销注册表并执行延迟完全物理自删除。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 根治后端自动假数据
彻底移除 `store.go` 中的 `initDefaults`，确保空状态即为干净的 0 会话，由前端显示 `📭 暂无会话记录`。

### 2. 前端模型与标签动态化
- 模型选项对齐业界真实主流模型标识符（`deepseek-chat`, `deepseek-reasoner`, `gpt-4o`, `claude-3-7-sonnet`）；
- 标签采用动态 `computed` 提取实际会话中的 tag，会话为空时仅展示“全部”。

### 3. 一键编译与打包闭环流水线
```powershell
# 1. 编译前端
cd frontend && npm run build && cd ..

# 2. 编译 Wails 桌面端主程序
wails build -tags "desktop,production" -ldflags "-s -w -H windowsgui" -o tcode.exe

# 3. 注入安装向导资产
Copy-Item "build/bin/tcode.exe" "cmd/installer/assets/tcode.exe" -Force
go build -ldflags "-H windowsgui -s -w" -o bin/uninstall.exe cmd/uninstaller/main.go
Copy-Item "bin/uninstall.exe" "cmd/installer/assets/uninstall.exe" -Force

# 4. 编译单文件 Windows 原生安装程序
go build -ldflags "-H windowsgui -s -w" -o bin/TcodeStudio_Setup_v2.0.0.exe cmd/installer/main.go
Copy-Item "bin/TcodeStudio_Setup_v2.0.0.exe" "release/Tcode-Setup-v2.0.0.exe" -Force
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **排查假数据必须前后端双向通查**：界面显示假数据时，除检查 Vue/React 响应式状态外，必须第一优先级检索本地落盘目录（如 `~/.tcode/`）与后端的读写钩子；
2. **单文件安装器构建顺序**：必须先更新 `cmd/installer/assets/` 下的被嵌入文件，再编译安装程序主二进制，否则新版本安装包会依然释放旧版程序；
3. **Fail-Closed 原则严禁默认假 Fallback**：网络断开或未接入桌面端环境时，应直接向用户报告真实环境未就绪，严禁在客户端代码中静默调用假中转或预置假回复。
