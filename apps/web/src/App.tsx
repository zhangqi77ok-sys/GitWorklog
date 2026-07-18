import { useEffect, useState } from "react";

import { fixtureConsoleData, loadConsoleData, type ConsoleData } from "./desktop-data";

const timeline = [
  "Task created with conservative policy",
  "Codex session bound to loop run",
  "Tool result captured assertion failure",
  "Analyzer generated resume suggestion",
  "Manual review gate opened",
];

export function App() {
  const [consoleData, setConsoleData] = useState<ConsoleData>(fixtureConsoleData);

  useEffect(() => {
    let active = true;
    void loadConsoleData(window.gitWorklog).then((data) => {
      if (active) {
        setConsoleData(data);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const signals = [
    { label: "Evidence", value: "1", caption: "来自 tool_result" },
    { label: "Decision", value: consoleData.pendingReviewCount > 0 ? "Suggest resume" : "Observe", caption: "基于失败输出" },
    {
      label: "Action",
      value: consoleData.pendingReviewCount > 0 ? "Pending" : "Ready",
      caption: consoleData.pendingReviewCount > 0 ? "等待人工审核" : "暂无待审核动作",
    },
  ];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Loop Engineering Console</p>
          <h1>GitWorklog</h1>
          <p className="lead">
            把 AI 编码会话变成可监督、可审核、可续跑的工程化闭环。v1 控制台先固定产品骨架：
            任务是中心，证据驱动判断，策略决定动作边界。
          </p>
        </div>
        <div className="hero-card">
          <span className="pulse" />
          <strong>Local control plane online</strong>
          <p>
            {consoleData.source === "desktop" ? "Desktop bridge connected" : "Browser fixture preview"} · Review gated
          </p>
        </div>
      </section>

      <section className="metrics">
        {signals.map((signal) => (
          <article className="metric-card" key={signal.label}>
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
            <p>{signal.caption}</p>
          </article>
        ))}
      </section>

      <section className="workspace-grid">
        <article className="panel task-panel">
          <div className="section-heading">
            <p className="eyebrow">Tasks</p>
            <h2>任务队列</h2>
            <span className="source-badge">
              {consoleData.source === "desktop" ? "Desktop data" : "Fixture preview"}
            </span>
          </div>
          <div className="task-list">
            {consoleData.tasks.length ? consoleData.tasks.map((task) => (
              <button className="task-card" key={task.title}>
                <span className="status-pill">{task.status}</span>
                <strong>{task.title}</strong>
                <p>{task.goal}</p>
                <small>
                  {task.run} · risk {task.risk}
                </small>
              </button>
            )) : <p className="empty-state">还没有任务。下一步会接入创建任务表单。</p>}
          </div>
        </article>

        <article className="panel detail-panel">
          <div className="section-heading">
            <p className="eyebrow">LoopRun</p>
            <h2>当前闭环</h2>
          </div>
          <div className="run-map">
            {timeline.map((item, index) => (
              <div className="run-step" key={item}>
                <span>{index + 1}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </article>

        <aside className="panel review-panel">
          <div className="section-heading">
            <p className="eyebrow">Review Gate</p>
            <h2>待审核动作</h2>
          </div>
          <div className="review-card">
            <strong>Resume with prompt</strong>
            <p>
              当前有 {consoleData.pendingReviewCount} 个待审核动作。保守策略不允许直接自动续跑，需要人工确认后再发送下一步提示。
            </p>
            <button>查看证据链</button>
          </div>
          <div className="policy-card">
            <span>Active policy</span>
            <strong>Conservative</strong>
            <p>高风险和自动续跑默认进入人工审核。</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
