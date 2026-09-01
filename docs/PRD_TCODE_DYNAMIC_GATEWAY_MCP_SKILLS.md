# Tcode 智能体模型网关、MCP 服务与 Agent Skill 规范规约 (PRD)

## 1. 业务背景与业界标准对齐
在生产级智能体开发平台（如 sub2api、Claude Desktop、Cursor Rules、OpenDevin、Cline）中：
1. **模型网关 (Model Gateway)**：
   - 厂商（Provider Platform）与接入认证方式（Ingress Type）必须具备强联动约束，不同厂商原生支持不同认证矩阵；
   - 凭据输入区域随接入方式动态渲染，提供 API Key、Sub2 订阅链接与账号池熔断、Cap 凭据包长文本/JSON 粘贴、OAuth 2.0 官方授权登录、自建反代等专属表单。
2. **MCP 协议管理 (Model Context Protocol)**：
   - 支持完整 `stdio` 本地进程（自定义命令、参数表、环境变量 Key-Value 动态表）与 `sse` 远程事件流端点；
   - 支持服务连通性探活与可用工具清单探测（Probe Tools）；
   - 支持 Claude Desktop `claude_desktop_config.json` 格式一键导入。
3. **Agent Skill 技能管理**：
   - 技能是智能体系统提示词与执行工作流的专业封装；
   - 支持触发词（`/review`, `/tdd`, `/security`, `/perf` 等）、适用场景描述与多行 Markdown 核心指令编辑；
   - 提供开箱即用的业界预设模版一键套用。

---

## 2. 核心架构与数据结构

### 2.1 平台与认证动态矩阵 (Platform Matrix)
| 平台名称 (ID) | 默认端点 | 支持认证接入方式 | 推荐认证 |
| :--- | :--- | :--- | :--- |
| **Anthropic Claude** | `https://api.anthropic.com/v1` | `api_key`, `cap`, `sub2`, `oauth`, `proxy` | `api_key` |
| **OpenAI** | `https://api.openai.com/v1` | `api_key`, `cap`, `sub2`, `oauth`, `proxy` | `api_key` |
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta` | `api_key`, `oauth`, `sub2`, `proxy` | `api_key` |
| **DeepSeek** | `https://api.deepseek.com/v1` | `api_key`, `sub2`, `proxy` | `api_key` |
| **SiliconFlow** | `https://api.siliconflow.cn/v1` | `api_key`, `sub2`, `proxy` | `api_key` |
| **Moonshot Kimi** | `https://api.moonshot.cn/v1` | `api_key`, `sub2`, `proxy` | `api_key` |
| **Zhipu GLM** | `https://open.bigmodel.cn/api/paas/v4` | `api_key`, `sub2`, `proxy` | `api_key` |
| **Ollama Local** | `http://127.0.0.1:11434/v1` | `proxy`, `api_key` | `proxy` |

### 2.2 凭据输入动态渲染规范
- **API Key**：`API Key` 密码掩码输入框（带眼睛图标显隐）+ 自定义 Header 标识；
- **Sub2 订阅**：订阅链接文本框 + 账号池刷新间隔 (TTL) + 账号池同步探测按钮；
- **Cap 凭据包**：Session Token / Claude setup-token / Cookie 下拉选择 + 多行文本域 (textarea) 粘贴；
- **OAuth 2.0**：Client ID + Client Secret + 官方授权登录按钮；
- **Proxy 代理**：中转端点 + 访问令牌（本地模型可选留空）+ 协议模拟转换。

### 2.3 MCP 服务管理规范 (McpServerModal)
- 传输类型切换：`stdio` vs `sse`；
- Stdio 模式：命令行进程 `command`（`npx`, `python`, `uvx`, `docker` 等）与 `args` 拆解输入；
- SSE 模式：远程端点 URL；
- 环境变量：动态增删 Key-Value 环境变量表；
- 探活与工具探测：支持在线测试 MCP 协议连通性并拉取可用工具清单。

### 2.4 Agent Skill 技能管理规范 (SkillModal)
- 触发指令：以 `/` 开头的指令标识（如 `/review`, `/tdd`）；
- 核心指令：全功能多行 Markdown 文本域，支持长篇 Prompt 约束、角色定义与工作流规则；
- 预设模版库：一键套用架构审查专家、TDD 测试驱动生成、全维安全守卫、性能调优专家模版。
