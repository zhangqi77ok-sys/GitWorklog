import { FormEvent, useEffect, useState } from "react";

import {
  bindSessionToLoopRun,
  decideReview,
  discoverSessions,
  ingestSessionEvents,
  fixtureConsoleData,
  loadConsoleData,
  loadLoopSnapshot,
  submitTaskDraft,
  type ConsoleData,
  type ConsoleLoopSnapshot,
  type ConsoleSessionItem,
  type ConsoleTaskItem,
} from "./desktop-data";

const navItems = ["Tasks", "Loop Detail", "Review Queue", "Policy Center", "Replay"];

const timeline = [
  { title: "Task", detail: "目标和约束进入本地控制面" },
  { title: "Session", detail: "Codex 会话绑定到当前 LoopRun" },
  { title: "Evidence", detail: "工具结果、错误和停顿信号被归档" },
  { title: "Decision", detail: "分析器生成风险判断和下一步建议" },
  { title: "Review", detail: "策略决定是否需要人工确认" },
];

export function App() {
  const [consoleData, setConsoleData] = useState<ConsoleData>(fixtureConsoleData);
  const [selectedTaskId, setSelectedTaskId] = useState<string>(fixtureConsoleData.tasks[0]?.id ?? "");
  const [loopSnapshot, setLoopSnapshot] = useState<ConsoleLoopSnapshot | undefined>();
  const [discoveredSessions, setDiscoveredSessions] = useState<ConsoleSessionItem[]>([]);
  const [draft, setDraft] = useState({ title: "", goal: "", risk: "medium" });
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState("桌面控制台已就绪");

  async function refreshConsoleData() {
    const data = await loadConsoleData(window.gitWorklog);
    setConsoleData(data);
    setSelectedTaskId((current) => current || data.tasks[0]?.id || "");
    return data;
  }

  useEffect(() => {
    let active = true;
    void loadConsoleData(window.gitWorklog).then((data) => {
      if (active) {
        setConsoleData(data);
        setSelectedTaskId(data.tasks[0]?.id ?? "");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const selectedTask = consoleData.tasks.find((task) => task.id === selectedTaskId) ?? consoleData.tasks[0];

  useEffect(() => {
    let active = true;
    void loadLoopSnapshot(window.gitWorklog, selectedTask?.loopRunId).then((snapshot) => {
      if (active) {
        setLoopSnapshot(snapshot);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedTask?.loopRunId]);

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.goal.trim()) {
      setNotice("请先填写任务标题和目标");
      return;
    }

    setIsBusy(true);
    const data = await submitTaskDraft(window.gitWorklog, draft);
    setConsoleData(data);
    setSelectedTaskId(data.tasks[0]?.id ?? "");
    setDraft({ title: "", goal: "", risk: "medium" });
    setNotice(data.source === "desktop" ? "任务已创建并写入本地数据库" : "当前是浏览器预览，未写入本地数据库");
    setIsBusy(false);
  }

  async function handleDiscoverSessions() {
    setIsBusy(true);
    const sessions = await discoverSessions(window.gitWorklog);
    setDiscoveredSessions(sessions);
    setNotice(sessions.length ? `发现 ${sessions.length} 个 Codex 会话` : "没有发现可绑定的 Codex 会话");
    setIsBusy(false);
  }

  async function handleBindSession(session: ConsoleSessionItem) {
    if (!selectedTask?.loopRunId) {
      setNotice("当前任务没有可绑定的 LoopRun");
      return;
    }

    setIsBusy(true);
    await bindSessionToLoopRun(window.gitWorklog, selectedTask.loopRunId, session);
    await refreshConsoleData();
    const snapshot = await loadLoopSnapshot(window.gitWorklog, selectedTask.loopRunId);
    setLoopSnapshot(snapshot);
    setNotice(`已绑定会话：${session.title}`);
    setIsBusy(false);
  }

  async function handleIngestSession(session: ConsoleSessionItem) {
    if (!selectedTask?.loopRunId) {
      setNotice("当前任务没有可导入事件的 LoopRun");
      return;
    }

    setIsBusy(true);
    const result = await ingestSessionEvents(window.gitWorklog, selectedTask.loopRunId, session.sessionId);
    const snapshot = await loadLoopSnapshot(window.gitWorklog, selectedTask.loopRunId);
    setLoopSnapshot(snapshot);
    const importedCount =
      typeof result === "object" && result !== null && "importedCount" in result
        ? Number(result.importedCount)
        : 0;
    setNotice(importedCount ? `已导入 ${importedCount} 条会话事件` : "没有导入新的会话事件");
    setIsBusy(false);
  }

  async function handleReview(reviewId: string, result: "approved" | "rejected") {
    setIsBusy(true);
    await decideReview(window.gitWorklog, reviewId, result);
    const data = await refreshConsoleData();
    setNotice(
      data.source === "desktop"
        ? result === "approved"
          ? "审核已批准，Action 状态已更新"
          : "审核已拒绝，Action 状态已更新"
        : "当前是浏览器预览，审核动作不会写入本地数据库",
    );
    setIsBusy(false);
  }

  return (
    <main className="desktop-shell">
      <aside className="side-rail">
        <div className="brand-mark">
          <span>GW</span>
          <div>
            <strong>GitWorklog</strong>
            <small>Loop Control Plane</small>
          </div>
        </div>

        <nav className="nav-stack" aria-label="Primary">
          {navItems.map((item, index) => (
            <button className={index === 0 ? "nav-item active" : "nav-item"} key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item}
            </button>
          ))}
        </nav>

        <div className="rail-card">
          <span className="rail-dot" />
          <strong>{consoleData.source === "desktop" ? "Desktop bridge connected" : "Fixture preview"}</strong>
          <p>{notice}</p>
        </div>
      </aside>

      <section className="workbench">
        <header className="top-bar">
          <div>
            <p className="eyebrow">Desktop UX Phase</p>
            <h1>任务驱动的 Loop 工作台</h1>
          </div>
          <button className="ghost-button" disabled={isBusy} onClick={() => void refreshConsoleData()}>
            刷新本地状态
          </button>
        </header>

        <section className="summary-strip">
          <Metric label="Tasks" value={String(consoleData.tasks.length)} caption="当前任务队列" />
          <Metric label="Reviews" value={String(consoleData.pendingReviewCount)} caption="待人工审核" />
          <Metric label="Sessions" value={String(loopSnapshot?.sessionsCount ?? 0)} caption="当前 Loop 绑定" />
        </section>

        <section className="workspace-layout">
          <article className="panel task-zone">
            <div className="section-heading">
              <p className="eyebrow">Task Runs</p>
              <h2>任务队列</h2>
            </div>

            <form className="task-form" onSubmit={handleCreateTask}>
              <label>
                任务标题
                <input
                  placeholder="例如：修复桌面空白页"
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                />
              </label>
              <label>
                成功目标
                <textarea
                  placeholder="描述这个 Loop 完成后应该达成什么"
                  value={draft.goal}
                  onChange={(event) => setDraft((current) => ({ ...current, goal: event.target.value }))}
                />
              </label>
              <div className="form-row">
                <label>
                  风险
                  <select
                    value={draft.risk}
                    onChange={(event) => setDraft((current) => ({ ...current, risk: event.target.value }))}
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </label>
                <button disabled={isBusy} type="submit">
                  创建 Task + LoopRun
                </button>
              </div>
            </form>

            <div className="task-list">
              {consoleData.tasks.length ? (
                consoleData.tasks.map((task) => (
                  <TaskCard
                    isSelected={task.id === selectedTask?.id}
                    key={task.id}
                    onSelect={() => setSelectedTaskId(task.id)}
                    task={task}
                  />
                ))
              ) : (
                <p className="empty-state">还没有任务。先创建一个任务，让控制台有明确监督对象。</p>
              )}
            </div>
          </article>

          <article className="panel loop-zone">
            <div className="section-heading">
              <p className="eyebrow">Loop Detail</p>
              <h2>{selectedTask?.title ?? "等待选择任务"}</h2>
            </div>
            <p className="loop-goal">{selectedTask?.goal ?? "选择左侧任务后，这里会展示目标、证据链和下一步动作。"}</p>

            <div className="snapshot-grid">
              <Metric label="Events" value={String(loopSnapshot?.eventsCount ?? 0)} caption="会话事件" />
              <Metric label="Evidence" value={String(loopSnapshot?.evidencesCount ?? 0)} caption="证据条目" />
              <Metric label="Decision" value={String(loopSnapshot?.decisionsCount ?? 0)} caption="决策记录" />
              <Metric label="Action" value={String(loopSnapshot?.actionsCount ?? 0)} caption="动作记录" />
            </div>

            <div className="bound-sessions">
              <div className="section-heading compact">
                <p className="eyebrow">Session State</p>
                <h3>绑定会话状态</h3>
              </div>
              {loopSnapshot?.sessions.length ? (
                loopSnapshot.sessions.map((session) => (
                  <article className="bound-session-card" key={session.sessionId}>
                    <span className={`status-pill status-${session.status}`}>{session.status}</span>
                    <strong>{session.title}</strong>
                    <p>{session.projectPath ?? "未识别项目路径"}</p>
                  </article>
                ))
              ) : (
                <p className="empty-state">绑定并导入会话后，这里会显示 running / failed 等基础状态。</p>
              )}
            </div>

            <div className="event-timeline">
              <div className="section-heading compact">
                <p className="eyebrow">Replay Seed</p>
                <h3>最近会话事件</h3>
              </div>
              {loopSnapshot?.timeline.length ? (
                loopSnapshot.timeline.map((event) => (
                  <article className="event-card" key={event.id}>
                    <span>{event.createdAt ?? "未知时间"}</span>
                    <strong>{event.title}</strong>
                    <p>{event.detail}</p>
                  </article>
                ))
              ) : (
                <p className="empty-state">绑定会话并写入事件后，这里会形成可回放的 Loop 时间线。</p>
              )}
            </div>

            <div className="run-map">
              {timeline.map((step, index) => (
                <div className="run-step" key={step.title}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </section>

      <aside className="inspector">
        <section className="panel sessions-panel">
          <div className="section-heading">
            <p className="eyebrow">Session Discovery</p>
            <h2>Codex 会话</h2>
          </div>
          <button className="ghost-button full-width" disabled={isBusy} onClick={() => void handleDiscoverSessions()}>
            扫描本地会话
          </button>
          <div className="session-list">
            {discoveredSessions.length ? (
              discoveredSessions.map((session) => (
                <article className="session-card" key={session.sessionId}>
                  <strong>{session.title}</strong>
                  <p>{session.projectPath ?? "未识别项目路径"}</p>
                  <small>{session.lastEventAt ?? "未知活跃时间"}</small>
                  <button disabled={isBusy} onClick={() => void handleBindSession(session)}>
                    绑定到当前 Loop
                  </button>
                  <button disabled={isBusy} onClick={() => void handleIngestSession(session)}>
                    导入事件到时间线
                  </button>
                </article>
              ))
            ) : (
              <p className="empty-state">点击扫描后，这里会显示本机可发现的 Codex 会话。</p>
            )}
          </div>
        </section>

        <section className="panel review-panel">
          <div className="section-heading">
            <p className="eyebrow">Review Queue</p>
            <h2>待审核动作</h2>
          </div>

          {consoleData.reviews.length ? (
            <div className="review-list">
              {consoleData.reviews.map((review) => (
                <article className="review-card" key={review.reviewId}>
                  <span className="status-pill">{review.result}</span>
                  <strong>Action {review.actionId.slice(0, 8)}</strong>
                  <p>{review.comment ?? "策略要求人工确认后再继续。"}</p>
                  <div className="review-actions">
                    <button disabled={isBusy} onClick={() => void handleReview(review.reviewId, "approved")}>
                      批准
                    </button>
                    <button disabled={isBusy} onClick={() => void handleReview(review.reviewId, "rejected")}>
                      拒绝
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">暂无待审核动作。系统会在高风险或保守策略触发时把动作放到这里。</p>
          )}
        </section>

        <section className="panel policy-panel">
          <p className="eyebrow">Policy</p>
          <h2>Conservative</h2>
          <p>默认不直接自动续跑。涉及恢复提示或高风险动作时，先进入 Review Queue。</p>
        </section>
      </aside>
    </main>
  );
}

function Metric(props: { label: string; value: string; caption: string }) {
  return (
    <article className="metric-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <p>{props.caption}</p>
    </article>
  );
}

function TaskCard(props: { task: ConsoleTaskItem; isSelected: boolean; onSelect(): void }) {
  return (
    <button className={props.isSelected ? "task-card selected" : "task-card"} onClick={props.onSelect}>
      <span className="status-pill">{props.task.status}</span>
      <strong>{props.task.title}</strong>
      <p>{props.task.goal}</p>
      <small>
        {props.task.run} · risk {props.task.risk}
      </small>
    </button>
  );
}
