import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReviewQueueState,
  selectReview,
} from "../build/test/review-queue-state.js";

test("builds review queue entries with related action context", () => {
  const state = buildReviewQueueState(
    [
      { reviewId: "review-1", actionId: "action-1", result: "pending", comment: "Needs human review" },
      { reviewId: "review-2", actionId: "action-2", result: "approved" },
    ],
    [
      { actionId: "action-1", actionType: "suggest", status: "pending_review", message: "Check failing tests" },
    ],
  );

  assert.equal(state.items[0].reviewId, "review-1");
  assert.equal(state.items[0].actionTitle, "动作 suggest");
  assert.equal(state.items[0].actionStatus, "pending_review");
  assert.equal(state.items[0].actionMessage, "Check failing tests");
  assert.equal(state.items[1].reviewId, "review-2");
});

test("selects a review and falls back to the first item when needed", () => {
  const state = buildReviewQueueState(
    [{ reviewId: "review-1", actionId: "action-1", result: "pending" }],
    [],
  );

  assert.equal(selectReview(state, "review-1").selectedReviewId, "review-1");
  assert.equal(selectReview(state, "unknown").selectedReviewId, "review-1");
});
