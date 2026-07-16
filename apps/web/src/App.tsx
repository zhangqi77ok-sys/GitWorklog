const milestones = [
  "Task / LoopRun / Session 主链",
  "Session Discovery 与事件采集",
  "Evidence 与 Decision 基础模型",
  "Policy / Review / Action 治理闭环",
];

const packages = [
  "@gitworklog/shared-types",
  "@gitworklog/db",
  "@gitworklog/core",
  "@gitworklog/connectors",
  "@gitworklog/evidence",
  "@gitworklog/analyzers",
  "@gitworklog/policy",
  "@gitworklog/action-engine",
];

export function App() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Loop Engineering Control Plane</p>
        <h1>GitWorklog</h1>
        <p className="lead">
          当前仓库已切换为面向 AI 编码任务的 Loop 工程化产品。这个页面是 v1 工程骨架的起点，
          目标是先把监督、决策、审核和续跑闭环打通。
        </p>
      </section>

      <section className="panel">
        <h2>当前阶段</h2>
        <p>已经完成架构总纲、开发任务拆解、数据库草案、首批 API / IPC 契约以及 Monorepo 基础骨架。</p>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>v1 主线</h2>
          <ul>
            {milestones.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <h2>核心包</h2>
          <ul>
            {packages.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
