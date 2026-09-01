/**
 * User Intent Classifier & Dynamic System Prompt Engine
 * 解决大模型 Agent Loop "答非所问、机械套用模板、自嗨跑题" 的核心治理引擎。
 */

export type UserIntentType = 'greeting' | 'chat_qa' | 'task_execution';

export interface UserIntentAnalysis {
  type: UserIntentType;
  isDirectQuestion: boolean;
  requiresFileEditOrCommand: boolean;
  summary: string;
}

const GREETING_REGEX = /^(你好|您好|hi|hello|hey|在吗|早上好|下午好|晚上好|哈喽|嗨|test|ping)[!！。.\s]*$/i;

const QUESTION_INDICATORS = [
  '为什么', '为何', '怎么', '如何', '是什么', '什么是', '有什么区别', '解释一下', '分析一下',
  '怎么看', '怎么用', '用法', '含义', '什么意思', '入参', '返回值', '原理', '区别',
  'why', 'what', 'how', 'explain', 'difference', 'meaning', 'usage', '?', '？'
];

const ACTION_INDICATORS = [
  '创建', '新建', '修改', '编辑', '改写', '修复', 'fix', '重构', 'refactor', '实现', 'implement',
  '编写', '写一个', '写一段', '删除', 'remove', 'delete', '运行', '执行', 'run', '安装', 'install',
  '打包', 'build', '测试', 'npm ', 'git ', 'python ', 'cargo ', 'mvn '
];

/**
 * 智能判定用户当前输入的真实意图，杜绝将简单问答误判为沉重工程重构。
 */
export function classifyUserIntent(userText: string): UserIntentAnalysis {
  const text = (userText || '').trim();

  // 1. 打招呼 / 闲聊判定
  if (GREETING_REGEX.test(text) || (text.length <= 4 && GREETING_REGEX.test(text.toLowerCase()))) {
    return {
      type: 'greeting',
      isDirectQuestion: false,
      requiresFileEditOrCommand: false,
      summary: '打招呼/问候'
    };
  }

  // 2. 检查是否包含明确的写代码/执行命令动词
  const hasActionKeyword = ACTION_INDICATORS.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()));
  
  // 3. 检查是否为咨询、问答、解释、原理探究
  const hasQuestionKeyword = QUESTION_INDICATORS.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()));

  // 明确要求修改文件/执行命令且不带纯解释倾向
  if (hasActionKeyword && !text.startsWith('为什么') && !text.startsWith('怎么理解') && !text.startsWith('如何理解')) {
    return {
      type: 'task_execution',
      isDirectQuestion: false,
      requiresFileEditOrCommand: true,
      summary: '工程编码/命令执行任务'
    };
  }

  // 默认为问答咨询 / 概念解释
  return {
    type: 'chat_qa',
    isDirectQuestion: hasQuestionKeyword,
    requiresFileEditOrCommand: false,
    summary: '技术咨询/代码解答/问答'
  };
}

export interface DynamicPromptConfig {
  intent: UserIntentAnalysis;
  projectName?: string;
  projectPath?: string;
  gitBranch?: string;
  workMode?: string;
  executionMode: 'act' | 'swarm';
  profileSnippet?: string;
  memorySnippet?: string;
  rulesSnippet?: string;
  skillsSnippet?: string;
  mcpSnippet?: string;
}

/**
 * 构建与用户意图严格匹配的瘦身动态 System Prompt，杜绝噪声污染与答非所问。
 */
export function buildDynamicSystemPrompt(config: DynamicPromptConfig): string {
  const { intent, projectName, projectPath, gitBranch, workMode } = config;

  // 1. 问候模式：极致极简，自然亲和，严禁任何套话
  if (intent.type === 'greeting') {
    return `你是 Tcode (AI Agentic Desktop IDE) 的智能助手。
【核心要求】:
- 用户正在向你打招呼，请友好、简短、自然地回应（1~2 句话即可）。
- 严禁输出长篇大论、严禁列出架构师套话或虚假的验收清单。
- 简要表明你已就绪，随时可以协助解答技术疑问或落地工程代码。`;
  }

  // 2. 问答咨询 / 概念解释模式 (QA & Discussion)
  if (intent.type === 'chat_qa') {
    return `你是 Tcode (AI Agentic Desktop IDE) 的技术专家。
${projectName && projectPath ? `【当前工程上下文】: 项目 [${projectName}] (路径: ${projectPath}, 分支: ${gitBranch || 'main'})` : ''}
${config.profileSnippet ? `\n${config.profileSnippet}` : ''}
${config.rulesSnippet ? `\n${config.rulesSnippet}` : ''}

【🚨 极高优先级核心准则（直击要害，绝不答非所问）】:
1. **直接回答**: 开门见山，第一句话必须正面给出核心结论与答案，严禁先打空洞套话或虚无的架构师开场白！
2. **拒绝过度工程**: 用户当前是提问、咨询、分析或讨论，**严禁主动输出 write_file 或 run_command 动作块**，严禁列出机械的验收打钩清单 (Acceptance Criteria)！
3. **结构清晰**: 观点明确，逻辑严密，提供精准的代码片段或技术解释供用户参考，突出核心要点。
4. **紧扣用户原话**: 所有解释必须围绕用户提出的具体疑问展开，不要随意发散到无关的重构建议。`;
  }

  // 3. 编码与命令执行模式 (Task Execution)
  return `你是 Tcode (AI Agentic Desktop IDE) 接入的生产级自主 AI Agent 架构师。
${config.profileSnippet ? `${config.profileSnippet}\n` : ''}
${config.memorySnippet ? `${config.memorySnippet}\n` : ''}
${projectName && projectPath ? `【本地物理工程已挂载】: 项目 [${projectName}] (路径: ${projectPath}, 分支: ${gitBranch || 'main'})\n` : ''}
${config.rulesSnippet ? `${config.rulesSnippet}\n` : ''}
${config.skillsSnippet ? `${config.skillsSnippet}\n` : ''}
${config.mcpSnippet ? `${config.mcpSnippet}\n` : ''}
【当前工作模式】: ${workMode === 'act' ? 'Act 落地模式 (自主执行模式)' : 'Plan 规划模式'}

【🚨 核心执行准则】:
1. **紧扣任务目标**: 深入理解用户的具体修改需求，先简述核心变更点，再输出精准动作。
2. **动作格式规约**:
   - 文件修改:
     \`\`\`write_file:相对路径或绝对路径
     完整文件内容
     \`\`\`
   - 终端命令 (Windows PowerShell，严禁使用 &&):
     \`\`\`run_command
     具体的终端指令
     \`\`\`
3. **真实证据闭环**: Tcode 会执行你的动作并将结果反馈给你。任务完成且测试通过后，输出清晰的完成总结。`;
}
