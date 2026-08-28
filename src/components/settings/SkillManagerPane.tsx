import React, { useState } from "react";
import { Skill } from "../../types";
import { Plus } from "lucide-react";

export const SkillManagerPane: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([
    {
      id: "skill-pytest",
      name: "PyTest 自动化单测规范",
      desc: "自动化生成覆盖边界与异常的 pytest 测试套件并验证断言",
      category: "testing",
      enabled: true,
    },
    {
      id: "skill-ast",
      name: "AST 语义重构引擎",
      desc: "解析抽象语法树并安全重命名与提取函数，防止死代码与命名污染",
      category: "refactor",
      enabled: true,
    },
    {
      id: "skill-doc",
      name: "OpenAPI & Markdown 文档生成",
      desc: "根据代码自动生成标准化交互式接口文档与数据模型说明",
      category: "docs",
      enabled: true,
    },
  ]);

  const toggleSkill = (id: string) => {
    setSkills(
      skills.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  return (
    <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4 bg-white">
      <div className="flex justify-between items-center pb-3 border-b border-[#e5dfd8]">
        <div>
          <h3 className="font-bold text-sm text-[#1e1b18]">
            🧩 SKILL 规范与 SOP 技能流 (Agent Skills)
          </h3>
          <p className="text-xs text-[#645e57]">
            管理内置与自定义工程规范（PyTest 单测、AST 重构、文档生成等）。
          </p>
        </div>
        <button
          onClick={() => alert("＋ 导入新技能")}
          className="bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#cbd5e1] text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1 cursor-pointer"
        >
          <Plus size={12} /> 导入新技能
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {skills.map((skill) => (
          <div
            key={skill.id}
            className="bg-[#f8fafc] border border-[#e5dfd8] rounded-xl p-3.5 flex justify-between items-center"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-[#1e1b18]">
                  {skill.name}
                </span>
                <span className="bg-[#f1f5f9] text-[#645e57] text-[10px] px-1.5 py-0.5 rounded font-mono">
                  {skill.id}
                </span>
              </div>
              <span className="text-xs text-[#645e57]">{skill.desc}</span>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={skill.enabled}
                onChange={() => toggleSkill(skill.id)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[#cbd5e1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10b981]"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};
