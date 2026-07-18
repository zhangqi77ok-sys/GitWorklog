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

