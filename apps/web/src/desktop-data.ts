export interface ConsoleTaskItem {
  id: string;
  title: string;
  status: string;
  goal: string;
  risk: string;
  run: string;
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
      comment: "Conservative policy requires manual approval.",
    },
  ],
  tasks: [
    {
      id: "fixture-repair",
      title: "Repair failing desktop test",
      status: "Needs review",
      goal: "恢复测试并留下可回放证据",
      risk: "medium",
      run: "conservative loop",
    },
    {
      id: "fixture-discovery",
      title: "Codex session discovery",
      status: "Watching",
      goal: "扫描本地会话并绑定到任务",
      risk: "low",
      run: "assist loop",
    },
    {
      id: "fixture-policy",
      title: "Auto-resume policy pack",
      status: "Draft",
      goal: "内置可编辑续跑策略",
      risk: "high",
      run: "strict review",
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
    title,
    status: readString(latestLoopRun?.status) ?? "No run",
    goal,
    risk: readString(task.riskProfile) ?? "medium",
    run: readString(latestLoopRun?.mode) ?? "no loop",
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
