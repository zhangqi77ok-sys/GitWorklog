import React, { useState, useEffect } from "react";
import {
  FileText,
  RotateCw,
  Trash2,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Filter,
  Search,
  Activity
} from "lucide-react";
import { gatewayBus } from "../../services/bus/GatewayBus";
import { AuditLogEntry } from "../../services/bus/sublines/AuditLogSubline";

export const AuditLogPane: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filterEngine, setFilterEngine] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadLogs = () => {
    const data = gatewayBus.getAuditSubline().getLogs();
    setLogs(data);
  };

  useEffect(() => {
    loadLogs();
    const timer = setInterval(loadLogs, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleClear = () => {
    if (confirm("确认清空所有系统审计与请求日志？")) {
      gatewayBus.getAuditSubline().clearLogs();
      setLogs([]);
    }
  };

  const handleExport = () => {
    const json = gatewayBus.getAuditSubline().exportLogsJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `codemind_audit_logs_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter((l) => {
    if (filterEngine !== "all" && l.engineId !== filterEngine) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        l.model.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        (l.errorMessage && l.errorMessage.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalRequests = logs.length;
  const successRequests = logs.filter((l) => l.status === "success").length;
  const successRate = totalRequests > 0 ? Math.round((successRequests / totalRequests) * 100) : 100;
  const avgLatency =
    totalRequests > 0
      ? Math.round(logs.reduce((acc, l) => acc + l.durationMs, 0) / totalRequests)
      : 0;
  const totalTokens = logs.reduce((acc, l) => acc + l.tokensCount, 0);

  return (
    <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4 bg-[#faf9f8]">
      {/* 标题栏 */}
      <div className="flex justify-between items-center pb-3 border-b border-[#e5dfd8]">
        <div>
          <h3 className="font-bold text-sm text-[#1e1b18] flex items-center gap-2">
            <FileText size={16} className="text-[#d96b27]" />
            <span>系统日志与全链路请求审计 (Audit Logs)</span>
          </h3>
          <p className="text-xs text-[#645e57]">
            真实追踪每一次流式请求的 Request ID、中转站类型、耗时、Token 吞吐量与错误诊断。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            className="px-2.5 py-1.5 bg-white hover:bg-[#f1f5f9] border border-[#e5dfd8] rounded-lg text-xs font-semibold text-[#645e57] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RotateCw size={12} />
            <span>刷新</span>
          </button>
          <button
            onClick={handleExport}
            className="px-2.5 py-1.5 bg-white hover:bg-[#f1f5f9] border border-[#e5dfd8] rounded-lg text-xs font-semibold text-[#645e57] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Download size={12} />
            <span>导出 JSON</span>
          </button>
          <button
            onClick={handleClear}
            className="px-2.5 py-1.5 bg-white hover:bg-[#fee2e2] text-[#ef4444] border border-[#fecaca] rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Trash2 size={12} />
            <span>清空日志</span>
          </button>
        </div>
      </div>

      {/* 指标摘要卡片 */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl border border-[#e5dfd8] flex items-center gap-3 shadow-2xs">
          <div className="w-8 h-8 rounded-lg bg-[#f4efea] flex items-center justify-center text-[#d96b27]">
            <Activity size={16} />
          </div>
          <div>
            <div className="text-[11px] text-[#9c948a]">总请求批次</div>
            <div className="text-base font-bold font-mono text-[#1e1b18]">{totalRequests}</div>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-[#e5dfd8] flex items-center gap-3 shadow-2xs">
          <div className="w-8 h-8 rounded-lg bg-[#ecfdf5] flex items-center justify-center text-[#10b981]">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <div className="text-[11px] text-[#9c948a]">请求成功率</div>
            <div className="text-base font-bold font-mono text-[#10b981]">{successRate}%</div>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-[#e5dfd8] flex items-center gap-3 shadow-2xs">
          <div className="w-8 h-8 rounded-lg bg-[#eff6ff] flex items-center justify-center text-[#3b82f6]">
            <Clock size={16} />
          </div>
          <div>
            <div className="text-[11px] text-[#9c948a]">平均调用耗时</div>
            <div className="text-base font-bold font-mono text-[#1e1b18]">{avgLatency} ms</div>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-[#e5dfd8] flex items-center gap-3 shadow-2xs">
          <div className="w-8 h-8 rounded-lg bg-[#fef0e7] flex items-center justify-center text-[#d96b27]">
            <Zap size={16} />
          </div>
          <div>
            <div className="text-[11px] text-[#9c948a]">累计输出 Tokens</div>
            <div className="text-base font-bold font-mono text-[#1e1b18]">{totalTokens.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* 搜索与过滤工具栏 */}
      <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-[#e5dfd8]">
        <div className="flex items-center gap-2 flex-1 px-2.5 py-1.5 bg-[#f4efea] rounded-lg text-xs">
          <Search size={14} className="text-[#9c948a]" />
          <input
            type="text"
            placeholder="搜索模型名称、Request ID、异常报错..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-xs text-[#1e1b18]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[#9c948a]" />
          <select
            value={filterEngine}
            onChange={(e) => setFilterEngine(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-[#e5dfd8] rounded-lg text-xs font-semibold text-[#645e57] outline-none cursor-pointer"
          >
            <option value="all">全部引擎与渠道</option>
            <option value="subline-opencode">OpenCode 引擎</option>
            <option value="subline-codex">OpenAI Codex 引擎</option>
            <option value="subline-claude">Claude Code 引擎</option>
            <option value="subline-dashscope">阿里百炼 (DashScope)</option>
          </select>
        </div>
      </div>

      {/* 日志流水列表 */}
      <div className="flex flex-col gap-2">
        {filteredLogs.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#e5dfd8] p-8 flex flex-col items-center justify-center text-center gap-2">
            <span className="text-3xl">📋</span>
            <div className="text-xs font-bold text-[#1e1b18]">暂无审计日志记录</div>
            <div className="text-[11px] text-[#9c948a]">
              发起对话或调用模型后，系统的全链路调用追踪将自动显示在此处。
            </div>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`bg-white rounded-xl border p-3 flex flex-col gap-2 transition-all ${
                log.status === "error" ? "border-[#fecaca] bg-[#fff5f5]" : "border-[#e5dfd8]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {log.status === "success" ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-[#10b981] bg-[#ecfdf5] px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={11} /> 200 OK
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-[#ef4444] bg-[#fee2e2] px-2 py-0.5 rounded-full">
                      <XCircle size={11} /> HTTP {log.statusCode || 500}
                    </span>
                  )}
                  <span className="font-mono text-xs font-bold text-[#1e1b18]">{log.model}</span>
                  <span className="text-[10px] font-mono bg-[#f4efea] text-[#645e57] px-1.5 py-0.5 rounded">
                    {log.engineId.replace("subline-", "")}
                  </span>
                  <span className="text-[10px] font-mono bg-[#fef0e7] text-[#d96b27] px-1.5 py-0.5 rounded">
                    {log.relayType.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-[#9c948a] font-mono">
                  <span>⏱️ {log.durationMs}ms</span>
                  <span>⚡ {log.tokensPerSec} t/s</span>
                  <span>📦 {log.tokensCount} tokens</span>
                  <span>{log.timestamp}</span>
                </div>
              </div>

              {log.errorMessage && (
                <div className="text-xs text-[#ef4444] font-mono bg-[#fee2e2]/60 p-2 rounded-lg break-all">
                  ❌ 异常诊断: {log.errorMessage}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
