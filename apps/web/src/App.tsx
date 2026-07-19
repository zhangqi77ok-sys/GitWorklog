import { FormEvent, useEffect, useState } from "react";

import {
  bindSessionToLoopRun,
  decideReview,
  discoverSessions,
  ingestSessionEvents,
  fixtureConsoleData,
  loadConsoleData,
  loadLoopSnapshot,
  runLoopAnalysis,
  submitTaskDraft,
  type ConsoleAuditTrailItem,
  type ConsoleData,
  type ConsoleLoopSnapshot,
  type ConsoleSessionItem,
  type ConsoleTaskItem,
} from "./desktop-data";
import {
  buildReplayAuditState,
  filterReplayAuditEntries,
  selectReplayAuditEntry,
  selectReplayAuditFilter,
  selectReplayAuditRelatedEntry,
  type ReplayAuditFilter,
  type ReplayAuditState,
} from "./replay-audit-state";
import {
  loadPolicyCenterState,
  savePolicyCenterState,
  selectPolicy,
  setRulePriority,
  togglePolicyEnabled,
  toggleRuleEnabled,
  updatePolicyAutoResume,
  type PolicyCenterState,
} from "./policy-center-state";
import { buildReviewQueueState, selectReview, type ReviewQueueState } from "./review-queue-state";

const navItems = ["任务", "循环详情", "审核队列", "策略中心", "回放审计"];
type NavItem = (typeof navItems)[number];

const navHashMap: Record<NavItem, string> = {
  任务: "tasks",
  循环详情: "loop-detail",
  审核队列: "review-queue",
  策略中心: "policy-center",
  回放审计: "replay-audit",
};

const timeline = [
  { title: "任务建档", detail: "目标和约束进入本地控制面" },
  { title: "会话绑定", detail: "Codex 会话绑定到当前循环" },
  { title: "证据归档", detail: "工具结果、错误和停顿信号被归档" },
  { title: "风险判断", detail: "分析器生成风险判断和下一步建议" },
  { title: "人工审核", detail: "策略决定是否需要人工确认" },
];

const riskLabels: Record<string, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

const statusLabels: Record<string, string> = {
  created: "已创建",
  running: "运行中",
  needs_review: "待审核",
  approved: "已批准",
  rejected: "已拒绝",
  failed: "失败",
  completed: "已完成",
  watching: "观察中",
  draft: "草稿",
  pending: "待处理",
};

const policyLabels: Record<string, string> = {
  conservative_loop: "保守续跑",
  conservative: "保守策略",
  assist_loop: "辅助续跑",
  strict_review: "严格审核",
};

const replayAuditFilters: { filter: ReplayAuditFilter; label: string }[] = [
  { filter: "all", label: "全部" },
  { filter: "event", label: "事件" },
  { filter: "evidence", label: "证据" },
  { filter: "decision", label: "决策" },
  { filter: "action", label: "动作" },
  { filter: "review", label: "审核" },
];

function labelFromMap(map: Record<string, string>, value?: string, fallback = "暂无") {
  if (!value) {
    return fallback;
  }

  const normalizedValue = value.toLowerCase().replace(/[\s-]+/g, "_");
  return map[normalizedValue] ?? value.replace(/_/g, " ");
}

export function App() {
  const [consoleData, setConsoleData] = useState<ConsoleData>(fixtureConsoleData);
  const [selectedTaskId, setSelectedTaskId] = useState<string>(fixtureConsoleData.tasks[0]?.id ?? "");
  const [loopSnapshot, setLoopSnapshot] = useState<ConsoleLoopSnapshot | undefined>();
  const [discoveredSessions, setDiscoveredSessions] = useState<ConsoleSessionItem[]>([]);
  const [draft, setDraft] = useState({ title: "", goal: "", risk: "medium" });
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState("桌面控制台已就绪");
  const [isReviewPanelOpen, setIsReviewPanelOpen] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState<NavItem>(() => navItemFromHash(window.location.hash));
  const [policyState, setPolicyState] = useState<PolicyCenterState>(() => loadPolicyState());
  const [reviewState, setReviewState] = useState<ReviewQueueState>(() =>
    buildReviewQueueState(fixtureConsoleData.reviews, []),
  );
  const [replayState, setReplayState] = useState<ReplayAuditState>(() => buildReplayAuditState([]));

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

  function handleSelectNavItem(item: NavItem) {
    setActiveNavItem(item);
    window.history.replaceState(null, "", `#${navHashMap[item]}`);
  }

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

  useEffect(() => {
    savePolicyCenterState(window.localStorage, policyState);
  }, [policyState]);

  useEffect(() => {
    setReviewState(buildReviewQueueState(consoleData.reviews, loopSnapshot?.actions ?? []));
  }, [consoleData.reviews, loopSnapshot?.actions]);

  useEffect(() => {
    setReplayState((current) => selectReplayAuditFilter(current, current.filter, loopSnapshot?.auditTrail ?? []));
  }, [loopSnapshot?.auditTrail]);

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
      setNotice("当前任务没有可绑定的循环");
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
      setNotice("当前任务没有可导入事件的循环");
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

  async function handleRunAnalysis() {
    if (!selectedTask?.loopRunId) {
      setNotice("当前任务没有可分析的循环");
      return;
    }

    setIsBusy(true);
    const result = await runLoopAnalysis(window.gitWorklog, selectedTask.loopRunId);
    await refreshConsoleData();
    const snapshot = await loadLoopSnapshot(window.gitWorklog, selectedTask.loopRunId);
    setLoopSnapshot(snapshot);
    const requiresReview =
      typeof result === "object" && result !== null && "requiresReview" in result
        ? Boolean(result.requiresReview)
        : false;
    setNotice(requiresReview ? "分析完成，已生成待审核动作" : "分析完成，已更新证据和动作");
    setIsBusy(false);
  }

  async function handleReview(reviewId: string, result: "approved" | "rejected") {
    setIsBusy(true);
    await decideReview(window.gitWorklog, reviewId, result);
    const data = await refreshConsoleData();
    const snapshot = await loadLoopSnapshot(window.gitWorklog, selectedTask?.loopRunId);
    if (snapshot) {
      setLoopSnapshot(snapshot);
    }
    setNotice(
      data.source === "desktop"
        ? result === "approved"
          ? "审核已批准，动作状态已更新"
          : "审核已拒绝，动作状态已更新"
        : "当前是浏览器预览，审核动作不会写入本地数据库",
    );
    setIsBusy(false);
  }

  function handleSelectReview(reviewId: string) {
    setReviewState((current) => selectReview(current, reviewId));
  }

  function handleSelectReplayAuditFilter(filter: ReplayAuditFilter) {
    setReplayState((current) => selectReplayAuditFilter(current, filter, loopSnapshot?.auditTrail ?? []));
  }

  function handleSelectReplayAuditEntry(entryId: string) {
    setReplayState((current) => selectReplayAuditEntry(current, entryId, loopSnapshot?.auditTrail ?? []));
  }

  function handleInspectReviewContext(actionId: string) {
    const auditTrail = loopSnapshot?.auditTrail ?? [];
    setReplayState((current) => selectReplayAuditRelatedEntry(current, actionId, auditTrail));
    setActiveNavItem("回放审计");
    window.history.replaceState(null, "", `#${navHashMap["回放审计"]}`);
    setNotice(auditTrail.length ? "已跳转到回放审计上下文" : "当前循环还没有可回放的审计记录");
  }

  function handleSelectPolicy(policyId: string) {
    setPolicyState((current) => {
      const next = selectPolicy(current, policyId);
      setNotice(`已切换默认策略：${policyLabelFromState(next, policyId)}`);
      return next;
    });
  }

  function handleTogglePolicy(policyId: string) {
    setPolicyState((current) => togglePolicyEnabled(current, policyId));
  }

  function handleToggleRule(ruleId: string) {
    setPolicyState((current) => toggleRuleEnabled(current, ruleId));
  }

  function handleRulePriority(ruleId: string, delta: number) {
    setPolicyState((current) => {
      const rule = current.rules.find((candidate) => candidate.ruleId === ruleId);
      return rule ? setRulePriority(current, ruleId, rule.priority + delta) : current;
    });
  }

  function handlePolicyAutoResume(policyId: string, enabled: boolean, limit: number) {
    setPolicyState((current) => updatePolicyAutoResume(current, policyId, enabled, limit));
  }

  return (
    <main className="desktop-shell">
      <aside className="side-rail">
        <div className="brand-mark">
          <span>GW</span>
          <div>
            <strong>GitWorklog</strong>
            <small>循环工程控制台</small>
          </div>
        </div>

        <nav className="nav-stack" aria-label="主导航">
          {navItems.map((item, index) => (
            <button
              className={item === activeNavItem ? "nav-item active" : "nav-item"}
              key={item}
              onClick={() => handleSelectNavItem(item)}
              type="button"
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item}
            </button>
          ))}
        </nav>

        <div className="rail-card">
          <span className="rail-dot" />
          <strong>{consoleData.source === "desktop" ? "桌面桥接已连接" : "预览数据模式"}</strong>
          <p>{notice}</p>
        </div>
      </aside>

      <section className="workbench">
        <header className="top-bar">
          <div>
            <p className="eyebrow">桌面体验阶段</p>
            <h1>任务驱动的循环工作台</h1>
          </div>
          <button className="ghost-button" disabled={isBusy} onClick={() => void refreshConsoleData()}>
            刷新本地状态
          </button>
        </header>

        <section className="summary-strip top-summary">
          <Metric label="任务" value={String(consoleData.tasks.length)} caption="当前任务队列" />
          <Metric label="审核" value={String(consoleData.pendingReviewCount)} caption="待人工审核" />
          <Metric label="会话" value={String(loopSnapshot?.sessionsCount ?? 0)} caption="当前循环绑定" />
        </section>

        <div className="status-strip">
          <button
            className={consoleData.pendingReviewCount ? "review-alert" : "review-alert quiet"}
            onClick={() => setIsReviewPanelOpen((current) => !current)}
            type="button"
          >
            <span>{consoleData.pendingReviewCount}</span>
            <strong>{consoleData.pendingReviewCount ? "待审核" : "无审核"}</strong>
          </button>
          <p>{notice}</p>
        </div>

        {activeNavItem === "回放审计" ? (
          <ReplayAuditView
            auditTrail={loopSnapshot?.auditTrail ?? []}
            onSelectEntry={handleSelectReplayAuditEntry}
            onSelectFilter={handleSelectReplayAuditFilter}
            replayState={replayState}
            selectedTask={selectedTask}
            snapshot={loopSnapshot}
          />
        ) : activeNavItem === "审核队列" ? (
          <ReviewQueueView
            isBusy={isBusy}
            onApprove={(reviewId) => void handleReview(reviewId, "approved")}
            onInspectContext={handleInspectReviewContext}
            onReject={(reviewId) => void handleReview(reviewId, "rejected")}
            onSelectReview={handleSelectReview}
            reviewState={reviewState}
            selectedTask={selectedTask}
            snapshot={loopSnapshot}
          />
        ) : activeNavItem === "策略中心" ? (
          <PolicyCenterView
            onPolicyAutoResume={handlePolicyAutoResume}
            onSelectPolicy={handleSelectPolicy}
            onTogglePolicy={handleTogglePolicy}
            onToggleRule={handleToggleRule}
            onRulePriority={handleRulePriority}
            policyState={policyState}
          />
        ) : activeNavItem === "任务" || activeNavItem === "循环详情" ? (
          <section className="workbench-canvas">
            <article className="panel loop-zone">
            <div className="cockpit-header">
              <div>
                <p className="eyebrow">当前循环</p>
                <h2>{selectedTask?.title ?? "等待选择任务"}</h2>
              </div>
              <div className="cockpit-signals">
                <span className="status-pill">
                  {labelFromMap(statusLabels, loopSnapshot?.status ?? selectedTask?.status, "未启动")}
                </span>
                <span className="status-pill risk-signal">{labelFromMap(riskLabels, selectedTask?.risk, "未评估风险")}</span>
                <span className="status-pill policy-signal">{labelFromMap(policyLabels, selectedTask?.run, "未设置策略")}</span>
              </div>
            </div>
            <p className="loop-goal">{selectedTask?.goal ?? "选择左侧任务后，这里会展示目标、证据链和下一步动作。"}</p>
            <button className="ghost-button analysis-button primary-command" disabled={isBusy} onClick={() => void handleRunAnalysis()}>
              运行当前循环分析
            </button>

            <div className="snapshot-grid">
              <Metric label="事件" value={String(loopSnapshot?.eventsCount ?? 0)} caption="会话事件" />
              <Metric label="证据" value={String(loopSnapshot?.evidencesCount ?? 0)} caption="证据条目" />
              <Metric label="决策" value={String(loopSnapshot?.decisionsCount ?? 0)} caption="决策记录" />
              <Metric label="动作" value={String(loopSnapshot?.actionsCount ?? 0)} caption="动作记录" />
            </div>

            <div className="event-timeline mission-timeline">
              <div className="section-heading compact">
                <p className="eyebrow">任务时间线</p>
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

            <div className="bound-sessions">
              <div className="section-heading compact">
                <p className="eyebrow">会话状态</p>
                <h3>绑定会话状态</h3>
              </div>
              {loopSnapshot?.sessions.length ? (
                loopSnapshot.sessions.map((session) => (
                  <article className="bound-session-card" key={session.sessionId}>
                    <span className={`status-pill status-${session.status}`}>
                      {labelFromMap(statusLabels, session.status, "未知状态")}
                    </span>
                    <strong>{session.title}</strong>
                    <p>{session.projectPath ?? "未识别项目路径"}</p>
                  </article>
                ))
              ) : (
                <p className="empty-state">绑定并导入会话后，这里会显示运行中、失败等基础状态。</p>
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

            <article className="panel task-zone">
            <div className="section-heading">
              <p className="eyebrow">任务运行</p>
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
                  placeholder="描述这个循环完成后应该达成什么"
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
                    <option value="low">低风险</option>
                    <option value="medium">中风险</option>
                    <option value="high">高风险</option>
                  </select>
                </label>
                <button disabled={isBusy} type="submit">
                  创建任务并启动循环
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
 
            <section className="panel sessions-panel">
            <div className="section-heading">
              <p className="eyebrow">会话发现</p>
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
                      绑定到当前循环
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

            <section className="panel policy-panel">
            <p className="eyebrow">策略</p>
            <h2>保守续跑</h2>
            <p>默认不直接自动续跑。涉及恢复提示或高风险动作时，先通过顶部消息提醒进入审核。</p>
          </section>

          {isReviewPanelOpen ? (
            <section className="panel review-drawer" id="review-center">
              <div className="section-heading">
                <p className="eyebrow">审核提醒</p>
                <h2>待审核动作</h2>
              </div>
              {consoleData.reviews.length ? (
                <div className="review-list">
                  {consoleData.reviews.map((review) => (
                    <article className="review-card" key={review.reviewId}>
                      <span className="status-pill">{labelFromMap(statusLabels, review.result, "待处理")}</span>
                      <strong>动作 {review.actionId.slice(0, 8)}</strong>
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
                <p className="empty-state">当前没有待审核动作。高风险动作会先在这里提醒你确认。</p>
              )}
            </section>
          ) : null}
          </section>
        ) : (
          <WorkbenchPlaceholder activeNavItem={activeNavItem} />
        )}
      </section>
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
      <span className="status-pill">{labelFromMap(statusLabels, props.task.status, "未知状态")}</span>
      <strong>{props.task.title}</strong>
      <p>{props.task.goal}</p>
      <small>
        {labelFromMap(policyLabels, props.task.run, "未设置策略")} · {labelFromMap(riskLabels, props.task.risk, "未评估风险")}
      </small>
    </button>
  );
}

function ReplayAuditView(props: {
  auditTrail: ConsoleAuditTrailItem[];
  replayState: ReplayAuditState;
  selectedTask: ConsoleTaskItem | undefined;
  snapshot: ConsoleLoopSnapshot | undefined;
  onSelectEntry(entryId: string): void;
  onSelectFilter(filter: ReplayAuditFilter): void;
}) {
  const visibleAuditTrail = filterReplayAuditEntries(props.auditTrail, props.replayState.filter);
  const selectedEntry =
    props.auditTrail.find((entry) => entry.id === props.replayState.selectedEntryId) ?? visibleAuditTrail[0];
  return (
    <section className="replay-workbench">
      <article className="panel replay-hero">
        <div>
          <p className="eyebrow">回放审计</p>
          <h2>{props.selectedTask?.title ?? "等待选择任务"}</h2>
          <p>把当前 Loop 的会话事件、证据、决策、动作和审核结果串成一条可检查链路。</p>
        </div>
        <div className="replay-summary">
          <Metric label="事件" value={String(props.snapshot?.eventsCount ?? 0)} caption="会话输入" />
          <Metric label="证据" value={String(props.snapshot?.evidencesCount ?? 0)} caption="结构化依据" />
          <Metric label="决策" value={String(props.snapshot?.decisionsCount ?? 0)} caption="分析判断" />
          <Metric label="动作" value={String(props.snapshot?.actionsCount ?? 0)} caption="建议/执行" />
        </div>
      </article>

      <article className="panel replay-chain">
        <div className="section-heading">
          <p className="eyebrow">审计链路</p>
          <h2>最近记录</h2>
        </div>
        <div className="audit-filter-row" aria-label="审计筛选">
          {replayAuditFilters.map((item) => (
            <button
              className={item.filter === props.replayState.filter ? "audit-filter active" : "audit-filter"}
              key={item.filter}
              onClick={() => props.onSelectFilter(item.filter)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        {visibleAuditTrail.length ? (
          <div className="audit-list">
            {visibleAuditTrail.map((entry) => (
              <button
                className={
                  entry.id === selectedEntry?.id
                    ? `audit-entry audit-${entry.kind} selected`
                    : `audit-entry audit-${entry.kind}`
                }
                key={`${entry.kind}-${entry.id}`}
                onClick={() => props.onSelectEntry(entry.id)}
                type="button"
              >
                <span className="audit-kind">{auditKindLabels[entry.kind]}</span>
                <div>
                  <strong>{entry.title}</strong>
                  <p>{entry.detail}</p>
                  <small>
                    {entry.createdAt ?? "未知时间"}
                    {entry.meta ? ` · ${entry.meta}` : ""}
                  </small>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-state">当前筛选下没有可回放记录。可以切回“全部”，或先导入事件并运行分析。</p>
        )}
      </article>

      <article className="panel replay-detail-panel">
        <div className="section-heading">
          <p className="eyebrow">详情</p>
          <h2>选中记录</h2>
        </div>
        {selectedEntry ? (
          <div className={`replay-detail-card audit-${selectedEntry.kind}`}>
            <span className="audit-kind">{auditKindLabels[selectedEntry.kind]}</span>
            <strong>{selectedEntry.title}</strong>
            <p>{selectedEntry.detail}</p>
            <div className="replay-detail-meta">
              <span>记录编号：{selectedEntry.id}</span>
              <span>时间：{selectedEntry.createdAt ?? "未知时间"}</span>
              <span>关联：{selectedEntry.meta ?? "暂无关联元数据"}</span>
            </div>
          </div>
        ) : (
          <p className="empty-state">选中一条审计记录后，这里会展示更完整的上下文。</p>
        )}
      </article>
    </section>
  );
}

function WorkbenchPlaceholder(props: { activeNavItem: NavItem }) {
  return (
    <section className="placeholder-workbench">
      <article className="panel placeholder-panel">
        <p className="eyebrow">模块规划中</p>
        <h2>{props.activeNavItem}</h2>
        <p>这个导航项会在后续阶段扩展为独立模块。当前窗口先保持单页覆盖，不用弹出额外窗口。</p>
      </article>
    </section>
  );
}

function PolicyCenterView(props: {
  policyState: PolicyCenterState;
  onSelectPolicy(policyId: string): void;
  onTogglePolicy(policyId: string): void;
  onPolicyAutoResume(policyId: string, enabled: boolean, limit: number): void;
  onToggleRule(ruleId: string): void;
  onRulePriority(ruleId: string, delta: number): void;
}) {
  const selectedPolicy = props.policyState.policies.find((policy) => policy.policyId === props.policyState.selectedPolicyId);
  const enabledRuleCount = props.policyState.rules.filter((rule) => rule.enabled).length;
  return (
    <section className="policy-workbench">
      <article className="panel policy-hero">
        <div>
          <p className="eyebrow">策略中心</p>
          <h2>默认策略与审核规则</h2>
          <p>把默认使用的策略、自动续跑上限和审核规则都收在一个窗口里，避免跑到别的页面里找设置。</p>
        </div>
        <div className="policy-summary">
          <Metric label="策略" value={String(props.policyState.policies.length)} caption="内置策略" />
          <Metric label="规则" value={String(props.policyState.rules.length)} caption="内置规则" />
          <Metric label="启用" value={String(enabledRuleCount)} caption="当前启用规则" />
          <Metric label="默认" value={selectedPolicy?.name ?? "未知"} caption="当前选中策略" />
        </div>
      </article>

      <article className="panel policy-grid">
        <div className="section-heading">
          <p className="eyebrow">内置策略</p>
          <h2>选择默认使用哪个</h2>
        </div>
        <div className="policy-card-grid">
          {props.policyState.policies.map((policy) => (
            <article className={policy.policyId === props.policyState.selectedPolicyId ? "policy-card selected" : "policy-card"} key={policy.policyId}>
              <div className="policy-card-head">
                <div>
                  <strong>{policy.name}</strong>
                  <p>{policy.description}</p>
                </div>
                <span className={policy.enabled ? "status-pill" : "status-pill status-failed"}>{policy.enabled ? "启用" : "停用"}</span>
              </div>
              <div className="policy-card-meta">
                <span>模式：{policy.mode}</span>
                <span>自动续跑：{policy.autoResumeEnabled ? `开 / ${policy.autoResumeLimit}` : "关"}</span>
              </div>
              <div className="policy-card-actions">
                <button onClick={() => props.onSelectPolicy(policy.policyId)} type="button">
                  设为默认
                </button>
                <button onClick={() => props.onTogglePolicy(policy.policyId)} type="button">
                  {policy.enabled ? "停用" : "启用"}
                </button>
              </div>
              <div className="policy-card-footer">
                <label>
                  自动续跑
                  <button onClick={() => props.onPolicyAutoResume(policy.policyId, !policy.autoResumeEnabled, policy.autoResumeLimit)} type="button">
                    {policy.autoResumeEnabled ? "关闭" : "开启"}
                  </button>
                </label>
                <label>
                  上限
                  <input
                    min="0"
                    max="9"
                    type="number"
                    value={policy.autoResumeLimit}
                    onChange={(event) =>
                      props.onPolicyAutoResume(policy.policyId, policy.autoResumeEnabled, Number(event.target.value))
                    }
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      </article>

      <article className="panel policy-rules">
        <div className="section-heading">
          <p className="eyebrow">审核规则</p>
          <h2>管理默认规则</h2>
        </div>
        <div className="policy-rule-list">
          {props.policyState.rules.map((rule) => (
            <article className="policy-rule-card" key={rule.ruleId}>
              <div>
                <strong>{rule.title}</strong>
                <p>{rule.description}</p>
              </div>
              <div className="policy-rule-meta">
                <span>{rule.severity === "high" ? "高风险" : rule.severity === "medium" ? "中风险" : "低风险"}</span>
                <span>优先级 {rule.priority}</span>
              </div>
              <div className="policy-rule-actions">
                <button onClick={() => props.onToggleRule(rule.ruleId)} type="button">
                  {rule.enabled ? "停用" : "启用"}
                </button>
                <button onClick={() => props.onRulePriority(rule.ruleId, -5)} type="button">
                  上移
                </button>
                <button onClick={() => props.onRulePriority(rule.ruleId, 5)} type="button">
                  下移
                </button>
              </div>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}

function ReviewQueueView(props: {
  reviewState: ReviewQueueState;
  snapshot: ConsoleLoopSnapshot | undefined;
  selectedTask: ConsoleTaskItem | undefined;
  isBusy: boolean;
  onSelectReview(reviewId: string): void;
  onInspectContext(actionId: string): void;
  onApprove(reviewId: string): void;
  onReject(reviewId: string): void;
}) {
  const selectedReview =
    props.reviewState.items.find((item) => item.reviewId === props.reviewState.selectedReviewId) ?? props.reviewState.items[0];
  return (
    <section className="review-workbench">
      <article className="panel review-hero-panel">
        <div>
          <p className="eyebrow">审核队列</p>
          <h2>待人工确认动作</h2>
          <p>这里把当前 Loop 的待审核动作单独拉出来，方便你逐条处理，不用在别的页面里找。</p>
        </div>
        <div className="review-hero-summary">
          <Metric label="待审" value={String(props.reviewState.items.length)} caption="当前队列" />
          <Metric label="循环" value={props.selectedTask?.title ?? "未选择"} caption="当前任务" />
          <Metric label="事件" value={String(props.snapshot?.eventsCount ?? 0)} caption="链路上下文" />
          <Metric label="规则" value={String(props.snapshot?.pendingReviewsCount ?? 0)} caption="待审动作" />
        </div>
      </article>

      <article className="panel review-queue-layout">
        <div className="review-queue-list">
          <div className="section-heading">
            <p className="eyebrow">队列</p>
            <h2>最新审核项</h2>
          </div>
          {props.reviewState.items.length ? (
            props.reviewState.items.map((item) => (
              <button
                className={item.reviewId === selectedReview?.reviewId ? "review-queue-card selected" : "review-queue-card"}
                key={item.reviewId}
                onClick={() => props.onSelectReview(item.reviewId)}
                type="button"
              >
                <span className="status-pill">{labelFromMap(statusLabels, item.result, "待处理")}</span>
                <strong>{item.actionTitle}</strong>
                <p>{item.comment ?? item.actionMessage}</p>
                <small>
                  {item.actionStatus} · {item.requiresReview ? "需要审核" : "可直接通过"}
                </small>
              </button>
            ))
          ) : (
            <p className="empty-state">当前没有待审核动作。分析器触发审核后，这里会出现条目。</p>
          )}
        </div>

        <div className="review-queue-detail">
          <div className="section-heading">
            <p className="eyebrow">详情</p>
            <h2>审核说明</h2>
          </div>
          {selectedReview ? (
            <article className="review-detail-card">
              <strong>{selectedReview.actionTitle}</strong>
              <p>{selectedReview.comment ?? "策略要求人工确认后再继续。"}</p>
              <div className="review-detail-meta">
                <span>动作状态：{selectedReview.actionStatus}</span>
                <span>动作编号：{selectedReview.actionId}</span>
                <span>{selectedReview.requiresReview ? "当前需要人工审核" : "当前可直接通过"}</span>
              </div>
              <div className="review-actions">
                <button onClick={() => props.onInspectContext(selectedReview.actionId)} type="button">
                  查看上下文
                </button>
                <button disabled={props.isBusy} onClick={() => props.onApprove(selectedReview.reviewId)} type="button">
                  批准
                </button>
                <button disabled={props.isBusy} onClick={() => props.onReject(selectedReview.reviewId)} type="button">
                  拒绝
                </button>
              </div>
            </article>
          ) : (
            <p className="empty-state">选中一条审核记录后，这里会展示动作、原因和处理按钮。</p>
          )}
        </div>
      </article>
    </section>
  );
}

const auditKindLabels: Record<ConsoleAuditTrailItem["kind"], string> = {
  event: "事件",
  evidence: "证据",
  decision: "决策",
  action: "动作",
  review: "审核",
};

function navItemFromHash(hash: string): NavItem {
  const normalizedHash = hash.replace(/^#/, "");
  return navItems.find((item) => navHashMap[item] === normalizedHash) ?? "任务";
}

function loadPolicyState(): PolicyCenterState {
  return loadPolicyCenterState(typeof window === "undefined" ? undefined : window.localStorage);
}

function policyLabelFromState(state: PolicyCenterState, policyId: string): string {
  return state.policies.find((policy) => policy.policyId === policyId)?.name ?? policyId;
}
