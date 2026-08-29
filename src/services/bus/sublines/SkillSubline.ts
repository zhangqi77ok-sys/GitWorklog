export interface SkillItem {
  id: string;
  name: string;
  slashCommand: string;
  description: string;
  promptTemplate: string;
  category: 'code' | 'review' | 'git' | 'test' | 'workflow';
  enabled: boolean;
}

export class SkillSubline {
  readonly id = 'subline-skill';
  readonly name = 'Skill 技能与提示词管理子线';

  private skills: SkillItem[] = [
    {
      id: 'skill-review',
      name: '深度架构与代码评审',
      slashCommand: '/review',
      category: 'review',
      description: '执行严格的 SOLID 与性能审查，给出重构优化意见',
      promptTemplate: '请对以下代码进行严苛的架构审查与可维护性评估，指出边界异常风险与优化点：',
      enabled: true,
    },
    {
      id: 'skill-test',
      name: '自动化单元测试生成 (TDD)',
      slashCommand: '/test',
      category: 'test',
      description: '遵循 Red-Green-Refactor 原则生成覆盖正常路径与边界异常的单元测试',
      promptTemplate: '请根据业务逻辑编写全覆盖的单元测试用例，覆盖正常流、空值/边界场景与异常分支：',
      enabled: true,
    },
    {
      id: 'skill-commit',
      name: '智能 Git 提交规范生成',
      slashCommand: '/commit',
      category: 'git',
      description: '解析当前改动 Diff，生成符合 Conventional Commits 规范的精准提交信息',
      promptTemplate: '分析以下 Git Diff 变更内容，生成格式规范、重点突出的提交日志（包含 feat/fix/refactor 分类）：',
      enabled: true,
    },
    {
      id: 'skill-refactor',
      name: 'Code Judo 极简降维重构',
      slashCommand: '/refactor',
      category: 'code',
      description: '消除冗余抽象层与散落分支，用更简洁的类型系统简化实现',
      promptTemplate: '对这段代码进行降维重构，消除不必要的防御性中间层与嵌套，简化为清晰直观的实现：',
      enabled: true,
    },
  ];

  getSkills(): SkillItem[] {
    return [...this.skills];
  }

  addOrUpdateSkill(skill: SkillItem): void {
    const idx = this.skills.findIndex((s) => s.id === skill.id);
    if (idx >= 0) {
      this.skills[idx] = skill;
    } else {
      this.skills.push(skill);
    }
  }

  deleteSkill(skillId: string): void {
    this.skills = this.skills.filter((s) => s.id !== skillId);
  }

  matchSlashCommand(input: string): SkillItem | undefined {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) return undefined;
    const cmd = trimmed.split(/\s+/)[0].toLowerCase();
    return this.skills.find((s) => s.enabled && s.slashCommand.toLowerCase() === cmd);
  }
}
