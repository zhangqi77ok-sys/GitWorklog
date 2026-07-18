import assert from "node:assert/strict";
import test from "node:test";

import { loadConsoleData } from "../build/test/desktop-data.js";

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
        listPending: async () => [{ reviewId: "review-1", actionId: "action-1", result: "pending" }],
      },
    },
  };

  const data = await loadConsoleData(bridge);

  assert.equal(data.source, "desktop");
  assert.equal(data.tasks[0].title, "Real desktop task");
  assert.equal(data.tasks[0].status, "needs_review");
  assert.equal(data.pendingReviewCount, 1);
});

test("falls back to fixture data when the desktop bridge is unavailable", async () => {
  const data = await loadConsoleData(undefined);

  assert.equal(data.source, "fixture");
  assert.ok(data.tasks.length > 0);
  assert.ok(data.pendingReviewCount >= 0);
});
