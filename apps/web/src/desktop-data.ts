export interface ConsoleTaskItem {
  id: string;
  title: string;
  status: string;
  goal: string;
  risk: string;
  run: string;
}

export interface ConsoleData {
  source: "desktop" | "fixture";
  tasks: ConsoleTaskItem[];
  pendingReviewCount: number;
}

export interface GitWorklogBridgeLike {
  api?: {
    tasks?: {
      list(): Promise<unknown>;
    };
    reviews?: {
      listPending(): Promise<unknown>;
    };
  };
}

export const fixtureConsoleData: ConsoleData = {
  source: "fixture",
  pendingReviewCount: 1,
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
    const pendingReviewCount = Array.isArray(rawReviews) ? rawReviews.length : 0;

    return {
      source: "desktop",
      tasks: tasks.length ? tasks : fixtureConsoleData.tasks,
      pendingReviewCount,
    };
  } catch {
    return fixtureConsoleData;
  }
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

function isConsoleTaskItem(value: ConsoleTaskItem | undefined): value is ConsoleTaskItem {
  return Boolean(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
