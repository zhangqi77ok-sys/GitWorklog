import React, { useState, useEffect } from "react";
import { SettingsTab, LLMChannel } from "../../types";
import { CockpitGatewayPane } from "./CockpitGatewayPane";
import { SkillManagerPane } from "./SkillManagerPane";
import { McpManagerPane } from "./McpManagerPane";
import { GeneralPreferencesPane } from "./GeneralPreferencesPane";
import { AuditLogPane } from "./AuditLogPane";
import { llmConfigService } from "../../services/llmConfigService";
import {
  Rocket,
  Puzzle,
  Plug,
  Palette,
  Keyboard,
  X,
  TrendingUp,
  GitFork,
  Bot,
  Zap,
  Leaf,
  Shield,
  FileText,
  Settings as SettingsIcon,
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("gateway");
  // 默认点进来在仪表盘 (dashboard)
  const [activeSubTab, setActiveSubTab] = useState<string>("dashboard");
  const [channels, setChannels] = useState<LLMChannel[]>([]);

  useEffect(() => {
    const loadChannels = () => setChannels(llmConfigService.getChannels());
    loadChannels();
    window.addEventListener("llm-config-updated", loadChannels);
    return () => window.removeEventListener("llm-config-updated", loadChannels);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-[1000] flex items-center justify-center animate-in fade-in duration-150">
      <div className="w-[1140px] h-[740px] bg-white rounded-2xl shadow-2xl border border-[#e5dfd8] overflow-hidden flex flex-col">
        {/* 弹窗头部 */}
        <div className="px-5 py-3.5 bg-white border-b border-[#e5dfd8] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl">🚀</span>
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-[#1e1b18] leading-tight">
                CodeMind Preferences & Cockpit Tools
              </h2>
              <span className="text-[11px] text-[#9c948a]">
                全局配置总枢纽 · LLM网关与全厂商矩阵 / SKILL技能 / MCP协议工具
              </span>
            </div>
            <span className="font-mono text-[10px] bg-[#f4efea] text-[#d96b27] px-2 py-0.5 rounded border border-[#e5dfd8]">
              Ctrl + ,
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#645e57] hover:bg-[#f1f5f9] hover:text-[#1e1b18] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* 弹窗主体：一级侧边栏 + Cockpit二级子侧边栏 + 右侧主内容面板 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 一级导航栏 */}
          <aside className="w-52 bg-[#f4efea] border-r border-[#e5dfd8] p-3 flex flex-col gap-1 shrink-0 select-none">
            <span className="text-[10px] font-bold text-[#9c948a] px-2 py-1 uppercase tracking-wider">
              核心扩展能力 (Core)
            </span>

            <button
              onClick={() => {
                setActiveTab("gateway");
                setActiveSubTab("dashboard");
              }}
              className={`w-full px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                activeTab === "gateway"
                  ? "bg-white text-[#d96b27] shadow-sm border border-[#e5dfd8]"
                  : "text-[#645e57] hover:bg-[#ebe5df] hover:text-[#1e1b18]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Rocket size={14} />
                <span>LLM 模型网关</span>
              </div>
              <span className="text-[10px] bg-[#fef0e7] text-[#d96b27] px-1.5 py-0.5 rounded font-mono">
                Cockpit
              </span>
            </button>

            <button
              onClick={() => setActiveTab("skills")}
              className={`w-full px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                activeTab === "skills"
                  ? "bg-white text-[#d96b27] shadow-sm border border-[#e5dfd8]"
                  : "text-[#645e57] hover:bg-[#ebe5df] hover:text-[#1e1b18]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Puzzle size={14} />
                <span>SKILL 技能管理</span>
              </div>
              <span className="text-[10px] bg-[#f1f5f9] text-[#645e57] px-1.5 py-0.5 rounded font-mono">
                3
              </span>
            </button>

            <button
              onClick={() => setActiveTab("mcp")}
              className={`w-full px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                activeTab === "mcp"
                  ? "bg-white text-[#d96b27] shadow-sm border border-[#e5dfd8]"
                  : "text-[#645e57] hover:bg-[#ebe5df] hover:text-[#1e1b18]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Plug size={14} />
                <span>MCP 协议与工具</span>
              </div>
              <span className="text-[10px] bg-[#f1f5f9] text-[#645e57] px-1.5 py-0.5 rounded font-mono">
                3
              </span>
            </button>

            <button
              onClick={() => setActiveTab("logs")}
              className={`w-full px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                activeTab === "logs"
                  ? "bg-white text-[#d96b27] shadow-sm border border-[#e5dfd8]"
                  : "text-[#645e57] hover:bg-[#ebe5df] hover:text-[#1e1b18]"
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText size={14} />
                <span>系统日志与审计</span>
              </div>
              <span className="text-[10px] bg-[#f1f5f9] text-[#645e57] px-1.5 py-0.5 rounded font-mono">
                Log
              </span>
            </button>

            <span className="text-[10px] font-bold text-[#9c948a] px-2 py-1 mt-3 uppercase tracking-wider">
              系统偏好 (Preferences)
            </span>

            <button
              onClick={() => setActiveTab("general")}
              className={`w-full px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
                activeTab === "general"
                  ? "bg-white text-[#d96b27] shadow-sm border border-[#e5dfd8]"
                  : "text-[#645e57] hover:bg-[#ebe5df] hover:text-[#1e1b18]"
              }`}
            >
              <Palette size={14} />
              <span>外观与主题风格</span>
            </button>

            <button
              onClick={() => setActiveTab("general")}
              className="w-full px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 text-[#645e57] hover:bg-[#ebe5df] hover:text-[#1e1b18] cursor-pointer transition-colors"
            >
              <Keyboard size={14} />
              <span>常用快捷键速查</span>
            </button>
          </aside>

          {/* 二级厂商/功能子侧边栏 (仅在 LLM 模型网关标签下展示) */}
          {activeTab === "gateway" && (
            <aside className="w-48 bg-[#f4efea] border-r border-[#e5dfd8] p-2.5 flex flex-col justify-between shrink-0 select-none">
              <div className="flex flex-col gap-1 text-xs">
                {/* 1. 仪表盘 (总览) */}
                <button
                  onClick={() => setActiveSubTab("dashboard")}
                  className={`px-3 py-2 rounded-lg flex items-center gap-2 cursor-pointer transition-all ${
                    activeSubTab === "dashboard"
                      ? "bg-white text-[#d96b27] font-bold shadow-2xs border border-[#e5dfd8]"
                      : "text-[#645e57] hover:bg-[#ebe5df] hover:text-[#1e1b18]"
                  }`}
                >
                  <TrendingUp size={14} className={activeSubTab === "dashboard" ? "text-[#d96b27]" : ""} />
                  <span>仪表盘 (总览)</span>
                </button>

                {/* 2. 中转站 / 全部渠道 */}
                <button
                  onClick={() => setActiveSubTab("relay")}
                  className={`px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer transition-all ${
                    activeSubTab === "relay"
                      ? "bg-white text-[#d96b27] font-bold shadow-2xs border border-[#e5dfd8]"
                      : "text-[#645e57] hover:bg-[#ebe5df] hover:text-[#1e1b18]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <GitFork size={14} className={activeSubTab === "relay" ? "text-[#d96b27]" : ""} />
                    <span>中转站 (渠道)</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#e7e2d9] text-[#645e57]">
                    {channels.length}
                  </span>
                </button>

                <div className="h-[1px] bg-[#e5dfd8] my-1"></div>

                <div className="flex justify-between items-center px-2 py-0.5">
                  <span className="text-[9px] font-bold text-[#9c948a] uppercase tracking-wider">
                    快速筛选厂商
                  </span>
                  {activeSubTab !== "dashboard" && activeSubTab !== "relay" && (
                    <button
                      onClick={() => setActiveSubTab("relay")}
                      className="text-[10px] text-[#d96b27] hover:underline cursor-pointer"
                    >
                      查看全部
                    </button>
                  )}
                </div>

                {/* 动态真实厂商列表 */}
                <div className="flex flex-col gap-0.5 max-h-[290px] overflow-y-auto pr-0.5">
                  {channels.map((chan) => {
                    const isSelected =
                      activeSubTab === chan.id ||
                      (activeSubTab === "bailian" && (chan.id.includes("bailian") || chan.name.includes("百炼"))) ||
                      (activeSubTab === "deepseek" && (chan.id.includes("deepseek") || chan.name.includes("DeepSeek"))) ||
                      (activeSubTab === "claude" && (chan.id.includes("anthropic") || chan.name.includes("Claude"))) ||
                      (activeSubTab === "antigravity" && (chan.id.includes("antigravity") || chan.name.includes("Antigravity"))) ||
                      (activeSubTab === "gemini" && (chan.id.includes("antigravity") || chan.id.includes("gemini") || chan.name.includes("Antigravity"))) ||
                      (activeSubTab === "ollama" && (chan.id.includes("ollama") || chan.name.includes("Ollama")));

                    // 提取更精简的厂商短名
                    const shortName = chan.name
                      .replace(" (DashScope / 通义千问)", "")
                      .replace(" (支持 OAuth / RT)", "")
                      .replace(" (本地大模型)", "")
                      .replace(" (硅基流动)", "")
                      .replace(" (Claude)", "");

                    return (
                      <button
                        key={chan.id}
                        onClick={() => setActiveSubTab(chan.id)}
                        className={`w-full px-2.5 py-1.5 rounded-md flex items-center justify-between cursor-pointer transition-colors text-left ${
                          isSelected
                            ? "bg-white text-[#d96b27] font-semibold border border-[#e5dfd8] shadow-2xs"
                            : "text-[#645e57] hover:bg-[#ebe5df] hover:text-[#1e1b18]"
                        }`}
                        title={chan.name}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          {chan.id.includes("antigravity") || chan.id.includes("gemini") ? (
                            <Leaf size={12} className={isSelected ? "text-[#d96b27]" : "text-[#10b981]"} />
                          ) : chan.id.includes("deepseek") || chan.id.includes("bailian") ? (
                            <Zap size={12} className={isSelected ? "text-[#d96b27]" : "text-[#d97706]"} />
                          ) : (
                            <Bot size={12} className={isSelected ? "text-[#d96b27]" : "text-[#78716c]"} />
                          )}
                          <span className="truncate">{shortName}</span>
                        </div>
                        {chan.latencyMs ? (
                          <span className="text-[9px] font-mono text-[#059669] shrink-0">{chan.latencyMs}ms</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-[#e5dfd8] flex flex-col gap-1 text-xs text-[#645e57]">
                <button
                  onClick={() => setActiveSubTab("2fa")}
                  className={`px-2.5 py-1.5 rounded-md flex items-center gap-2 cursor-pointer ${
                    activeSubTab === "2fa"
                      ? "bg-white text-[#d96b27] font-semibold border border-[#e5dfd8]"
                      : "hover:bg-[#ebe5df] hover:text-[#1e1b18]"
                  }`}
                >
                  <Shield size={13} /> 2FA 管理
                </button>
                <button
                  onClick={() => setActiveSubTab("logs")}
                  className={`px-2.5 py-1.5 rounded-md flex items-center gap-2 cursor-pointer ${
                    activeSubTab === "logs"
                      ? "bg-white text-[#d96b27] font-semibold border border-[#e5dfd8]"
                      : "hover:bg-[#ebe5df] hover:text-[#1e1b18]"
                  }`}
                >
                  <FileText size={13} /> 日志
                </button>
                <button
                  onClick={() => setActiveSubTab("settings")}
                  className={`px-2.5 py-1.5 rounded-md flex items-center gap-2 cursor-pointer ${
                    activeSubTab === "settings"
                      ? "bg-white text-[#d96b27] font-semibold border border-[#e5dfd8]"
                      : "hover:bg-[#ebe5df] hover:text-[#1e1b18]"
                  }`}
                >
                  <SettingsIcon size={13} /> 高级设置
                </button>
              </div>
            </aside>
          )}

          {/* 右侧主配置内容区 */}
          <main className="flex-1 flex flex-col h-full overflow-hidden bg-white">
            {activeTab === "gateway" && (
              <CockpitGatewayPane
                activeSubTab={activeSubTab}
                onNavigateSubTab={(tab) => setActiveSubTab(tab)}
              />
            )}
            {activeTab === "skills" && <SkillManagerPane />}
            {activeTab === "mcp" && <McpManagerPane />}
            {activeTab === "logs" && <AuditLogPane />}
            {activeTab === "general" && <GeneralPreferencesPane />}
          </main>
        </div>

        {/* 弹窗底部 */}
        <div className="px-5 py-3 bg-[#f8fafc] border-t border-[#e5dfd8] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-xs text-[#645e57]">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
            <span>Cockpit Tools 网关实时保活已开启 · 自动持久化同步</span>
          </div>
          <button
            onClick={onClose}
            className="bg-[#d96b27] hover:bg-[#b85417] text-white text-xs font-semibold px-4 py-1.5 rounded-lg cursor-pointer shadow-sm transition-colors"
          >
            完成并返回工作区
          </button>
        </div>
      </div>
    </div>
  );
};
