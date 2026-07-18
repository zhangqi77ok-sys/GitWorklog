import assert from "node:assert/strict";
import test from "node:test";

import { decideReview, loadConsoleData, submitTaskDraft } from "../build/test/desktop-data.js";

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
