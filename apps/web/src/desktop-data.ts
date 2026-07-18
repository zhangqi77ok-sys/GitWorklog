export interface ConsoleTaskItem {
  id: string;
  loopRunId?: string;
  title: string;
  status: string;
  goal: string;
  risk: string;
  run: string;
}

export interface ConsoleSessionItem {
  sessionId: string;
  title: string;
  projectPath?: string;
  lastEventAt?: string;
}

export interface ConsoleBoundSessionItem extends ConsoleSessionItem {
  status: string;
}

export interface ConsoleLoopSnapshot {
  loopRunId: string;
  status: string;
  sessions: ConsoleBoundSessionItem[];
  sessionsCount: number;
  eventsCount: number;
  evidencesCount: number;
  decisionsCount: number;
  actionsCount: number;
  pendingReviewsCount: number;
  timeline: ConsoleTimelineItem[];
  auditTrail: ConsoleAuditTrailItem[];
}

export interface ConsoleTimelineItem {
  id: string;
  title: string;
  detail: string;
  createdAt?: string;
}

export interface ConsoleAuditTrailItem {
  id: string;
  kind: "event" | "evidence" | "decision" | "action" | "review";
  title: string;
  detail: string;
  meta?: string;
  createdAt?: string;
}

export interface ConsoleReviewItem {
  reviewId: string;
  actionId: string;
  result: string;
  comment?: string;
}

export interface ConsoleData {
  source: "desktop" | "fixture";
  tasks: ConsoleTaskItem[];
  reviews: ConsoleReviewItem[];
  pendingReviewCount: number;
}

export interface TaskDraft {
  title: string;
  goal: string;
  risk: string;
}

export interface GitWorklogBridgeLike {
  api?: {
    tasks?: {
      list(): Promise<unknown>;
      createAndRun?(input: {
        task: {
          title: string;
          goal: string;
          riskProfile?: string;
        };
        loopRun?: {
          policyId?: string;
        };
      }): Promise<unknown>;
    };
    reviews?: {
      listPending(): Promise<unknown>;
      approve?(input: { reviewId: string; reviewer?: string; comment?: string }): Promise<unknown>;
      reject?(input: { reviewId: string; reviewer?: string; comment?: string }): Promise<unknown>;
    };
    loopRuns?: {
      snapshot(loopRunId: string): Promise<unknown>;
    };
    analysis?: {
      run(loopRunId: string): Promise<unknown>;
    };
    sessions?: {
      discover(): Promise<unknown>;
      bind(input: { loopRunId: string; session: ConsoleSessionItem }): Promise<unknown>;
      ingestEvents?(input: { loopRunId: string; sessionId: string }): Promise<unknown>;
    };
  };
}

export const fixtureConsoleData: ConsoleData = {
  source: "fixture",
  pendingReviewCount: 1,
  reviews: [
    {
      reviewId: "fixture-review",
      actionId: "fixture-action",
      result: "pending",
      comment: "保守策略要求人工确认后再继续。",
    },
  ],
  tasks: [
    {
      id: "fixture-repair",
      loopRunId: "fixture-run-repair",
      title: "修复失败的桌面端测试",
      status: "needs_review",
      goal: "恢复测试并留下可回放证据",
      risk: "medium",
      run: "conservative_loop",
    },
    {
      id: "fixture-discovery",
      loopRunId: "fixture-run-discovery",
      title: "发现并绑定 Codex 会话",
      status: "watching",
      goal: "扫描本地会话并绑定到任务",
      risk: "low",
      run: "assist_loop",
    },
    {
      id: "fixture-policy",
      loopRunId: "fixture-run-policy",
      title: "内置自动续跑策略包",
      status: "draft",
      goal: "内置可编辑续跑策略",
      risk: "high",
      run: "strict_review",
    },
  ],
};

export async function loadConsoleData(bridge: GitWorklogBridgeLike | undefined): Promise<ConsoleData> {
  if (!bridge?.api?.tasks?.list || !bridge.api.reviews?.listPending) {
    return fixtureConsoleData;
  }

  try {
    const [rawTasks, rawReviews] = await Promise.all([bridge.api.tasks.list(), bridge.api.reviews.listPending()]);
    const tasks = Array.isArray(rawTasks) ? rawTasks.map(toConsoleTaskItem).filter(isConsoleTaskItem) : [];
    const reviews = Array.isArray(rawReviews) ? rawReviews.map(toConsoleReviewItem).filter(isConsoleReviewItem) : [];
    const pendingReviewCount = reviews.length;

    return {
      source: "desktop",
      tasks: tasks.length ? tasks : fixtureConsoleData.tasks,
      reviews,
      pendingReviewCount,
    };
  } catch {
    return fixtureConsoleData;
  }
}

export async function submitTaskDraft(
  bridge: GitWorklogBridgeLike | undefined,
  draft: TaskDraft,
): Promise<ConsoleData> {
  if (!bridge?.api?.tasks?.createAndRun) {
    return fixtureConsoleData;
  }

  await bridge.api.tasks.createAndRun({
    task: {
      title: draft.title,
      goal: draft.goal,
      riskProfile: draft.risk,
    },
    loopRun: {
      policyId: "conservative",
    },
  });
  return loadConsoleData(bridge);
}

export async function decideReview(
  bridge: GitWorklogBridgeLike | undefined,
  reviewId: string,
  result: "approved" | "rejected",
): Promise<unknown> {
  const reviews = bridge?.api?.reviews;
  if (result === "approved" && reviews?.approve) {
    return reviews.approve({ reviewId });
  }
  if (result === "rejected" && reviews?.reject) {
    return reviews.reject({ reviewId });
  }
  return undefined;
}

export async function loadLoopSnapshot(
  bridge: GitWorklogBridgeLike | undefined,
  loopRunId: string | undefined,
): Promise<ConsoleLoopSnapshot | undefined> {
  if (!loopRunId || !bridge?.api?.loopRuns?.snapshot) {
    return undefined;
  }

  try {
    const rawSnapshot = await bridge.api.loopRuns.snapshot(loopRunId);
    return toConsoleLoopSnapshot(rawSnapshot);
  } catch {
    return undefined;
  }
}

export async function discoverSessions(bridge: GitWorklogBridgeLike | undefined): Promise<ConsoleSessionItem[]> {
  if (!bridge?.api?.sessions?.discover) {
    return [
      {
        sessionId: "fixture-session",
        title: "预览 Codex 会话",
        projectPath: "浏览器预览",
      },
    ];
  }

  try {
    const rawSessions = await bridge.api.sessions.discover();
    return Array.isArray(rawSessions) ? rawSessions.map(toConsoleSessionItem).filter(isConsoleSessionItem) : [];
  } catch {
    return [];
  }
}

export async function bindSessionToLoopRun(
  bridge: GitWorklogBridgeLike | undefined,
  loopRunId: string | undefined,
  session: ConsoleSessionItem | undefined,
): Promise<unknown> {
  if (!loopRunId || !session || !bridge?.api?.sessions?.bind) {
    return undefined;
  }

  return bridge.api.sessions.bind({ loopRunId, session });
}

export async function ingestSessionEvents(
  bridge: GitWorklogBridgeLike | undefined,
  loopRunId: string | undefined,
  sessionId: string | undefined,
): Promise<unknown> {
  if (!loopRunId || !sessionId || !bridge?.api?.sessions?.ingestEvents) {
    return undefined;
  }

  return bridge.api.sessions.ingestEvents({ loopRunId, sessionId });
}

export async function runLoopAnalysis(
  bridge: GitWorklogBridgeLike | undefined,
  loopRunId: string | undefined,
): Promise<unknown> {
  if (!loopRunId || !bridge?.api?.analysis?.run) {
    return undefined;
  }

  return bridge.api.analysis.run(loopRunId);
}

function toConsoleTaskItem(item: unknown): ConsoleTaskItem | undefined {
  if (!isRecord(item) || !isRecord(item.task)) {
    return undefined;
  }

  const task = item.task;
  const latestLoopRun = isRecord(item.latestLoopRun) ? item.latestLoopRun : undefined;
  const taskId = readString(task.taskId) ?? readString(task.id) ?? readString(task.title);
  const title = readString(task.title);
  const goal = readString(task.goal);
  if (!taskId || !title || !goal) {
    return undefined;
  }

  return {
    id: taskId,
    loopRunId: readString(latestLoopRun?.loopRunId),
    title,
    status: readString(latestLoopRun?.status) ?? "No run",
    goal,
    risk: readString(task.riskProfile) ?? "medium",
    run: readString(latestLoopRun?.mode) ?? "no loop",
  };
}

function toConsoleLoopSnapshot(item: unknown): ConsoleLoopSnapshot | undefined {
  if (!isRecord(item) || !isRecord(item.loopRun)) {
    return undefined;
  }

  const loopRunId = readString(item.loopRun.loopRunId);
  if (!loopRunId) {
    return undefined;
  }

  return {
    loopRunId,
    status: readString(item.loopRun.status) ?? "unknown",
    sessions: readArray(item.sessions).map(toConsoleBoundSessionItem).filter(isConsoleBoundSessionItem),
    sessionsCount: readArray(item.sessions).length,
    eventsCount: readArray(item.sessionEvents).length,
    evidencesCount: readArray(item.evidences).length,
    decisionsCount: readArray(item.decisions).length,
    actionsCount: readArray(item.actions).length,
    pendingReviewsCount: readArray(item.pendingReviews).length,
    timeline: readArray(item.sessionEvents).map(toConsoleTimelineItem).filter(isConsoleTimelineItem),
    auditTrail: buildAuditTrail(item),
  };
}

function buildAuditTrail(snapshot: Record<string, unknown>): ConsoleAuditTrailItem[] {
  return [
    ...readArray(snapshot.sessionEvents).map(toAuditEvent),
    ...readArray(snapshot.evidences).map(toAuditEvidence),
    ...readArray(snapshot.decisions).map(toAuditDecision),
    ...readArray(snapshot.actions).map(toAuditAction),
    ...readArray(snapshot.pendingReviews).map(toAuditReview),
  ]
    .filter(isConsoleAuditTrailItem)
    .sort((left, right) => readTimestamp(right.createdAt) - readTimestamp(left.createdAt));
}

function toAuditEvent(item: unknown): ConsoleAuditTrailItem | undefined {
  const timelineItem = toConsoleTimelineItem(item);
  if (!timelineItem) {
    return undefined;
  }

  return {
    id: timelineItem.id,
    kind: "event",
    title: `事件 ${timelineItem.title}`,
    detail: timelineItem.detail,
    createdAt: timelineItem.createdAt,
  };
}

function toAuditEvidence(item: unknown): ConsoleAuditTrailItem | undefined {
  if (!isRecord(item)) {
    return undefined;
  }

  const id = readString(item.evidenceId);
  const evidenceType = readString(item.evidenceType);
  const snippet = readString(item.snippet);
  if (!id || !evidenceType || !snippet) {
    return undefined;
  }

  const confidence = typeof item.confidence === "number" ? `${Math.round(item.confidence * 100)}%` : undefined;
  return {
    id,
    kind: "evidence",
    title: `证据 ${evidenceType}`,
    detail: snippet,
    meta: confidence ? `置信度 ${confidence}` : undefined,
    createdAt: readString(item.createdAt),
  };
}

function toAuditDecision(item: unknown): ConsoleAuditTrailItem | undefined {
  if (!isRecord(item)) {
    return undefined;
  }

  const id = readString(item.decisionId);
  const decisionType = readString(item.decisionType);
  const reason = readString(item.reason);
  if (!id || !decisionType || !reason) {
    return undefined;
  }

  const riskLevel = readString(item.riskLevel);
  return {
    id,
    kind: "decision",
    title: `决策 ${decisionType}`,
    detail: reason,
    meta: riskLevel ? `风险 ${riskLevel}` : undefined,
    createdAt: readString(item.createdAt),
  };
}

function toAuditAction(item: unknown): ConsoleAuditTrailItem | undefined {
  if (!isRecord(item)) {
    return undefined;
  }

  const id = readString(item.actionId);
  const actionType = readString(item.actionType);
  if (!id || !actionType) {
    return undefined;
  }

  return {
    id,
    kind: "action",
    title: `动作 ${actionType}`,
    detail: readString(item.message) ?? readString(item.status) ?? "已记录动作",
    meta: readString(item.status),
    createdAt: readString(item.createdAt),
  };
}

function toAuditReview(item: unknown): ConsoleAuditTrailItem | undefined {
  if (!isRecord(item)) {
    return undefined;
  }

  const id = readString(item.reviewId);
  const result = readString(item.result);
  if (!id || !result) {
    return undefined;
  }

  return {
    id,
    kind: "review",
    title: `审核 ${result}`,
    detail: readString(item.comment) ?? "等待人工审核",
    meta: readString(item.actionId),
    createdAt: readString(item.createdAt),
  };
}

function toConsoleBoundSessionItem(item: unknown): ConsoleBoundSessionItem | undefined {
  const session = toConsoleSessionItem(item);
  if (!session || !isRecord(item)) {
    return undefined;
  }

  return {
    ...session,
    status: readString(item.status) ?? "unknown",
  };
}

function toConsoleTimelineItem(item: unknown): ConsoleTimelineItem | undefined {
  if (!isRecord(item)) {
    return undefined;
  }

  const id = readString(item.eventId);
  const title = readString(item.eventType);
  if (!id || !title) {
    return undefined;
  }

  return {
    id,
    title,
    detail: summarizeEventPayload(title, isRecord(item.payload) ? item.payload : {}),
    createdAt: readString(item.createdAt),
  };
}

function toConsoleSessionItem(item: unknown): ConsoleSessionItem | undefined {
  if (!isRecord(item)) {
    return undefined;
  }

  const sessionId = readString(item.sessionId);
  const title = readString(item.title);
  if (!sessionId || !title) {
    return undefined;
  }

  return {
    sessionId,
    title,
    projectPath: readString(item.projectPath),
    lastEventAt: readString(item.lastEventAt),
  };
}

function toConsoleReviewItem(item: unknown): ConsoleReviewItem | undefined {
  if (!isRecord(item)) {
    return undefined;
  }

  const reviewId = readString(item.reviewId);
  const actionId = readString(item.actionId);
  const result = readString(item.result);
  if (!reviewId || !actionId || !result) {
    return undefined;
  }

  return {
    reviewId,
    actionId,
    result,
    comment: readString(item.comment),
  };
}

function isConsoleTaskItem(value: ConsoleTaskItem | undefined): value is ConsoleTaskItem {
  return Boolean(value);
}

function isConsoleReviewItem(value: ConsoleReviewItem | undefined): value is ConsoleReviewItem {
  return Boolean(value);
}

function isConsoleSessionItem(value: ConsoleSessionItem | undefined): value is ConsoleSessionItem {
  return Boolean(value);
}

function isConsoleBoundSessionItem(value: ConsoleBoundSessionItem | undefined): value is ConsoleBoundSessionItem {
  return Boolean(value);
}

function isConsoleTimelineItem(value: ConsoleTimelineItem | undefined): value is ConsoleTimelineItem {
  return Boolean(value);
}

function isConsoleAuditTrailItem(value: ConsoleAuditTrailItem | undefined): value is ConsoleAuditTrailItem {
  return Boolean(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readTimestamp(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function summarizeEventPayload(eventType: string, payload: Record<string, unknown>): string {
  const command = readString(payload.command);
  const exitCode = typeof payload.exitCode === "number" ? payload.exitCode : undefined;
  if (command && exitCode !== undefined) {
    return `${command} 退出码 ${exitCode}`;
  }

  const output = readString(payload.output);
  if (output) {
    return output.slice(0, 140);
  }

  const text = readString(payload.text);
  if (text) {
    return text.slice(0, 140);
  }

  return `已捕获 ${eventType} 事件`;
}
