import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { CodexLocalConnector } from "../dist/index.js";

test("codex local connector reads session events from a discovered jsonl file", async () => {
  const root = await mkdtemp(join(tmpdir(), "gitworklog-codex-session-"));
  const sessionPath = join(root, "rollout-2026-07-18T00-00-00-000Z-session-1.jsonl");
  await writeFile(
    sessionPath,
    [
      JSON.stringify({
        timestamp: "2026-07-18T01:00:00.000Z",
        type: "assistant_message",
        payload: { text: "I will inspect the failing test." },
      }),
      JSON.stringify({
        timestamp: "2026-07-18T01:05:00.000Z",
        type: "tool_result",
        payload: { command: "npm test", exitCode: 1 },
      }),
    ].join("\n"),
    "utf8",
  );

  const connector = new CodexLocalConnector({ sessionsDir: root });
  const sessions = await connector.discoverSessions();
  const events = await connector.readSessionEvents(sessions[0]);

  assert.equal(events.length, 2);
  assert.equal(events[0].eventType, "assistant_message");
  assert.deepEqual(events[1].payload, { command: "npm test", exitCode: 1 });
  assert.equal(events[1].createdAt, "2026-07-18T01:05:00.000Z");
});
