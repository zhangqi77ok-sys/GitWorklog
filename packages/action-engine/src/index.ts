export interface ResumePromptInput {
  currentTask: string;
  stopReason: string;
  evidenceSummary: string;
  nextAction: string;
}

export function buildResumePrompt(input: ResumePromptInput): string {
  return [
    "你当前正在执行的任务：",
    input.currentTask,
    "",
    "你停止的原因：",
    input.stopReason,
    "",
    "结合证据后的判断：",
    input.evidenceSummary,
    "",
    "下一步请先做：",
    input.nextAction,
    "",
    "执行要求：",
    "1. 优先处理当前阻塞点",
    "2. 不要偏离当前计划步骤",
    "3. 完成后补充验证结果",
  ].join("\n");
}
