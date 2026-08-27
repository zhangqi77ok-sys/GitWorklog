"""各大厂商预置 API 规则与模型矩阵。"""

from __future__ import annotations

PRESET_PROVIDERS = [
    {
        "provider_code": "dashscope",
        "name": "阿里云百炼 (DashScope / 通义千问)",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "protocol": "openai",
        "models": [
            {"id": "qwen3.7-flash", "name": "Qwen 3.7 Flash (极速/推荐)"},
            {"id": "qwen-max", "name": "Qwen Max (超强逻辑/旗舰)"},
            {"id": "qwen-plus", "name": "Qwen Plus (平衡/主力)"},
            {"id": "qwen-turbo", "name": "Qwen Turbo (高性价比)"},
            {"id": "qwen2.5-coder-32b-instruct", "name": "Qwen 2.5 Coder 32B (代码专家)"},
            {"id": "qwen-vl-max", "name": "Qwen VL Max (视觉多模态)"},
        ],
    },
    {
        "provider_code": "deepseek",
        "name": "DeepSeek (深度求索)",
        "base_url": "https://api.deepseek.com/v1",
        "protocol": "openai",
        "models": [
            {"id": "deepseek-chat", "name": "DeepSeek-V3 (通用大模型)"},
            {"id": "deepseek-reasoner", "name": "DeepSeek-R1 (深度推理/代码)"},
            {"id": "deepseek-coder", "name": "DeepSeek Coder (代码专家)"},
        ],
    },
    {
        "provider_code": "openai",
        "name": "OpenAI (GPT-4o / o1)",
        "base_url": "https://api.openai.com/v1",
        "protocol": "openai",
        "models": [
            {"id": "gpt-4o", "name": "GPT-4o (全模态旗舰)"},
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini (轻量/高频)"},
            {"id": "o1", "name": "o1 (高难度推理)"},
            {"id": "o3-mini", "name": "o3-mini (新一代高效推理)"},
            {"id": "gpt-4.5-preview", "name": "GPT-4.5 Preview (超大前沿)"},
        ],
    },
    {
        "provider_code": "anthropic",
        "name": "Anthropic Claude (3.7 Sonnet)",
        "base_url": "https://api.anthropic.com/v1",
        "protocol": "anthropic",
        "models": [
            {"id": "claude-3-7-sonnet", "name": "Claude 3.7 Sonnet (编程/多任务王牌)"},
            {"id": "claude-3-5-sonnet", "name": "Claude 3.5 Sonnet (主力旗舰)"},
            {"id": "claude-3-5-haiku", "name": "Claude 3.5 Haiku (轻快响应)"},
            {"id": "claude-3-opus", "name": "Claude 3 Opus (超长思考)"},
        ],
    },
    {
        "provider_code": "zhipu",
        "name": "智谱 AI (GLM-4)",
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "protocol": "openai",
        "models": [
            {"id": "glm-4-plus", "name": "GLM-4 Plus (旗舰多模态)"},
            {"id": "glm-4-flash", "name": "GLM-4 Flash (极速免费/高并发)"},
            {"id": "glm-4-air", "name": "GLM-4 Air (高性价比)"},
            {"id": "codegeex-4", "name": "CodeGeeX-4 (代码助手)"},
        ],
    },
    {
        "provider_code": "moonshot",
        "name": "月之暗面 (Kimi / Moonshot)",
        "base_url": "https://api.moonshot.cn/v1",
        "protocol": "openai",
        "models": [
            {"id": "moonshot-v1-8k", "name": "Moonshot V1 8k (标准上下文)"},
            {"id": "moonshot-v1-32k", "name": "Moonshot V1 32k (长文本)"},
            {"id": "moonshot-v1-128k", "name": "Moonshot V1 128k (超长文档)"},
            {"id": "kimi-k1.5", "name": "Kimi k1.5 (多模态推理模型)"},
        ],
    },
    {
        "provider_code": "ollama",
        "name": "本地私有化 (Ollama / vLLM / LocalAI)",
        "base_url": "http://localhost:11434/v1",
        "protocol": "openai",
        "models": [
            {"id": "qwen2.5-coder:7b", "name": "Qwen2.5 Coder 7B (本地编程)"},
            {"id": "deepseek-r1:8b", "name": "DeepSeek R1 8B (本地推理)"},
            {"id": "llama3.3:70b", "name": "Llama 3.3 70B (本地通用)"},
            {"id": "mistral:7b", "name": "Mistral 7B (轻量部署)"},
        ],
    },
]

# 官方全量模型同步基准库 (用于在线拉取与离线同步补全)
OFFICIAL_SYNC_CATALOGS = {
    "dashscope": [
        {"id": "qwen3.7-flash", "name": "Qwen 3.7 Flash (极速/推荐)"},
        {"id": "qwen3.7-plus", "name": "Qwen 3.7 Plus (能力跃升)"},
        {"id": "qwen-max", "name": "Qwen Max (超强逻辑/旗舰)"},
        {"id": "qwen-max-latest", "name": "Qwen Max Latest (持续更新版)"},
        {"id": "qwen-plus", "name": "Qwen Plus (平衡/主力)"},
        {"id": "qwen-turbo", "name": "Qwen Turbo (高性价比)"},
        {"id": "qwen2.5-coder-32b-instruct", "name": "Qwen 2.5 Coder 32B (代码专家)"},
        {"id": "qwen2.5-coder-14b-instruct", "name": "Qwen 2.5 Coder 14B (极速代码)"},
        {"id": "qwen-vl-max", "name": "Qwen VL Max (视觉理解)"},
        {"id": "qwen-vl-plus", "name": "Qwen VL Plus (图像解析)"},
        {"id": "text-embedding-v3", "name": "Text Embedding v3 (1536维向量)"},
    ],
    "deepseek": [
        {"id": "deepseek-chat", "name": "DeepSeek-V3 (通用大模型)"},
        {"id": "deepseek-reasoner", "name": "DeepSeek-R1 (深度推理/代码)"},
        {"id": "deepseek-coder", "name": "DeepSeek Coder 33B (代码专精)"},
    ],
    "openai": [
        {"id": "gpt-4o", "name": "GPT-4o (全模态旗舰)"},
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini (轻量/高频)"},
        {"id": "gpt-4.5-preview", "name": "GPT-4.5 Preview (超大前沿)"},
        {"id": "o1", "name": "o1 (高难度推理)"},
        {"id": "o1-mini", "name": "o1-mini (轻量推理)"},
        {"id": "o3-mini", "name": "o3-mini (新一代高效推理)"},
        {"id": "gpt-4-turbo", "name": "GPT-4 Turbo (高精度)"},
        {"id": "text-embedding-3-small", "name": "Text Embedding 3 Small"},
        {"id": "text-embedding-3-large", "name": "Text Embedding 3 Large"},
    ],
    "anthropic": [
        {"id": "claude-3-7-sonnet", "name": "Claude 3.7 Sonnet (编程/多任务王牌)"},
        {"id": "claude-3-5-sonnet", "name": "Claude 3.5 Sonnet (主力旗舰)"},
        {"id": "claude-3-5-haiku", "name": "Claude 3.5 Haiku (轻快响应)"},
        {"id": "claude-3-opus", "name": "Claude 3 Opus (超长深度思考)"},
    ],
    "zhipu": [
        {"id": "glm-4-plus", "name": "GLM-4 Plus (旗舰多模态)"},
        {"id": "glm-4-flash", "name": "GLM-4 Flash (极速免费/高并发)"},
        {"id": "glm-4-air", "name": "GLM-4 Air (高性价比)"},
        {"id": "glm-4-long", "name": "GLM-4 Long (100万长上下文)"},
        {"id": "codegeex-4", "name": "CodeGeeX-4 (代码助手)"},
        {"id": "embedding-3", "name": "Embedding-3 (智谱向量模型)"},
    ],
    "moonshot": [
        {"id": "moonshot-v1-8k", "name": "Moonshot V1 8k (标准上下文)"},
        {"id": "moonshot-v1-32k", "name": "Moonshot V1 32k (长文本)"},
        {"id": "moonshot-v1-128k", "name": "Moonshot V1 128k (超长文档)"},
        {"id": "kimi-k1.5", "name": "Kimi k1.5 (多模态推理模型)"},
    ],
    "ollama": [
        {"id": "qwen2.5-coder:7b", "name": "Qwen2.5 Coder 7B (本地编程)"},
        {"id": "qwen2.5-coder:14b", "name": "Qwen2.5 Coder 14B (高精度编程)"},
        {"id": "deepseek-r1:8b", "name": "DeepSeek R1 8B (本地推理)"},
        {"id": "deepseek-r1:14b", "name": "DeepSeek R1 14B (本地强推理)"},
        {"id": "llama3.3:70b", "name": "Llama 3.3 70B (本地通用)"},
        {"id": "mistral:7b", "name": "Mistral 7B (轻量部署)"},
        {"id": "nomic-embed-text", "name": "Nomic Embed Text (本地向量)"},
    ],
}


PRESET_ROUTES = [
    {
        "feature_key": "chat_default",
        "feature_name": "💬 智能对话主模型",
        "provider_code": "dashscope",
        "model_name": "qwen3.7-flash",
        "temperature": 0.7,
        "max_tokens": 2048,
    },
    {
        "feature_key": "data_analysis",
        "feature_name": "📊 数据统计与 Text2SQL 分析",
        "provider_code": "dashscope",
        "model_name": "qwen3.7-flash",
        "temperature": 0.1,
        "max_tokens": 2048,
    },
    {
        "feature_key": "coding_agent",
        "feature_name": "💻 Codex 编程与代码重构",
        "provider_code": "dashscope",
        "model_name": "qwen3.7-flash",
        "temperature": 0.2,
        "max_tokens": 4096,
    },
    {
        "feature_key": "intent_classify",
        "feature_name": "🎯 意图识别与语义分类",
        "provider_code": "dashscope",
        "model_name": "qwen3.7-flash",
        "temperature": 0.0,
        "max_tokens": 512,
    },
    {
        "feature_key": "memory_extract",
        "feature_name": "🧠 用户画像与知识图谱抽取",
        "provider_code": "dashscope",
        "model_name": "qwen3.7-flash",
        "temperature": 0.1,
        "max_tokens": 1024,
    },
]
