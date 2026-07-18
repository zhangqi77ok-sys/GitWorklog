import assert from "node:assert/strict";
import test from "node:test";

import {
  bindSessionToLoopRun,
  decideReview,
  discoverSessions,
  ingestSessionEvents,
  loadConsoleData,
  loadLoopSnapshot,
  runLoopAnalysis,
  submitTaskDraft,
} from "../build/test/desktop-data.js";

test("loads task and review data from the desktop bridge when available", async () => {
  const bridge = {
    api: {
      tasks: {
        list: async () => [
          {
            task: {
              taskId: "task-1",
              title: "Real desktop task",
              goal: "Use local SQLite data",
              riskProfile: "high",
            },
            latestLoopRun: {
              loopRunId: "run-1",
              status: "needs_review",
              mode: "assist_loop",
              policyId: "conservative",
            },
          },
        ],
      },
      reviews: {
        listPending: async () => [{ reviewId: "review-1", actionId: "action-1", result: "pending", comment: "Policy gate" }],
        approve: async (input) => ({ ...input, result: "approved" }),
        reject: async (input) => ({ ...input, result: "rejected" }),
      },
    },
  };

  const data = await loadConsoleData(bridge);

  assert.equal(data.source, "desktop");
  assert.equal(data.tasks[0].title, "Real desktop task");
  assert.equal(data.tasks[0].status, "needs_review");
  assert.equal(data.tasks[0].loopRunId, "run-1");
  assert.equal(data.pendingReviewCount, 1);
  assert.equal(data.reviews[0].comment, "Policy gate");
});

test("falls back to fixture data when the desktop bridge is unavailable", async () => {
  const data = await loadConsoleData(undefined);

  assert.equal(data.source, "fixture");
  assert.ok(data.tasks.length > 0);
  assert.ok(data.pendingReviewCount >= 0);
});

test("creates a task through the desktop bridge and reloads console data", async () => {
  let created = false;
  const bridge = {
    api: {
      tasks: {
        list: async () => [
          {
            task: {
              taskId: created ? "task-created" : "task-old",
              title: created ? "Created task" : "Old task",
              goal: "Use local SQLite data",
              riskProfile: "medium",
            },
          },
        ],
        createAndRun: async (input) => {
          created = true;
          return { task: { taskId: "task-created", ...input.task }, loopRun: { loopRunId: "run-created" } };
        },
      },
      reviews: {
        listPending: async () => [],
      },
    },
  };

  const data = await submitTaskDraft(bridge, {
    title: "Created task",
    goal: "Make the loop visible",
    risk: "medium",
  });

  assert.equal(created, true);
  assert.equal(data.source, "desktop");
  assert.equal(data.tasks[0].title, "Created task");
});

test("approves and rejects reviews through the desktop bridge", async () => {
  const calls = [];
  const bridge = {
    api: {
      reviews: {
        approve: async (input) => {
          calls.push(["approve", input.reviewId]);
          return { ...input, result: "approved" };
        },
        reject: async (input) => {
          calls.push(["reject", input.reviewId]);
          return { ...input, result: "rejected" };
        },
      },
    },
  };

  await decideReview(bridge, "review-1", "approved");
  await decideReview(bridge, "review-2", "rejected");

  assert.deepEqual(calls, [
    ["approve", "review-1"],
    ["reject", "review-2"],
  ]);
});

test("loads selected loop snapshot counts through the desktop bridge", async () => {
  const bridge = {
    api: {
      loopRuns: {
        snapshot: async (loopRunId) => ({
          loopRun: { loopRunId, status: "needs_review" },
          sessions: [{ sessionId: "session-1", title: "Failed session", status: "failed" }],
          evidences: [{ evidenceId: "evidence-1" }, { evidenceId: "evidence-2" }],
          decisions: [{ decisionId: "decision-1" }],
          actions: [{ actionId: "action-1" }],
          sessionEvents: [
            {
              eventId: "event-1",
              eventType: "tool_result",
              payload: { command: "npm test", exitCode: 1 },
              createdAt: "2026-07-18T01:05:00.000Z",
            },
          ],
          pendingReviews: [{ reviewId: "review-1" }],
        }),
      },
    },
  };

  const snapshot = await loadLoopSnapshot(bridge, "run-1");

  assert.equal(snapshot.loopRunId, "run-1");
  assert.equal(snapshot.sessionsCount, 1);
  assert.equal(snapshot.sessions[0].title, "Failed session");
  assert.equal(snapshot.sessions[0].status, "failed");
  assert.equal(snapshot.evidencesCount, 2);
  assert.equal(snapshot.decisionsCount, 1);
  assert.equal(snapshot.actionsCount, 1);
  assert.equal(snapshot.eventsCount, 1);
  assert.equal(snapshot.timeline[0].title, "tool_result");
  assert.equal(snapshot.timeline[0].detail, "npm test 退出码 1");
  assert.equal(snapshot.pendingReviewsCount, 1);
});

test("builds a replay audit trail from loop snapshot records", async () => {
  const bridge = {
    api: {
      loopRuns: {
        snapshot: async (loopRunId) => ({
          loopRun: { loopRunId, status: "needs_review" },
          sessions: [],
          sessionEvents: [
            {
              eventId: "event-1",
              eventType: "tool_result",
              payload: { command: "npm test", exitCode: 1 },
              createdAt: "2026-07-18T01:00:00.000Z",
            },
          ],
          evidences: [
            {
              evidenceId: "evidence-1",
              evidenceType: "tool_error",
              snippet: "npm test failed",
              confidence: 0.92,
              createdAt: "2026-07-18T01:01:00.000Z",
            },
          ],
          decisions: [
            {
              decisionId: "decision-1",
              decisionType: "failure_detected",
              reason: "工具命令失败，需要先修复测试",
              riskLevel: "medium",
              confidence: 0.81,
              createdAt: "2026-07-18T01:02:00.000Z",
            },
          ],
          actions: [
            {
              actionId: "action-1",
              actionType: "suggest",
              message: "先检查失败测试输出",
              status: "pending_review",
              requiresReview: true,
              createdAt: "2026-07-18T01:03:00.000Z",
            },
          ],
          pendingReviews: [
            {
              reviewId: "review-1",
              actionId: "action-1",
              result: "pending",
              comment: "保守策略要求人工确认",
              createdAt: "2026-07-18T01:04:00.000Z",
            },
          ],
        }),
      },
    },
  };

  const snapshot = await loadLoopSnapshot(bridge, "run-1");

  assert.deepEqual(
    snapshot.auditTrail.map((entry) => [entry.kind, entry.title, entry.detail]),
    [
      ["review", "审核 pending", "保守策略要求人工确认"],
      ["action", "动作 suggest", "先检查失败测试输出"],
      ["decision", "决策 failure_detected", "工具命令失败，需要先修复测试"],
      ["evidence", "证据 tool_error", "npm test failed"],
      ["event", "事件 tool_result", "npm test 退出码 1"],
    ],
  );
});

test("discovers sessions and binds a selected session to a loop run", async () => {
  const calls = [];
  const bridge = {
    api: {
      sessions: {
        discover: async () => [
          {
            sessionId: "session-1",
            title: "Codex session",
            projectPath: "C:/repo",
            lastEventAt: "2026-07-18T00:00:00.000Z",
          },
        ],
        bind: async (input) => {
          calls.push([input.loopRunId, input.session.sessionId]);
          return { sessionId: input.session.sessionId, loopRunId: input.loopRunId };
        },
      },
    },
  };

  const sessions = await discoverSessions(bridge);
  await bindSessionToLoopRun(bridge, "run-1", sessions[0]);

  assert.equal(sessions[0].title, "Codex session");
  assert.deepEqual(calls, [["run-1", "session-1"]]);
});

test("ingests session events for a selected loop run through the desktop bridge", async () => {
  const calls = [];
  const bridge = {
    api: {
      sessions: {
        ingestEvents: async (input) => {
          calls.push([input.loopRunId, input.sessionId]);
          return { importedCount: 2 };
        },
      },
    },
  };

  const result = await ingestSessionEvents(bridge, "run-1", "session-1");

  assert.deepEqual(calls, [["run-1", "session-1"]]);
  assert.deepEqual(result, { importedCount: 2 });
});

test("runs analysis for a selected loop run through the desktop bridge", async () => {
  const calls = [];
  const bridge = {
    api: {
      analysis: {
        run: async (loopRunId) => {
          calls.push(loopRunId);
          return { decisionId: "decision-1", actionId: "action-1", requiresReview: true };
        },
      },
    },
  };

  const result = await runLoopAnalysis(bridge, "run-1");

  assert.deepEqual(calls, ["run-1"]);
  assert.deepEqual(result, { decisionId: "decision-1", actionId: "action-1", requiresReview: true });
});
