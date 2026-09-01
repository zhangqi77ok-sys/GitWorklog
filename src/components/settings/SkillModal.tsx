import React, { useState, useEffect } from 'react';
import { Code2, Sparkles, FileText, Check, Tag } from 'lucide-react';
import { Dialog } from '../common/Dialog';
import { SkillConfig } from '../../store/useMcpSkillStore';
import { toast } from '../common/Toast';

interface SkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  skill?: SkillConfig | null;
  onSave: (skill: Omit<SkillConfig, 'id'>, id?: string) => void;
}

const PRESET_TEMPLATES: {
  name: string;
  trigger: string;
  description: string;
  prompt: string;
}[] = [
  {
    name: '代码审查专家 (Thermo-Nuclear Review)',
    trigger: '/review',
    description: '深度审查函数规模、圈复杂度、分层纯度与 Code Judo 降维',
    prompt: `你是一名严苛的顶级架构审查专家。请对当前代码进行 Thermo-Nuclear 级别深度审查：
1. 【Code Judo 降维简化】：审查是否存在过度封装、冗余类和无用抽象层；
2. 【阿里/企业级规约】：检查未知对象 .equals() 防护、拆装箱 NPE、严禁吞异常；
3. 【硬性规模门禁】：函数 ≤ 50 行、文件 ≤ 300 行、圈复杂度 ≤ 10、嵌套深度 ≤ 3；
4. 输出审查清单与最小重构代码对比。`,
  },
  {
    name: 'TDD 红绿重构测试生成器 (TDD Workflow)',
    trigger: '/tdd',
    description: '前置编写失败单元测试，严格践行 Red-Green-Refactor 工作流',
    prompt: `请严格遵循 TDD 规范，为目标功能或 Bug 修复编写前置测试用例：
1. 【Red 阶段】：先编写精准断言的失败测试，覆盖正常路径、边界用例和异常路径；
2. 【Mock 边界治理】：只 Mock 外部不可控远程 RPC/IO，严禁过度 Mock 内部业务类；
3. 输出完整可运行的单测代码。`,
  },
  {
    name: '安全与漏洞防护守卫 (Security Guard)',
    trigger: '/security',
    description: '检查 SQL 注入、路径遍历、命令注入与敏感凭据泄漏风险',
    prompt: `你是一名资深网络安全专家。请对当前代码及配置进行全方位白盒安全审计：
1. 检查 SQL 拼接防注入（禁止 \${} 拼接）；
2. 检查路径遍历与越界访问；
3. 检查敏感密钥、Token 与密码是否明文硬编码；
4. 检查是否有权限绕过或越权风险。`,
  },
  {
    name: '性能分析与并发优化 (Perf Optimizer)',
    trigger: '/perf',
    description: '排查慢 SQL、线程安全、锁竞争、内存泄漏与深分页',
    prompt: `你是一名性能调优专家。请分析当前实现的并发与资源开销：
1. 评估时间复杂度、空间复杂度与重 IO 路径；
2. 检查线程安全与无界队列问题；
3. 检查缓存一致性与锁粒度；
4. 给出高性能轻量化优化方案。`,
  },
];

export const SkillModal: React.FC<SkillModalProps> = ({
  isOpen,
  onClose,
  skill,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('/my-skill');
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    if (skill) {
      setName(skill.name);
      setTrigger(skill.trigger);
      setDescription(skill.description);
      setPrompt(skill.prompt);
    } else {
      setName('新智能体技能');
      setTrigger('/custom-skill');
      setDescription('在对话中通过 /指令 快速调用的专业技能插件');
      setPrompt('你是一名专业助手，请按照以下规范执行任务...\n1. 明确目标契约\n2. 规范化输出');
    }
  }, [skill, isOpen]);

  const handleApplyTemplate = (tmpl: typeof PRESET_TEMPLATES[0]) => {
    setName(tmpl.name);
    setTrigger(tmpl.trigger);
    setDescription(tmpl.description);
    setPrompt(tmpl.prompt);
    toast.info(`已套用模版: ${tmpl.name}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('请输入技能名称！');
      return;
    }
    if (!trigger.trim().startsWith('/')) {
      toast.error('触发词必须以 / 开头 (例如: /review, /tdd)！');
      return;
    }
    if (!prompt.trim()) {
      toast.error('请输入技能的核心提示词指令！');
      return;
    }

    onSave(
      {
        name: name.trim(),
        trigger: trigger.trim(),
        description: description.trim(),
        prompt: prompt.trim(),
        enabled: skill ? skill.enabled : true,
      },
      skill?.id
    );

    toast.success(skill ? '技能已更新' : '已添加新技能');
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#D96B27]/15 flex items-center justify-center text-[#D96B27]">
            <Code2 className="w-3.5 h-3.5" />
          </div>
          <span>{skill ? '编辑智能体技能 (Skill)' : '添加智能体技能 (Skill)'}</span>
        </div>
      }
      description="配置智能体行为准则与提示词。在对话框输入 /触发词 即可快速调用"
      maxWidth="max-w-2xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            title="取消并退出 (Esc)"
            className="px-3.5 py-1.5 rounded-lg border border-[#E6DFD5] bg-white hover:bg-[#FAF8F5] text-xs font-medium text-[#3D3A36] cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            title="保存技能配置"
            className="px-4 py-1.5 rounded-lg bg-[#D96B27] hover:bg-[#BF5A1B] text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            保存技能
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Quick Templates Bar */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-[#8A847C] flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#D96B27]" />
            <span>从业界预设模版一键套用:</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.trigger}
                type="button"
                onClick={() => handleApplyTemplate(tmpl)}
                className="px-2.5 py-1 bg-white hover:bg-[#FAF8F5] border border-[#E6DFD5] hover:border-[#D96B27] rounded-md text-[11px] text-[#3D3A36] font-medium transition-colors cursor-pointer"
              >
                {tmpl.name.split(' ')[0]} ({tmpl.trigger})
              </button>
            ))}
          </div>
        </div>

        {/* Basic Fields */}
        <div className="grid grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-[#E6DFD5]">
          <div className="space-y-1">
            <label className="font-bold text-xs text-[#1E1C1A]">技能名称 (Skill Name)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: 严苛代码审查"
              className="w-full px-3 py-1.5 bg-white border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg text-xs outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-xs text-[#1E1C1A]">
              触发指令 (Trigger Command)
            </label>
            <input
              type="text"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="例如: /review, /tdd, /security"
              className="w-full px-3 py-1.5 bg-white border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg text-xs font-mono text-[#D96B27] font-bold outline-none"
            />
          </div>

          <div className="col-span-2 space-y-1">
            <label className="font-bold text-xs text-[#1E1C1A]">适用场景描述 (Description)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="清晰告知智能体此技能的适用场景..."
              className="w-full px-3 py-1.5 bg-white border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg text-xs outline-none"
            />
          </div>
        </div>

        {/* Prompt Instructions */}
        <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-[#E6DFD5]">
          <div className="flex items-center justify-between">
            <label className="font-bold text-xs text-[#1E1C1A] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#D96B27]" />
              <span>核心提示词指令 (System Instructions / Prompt)</span>
            </label>
            <span className="text-[10px] text-[#8A847C]">支持 Markdown 格式指令</span>
          </div>

          <textarea
            rows={10}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="输入注入大模型的完整系统提示词、角色定义、工作流与执行约束..."
            className="w-full p-3 bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg text-xs font-mono leading-relaxed outline-none resize-none"
          />
        </div>
      </form>
    </Dialog>
  );
};
