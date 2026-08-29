---
name: build-windows-installer
description: >-
  Builds the complete Windows standalone installer (CodeMind-Studio-Setup.exe) in the release/ directory.
  Runs frontend build (tsc + vite), executes 101 Vitest unit tests, compiles desktop host core,
  embeds dist assets into the Setup Wizard, and packages into E:\pro\agent-learning\release.
---

# Windows 安装包构建与发布 Skill (uild-windows-installer)

本 Skill 用于将当前工程完整编译并构建为 Windows 桌面端单文件安装向导 (CodeMind-Studio-Setup.exe)，输出至 E:\pro\agent-learning\release\ 目录。

## 适用场景
- 完成功能开发或修复后，需要打包发布 Windows 桌面端安装程序；
- 验证生产环境下的前端打包资源是否完整嵌入桌面端；
- 需要验证全量 101 个单元测试与 PyInstaller 桌面宿主打包流水线。

## 构建流水线 (Build Pipeline)

1. 前端构建：在 prototype/ 下执行 
pm run build (	sc -b && vite build)；
2. 质量门禁：执行 
pm test 保证全量单元测试 100% 通过；
3. 核心打包：使用 PyInstaller 编译 src-desktop/desktop_app.py，并将 prototype/dist 打包为 CodeMind-Studio.exe；
4. 向导打包：将核心程序注入安装向导 payload，编译 src-desktop/setup_wizard.py 为单文件向导；
5. 发布产出：生成至 
elease/CodeMind-Studio-Setup.exe。

## 执行命令

`ash
# 执行完整打包发布脚本
python build_installer.py
`
