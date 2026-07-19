import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReplayAuditState,
  filterReplayAuditEntries,
  selectReplayAuditEntry,
  selectReplayAuditFilter,
  selectReplayAuditRelatedEntry,
} from "../build/test/replay-audit-state.js";

const auditTrail = [
  {
    id: "event-1",
    kind: "event",
    title: "事件 tool_result",
    detail: "npm test failed",
    createdAt: "2026-07-19T10:00:00.000Z",
  },
  {
    id: "action-1",
    kind: "action",
    title: "动作 suggest",
    detail: "Review failing tests",
    meta: "pending_review",
    createdAt: "2026-07-19T10:01:00.000Z",
  },
  {
    id: "review-1",
    kind: "review",
    title: "审核 pending",
    detail: "Needs human review",
    meta: "action-1",
    createdAt: "2026-07-19T10:02:00.000Z",
  },
];

test("filters replay audit entries and keeps selection inside the visible filter", () => {
  const state = buildReplayAuditState(auditTrail);
  const filteredState = selectReplayAuditFilter(state, "review", auditTrail);

  assert.equal(filteredState.filter, "review");
  assert.equal(filteredState.selectedEntryId, "review-1");
  assert.deepEqual(
    filterReplayAuditEntries(auditTrail, filteredState.filter).map((entry) => entry.id),
    ["review-1"],
  );
});

test("selects a replay audit entry and ignores unknown ids", () => {
  const state = buildReplayAuditState(auditTrail);

  assert.equal(selectReplayAuditEntry(state, "action-1", auditTrail).selectedEntryId, "action-1");
  assert.equal(selectReplayAuditEntry(state, "missing", auditTrail).selectedEntryId, "event-1");
});

test("selects related replay context from a review action id", () => {
  const state = buildReplayAuditState(auditTrail);
  const selected = selectReplayAuditRelatedEntry(state, "action-1", auditTrail);

  assert.equal(selected.filter, "all");
  assert.equal(selected.selectedEntryId, "action-1");
});
