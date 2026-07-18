import assert from "node:assert/strict";
import test from "node:test";

import { createDesktopAppService } from "../dist/local-service.js";

test("desktop service creates a task, binds a session, analyzes it, and exposes pending reviews", async () => {
  const service = createDesktopAppService({ databasePath: ":memory:" });

  try {
    const created = service.createTaskAndRun({
      task: {
        title: "Repair failing tests",
        goal: "Make the test suite pass with evidence",
        riskProfile: "medium",
      },
      loopRun: {
        policyId: "conservative",
      },
    });

    const session = service.bindDiscoveredSession({
      loopRunId: created.loopRun.loopRunId,
      session: {
        sessionId: "codex-session-1",
        title: "Codex repair session",
        sourcePath: "C:/tmp/session.jsonl",
        lastEventAt: "2026-07-18T00:00:00.000Z",
      },
    });

    service.appendSessionEvent({
      loopRunId: created.loopRun.loopRunId,
      sessionId: session.sessionId,
      eventType: "tool_result",
      payload: {
        output: "npm test failed with assertion error",
        exitCode: 1,
      },
    });

    const analysis = service.runAnalysis(created.loopRun.loopRunId);
    const snapshot = service.getLoopRunSnapshot(created.loopRun.loopRunId);
    const pendingReviews = service.listPendingReviews();

    assert.equal(analysis.requiresReview, true);
    assert.equal(snapshot.task.taskId, created.task.taskId);
    assert.equal(snapshot.sessions.length, 1);
    assert.equal(snapshot.evidences.length, 1);
    assert.equal(snapshot.decisions.length, 1);
    assert.equal(snapshot.actions.length, 1);
    assert.equal(snapshot.pendingReviews.length, 1);
    assert.equal(pendingReviews.length, 1);
  } finally {
    service.close();
  }
});

test("desktop service approves and rejects pending reviews with action status updates", async () => {
  const service = createDesktopAppService({ databasePath: ":memory:" });

  try {
    const created = service.createTaskAndRun({
      task: {
        title: "Review flow",
        goal: "Exercise review decisions",
      },
      loopRun: {
        policyId: "conservative",
      },
    });
    const session = service.bindDiscoveredSession({
      loopRunId: created.loopRun.loopRunId,
      session: {
        sessionId: "review-session-1",
        title: "Review session",
        sourcePath: "C:/tmp/review.jsonl",
      },
    });
    service.appendSessionEvent({
      loopRunId: created.loopRun.loopRunId,
      sessionId: session.sessionId,
      eventType: "tool_result",
      payload: {
        output: "command failed",
        exitCode: 1,
      },
    });
    service.runAnalysis(created.loopRun.loopRunId);

    const pending = service.listPendingReviews();
    const approved = service.approveReview({ reviewId: pending[0].reviewId, comment: "Looks safe" });
    const approvedSnapshot = service.getLoopRunSnapshot(created.loopRun.loopRunId);

    assert.equal(approved.result, "approved");
    assert.equal(approvedSnapshot.actions[0].status, "approved");
    assert.equal(approvedSnapshot.actions[0].reviewStatus, "approved");

    service.runAnalysis(created.loopRun.loopRunId);
    const nextPending = service.listPendingReviews();
    const rejected = service.rejectReview({ reviewId: nextPending[0].reviewId, comment: "Needs a human" });
    const rejectedSnapshot = service.getLoopRunSnapshot(created.loopRun.loopRunId);

    assert.equal(rejected.result, "rejected");
    assert.equal(rejectedSnapshot.actions[0].status, "rejected");
    assert.equal(rejectedSnapshot.actions[0].reviewStatus, "rejected");
  } finally {
    service.close();
  }
});

test("desktop service includes recent session events in loop run snapshots", async () => {
  const service = createDesktopAppService({ databasePath: ":memory:" });

  try {
    const created = service.createTaskAndRun({
      task: {
        title: "Replay timeline",
        goal: "Show recent session events in Loop Detail",
      },
    });
    const session = service.bindDiscoveredSession({
      loopRunId: created.loopRun.loopRunId,
      session: {
        sessionId: "timeline-session-1",
        title: "Timeline session",
        sourcePath: "C:/tmp/timeline.jsonl",
      },
    });

    service.appendSessionEvent({
      loopRunId: created.loopRun.loopRunId,
      sessionId: session.sessionId,
      eventType: "assistant_message",
      payload: { text: "I will inspect the failing test." },
      createdAt: "2026-07-18T01:00:00.000Z",
    });
    service.appendSessionEvent({
      loopRunId: created.loopRun.loopRunId,
      sessionId: session.sessionId,
      eventType: "tool_result",
      payload: { command: "npm test", exitCode: 1 },
      createdAt: "2026-07-18T01:05:00.000Z",
    });

    const snapshot = service.getLoopRunSnapshot(created.loopRun.loopRunId);

    assert.equal(snapshot.sessionEvents.length, 2);
    assert.equal(snapshot.sessionEvents[0].eventType, "tool_result");
    assert.equal(snapshot.sessionEvents[1].eventType, "assistant_message");
  } finally {
    service.close();
  }
});

test("desktop service ingests events from a bound discovered session source", async () => {
  const service = createDesktopAppService({
    databasePath: ":memory:",
    connector: {
      connectorId: "fake",
      displayName: "Fake connector",
      discoverSessions: async () => [],
      readSessionEvents: async () => [
        {
          eventType: "assistant_message",
          payload: { text: "Continuing the loop." },
          createdAt: "2026-07-18T02:00:00.000Z",
        },
      ],
    },
  });

  try {
    const created = service.createTaskAndRun({
      task: {
        title: "Ingest real session events",
        goal: "Import Codex transcript events into the LoopRun timeline",
      },
    });
    const session = service.bindDiscoveredSession({
      loopRunId: created.loopRun.loopRunId,
      session: {
        sessionId: "ingest-session-1",
        title: "Ingest session",
        sourcePath: "C:/tmp/ingest.jsonl",
      },
    });

    const result = await service.ingestSessionEvents({
      loopRunId: created.loopRun.loopRunId,
      sessionId: session.sessionId,
    });
    const snapshot = service.getLoopRunSnapshot(created.loopRun.loopRunId);

    assert.equal(session.sourcePath, "C:/tmp/ingest.jsonl");
    assert.equal(result.importedCount, 1);
    assert.equal(snapshot.sessionEvents[0].eventType, "assistant_message");
  } finally {
    service.close();
  }
});
