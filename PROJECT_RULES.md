# CodeMind-Hub 项目级开发规范与规则 (Project Rules)

## 🚨 核心强制工作流规范 (Mandatory Workflow)

每次代码修改或新功能开发完成后，**必须无条件严格执行以下四大步骤闭环**：

### 1. 增量打包 EXE 安装包 (Incremental Installer Packaging)
- **命令**：`npm run build:installer` 或 `python build_installer.py`
- **目标产物**：`dist/CodeMind-Studio-Setup.exe` (单文件 Windows 图形化安装向导)
- **要求**：禁止仅仅构建 Web 端，必须增量生成 EXE 安装包，便于用户在真实 Windows 宿主环境进行安装与功能验证。

### 2. 真实执行与安装探活测试 (Live Verification)
- **严禁虚假模拟**，必须执行安装包真实解压安装；
- 启动执行程序，验证：
  - 后端微内核探活：`GET http://127.0.0.1:8010/health` (返回 HTTP 200)；
  - 静态前端挂载验证：`GET http://127.0.0.1:8010/` (返回完整 HTML 页面)；
  - 确保脱离源码目录后独立运行无缺失 DLL、黑框或白屏崩溃。

### 3. 文档同步更新 (Update Documentation)
- 全面更新 `README.md`，同步最新的架构图、功能说明、使用指引与构建方法。

### 4. Git 提交与远程推送 (Git Commit & Push)
- 执行代码与配置提交：
  ```bash
  git add <changed-files>
  git commit -m "<semantic-commit-message>"
  git push origin main
  ```
- 确保远程仓库与本地保持绝对同步，工作区保持 Clean。

---

## 🎨 视觉与交互规范
- 主底色：`#FAF8F5` (Warm Cream 柔和暖色)
- 强调色：`#D96B27` (Terracotta Orange 陶土暖橙)
- 风格：扁平极简企业级，克制微型控件，无大按钮，无多余网格卡片，纯净原生文件多标签，抽屉式集成终端。
