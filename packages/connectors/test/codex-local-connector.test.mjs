import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
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

  const connector = new CodexLocalConnector({
    sessionsDir: root,
    stateDbPath: join(root, "missing-state.sqlite"),
  });
  const sessions = await connector.discoverSessions();
  const events = await connector.readSessionEvents(sessions[0]);

  assert.equal(events.length, 2);
  assert.equal(events[0].eventType, "assistant_message");
  assert.deepEqual(events[1].payload, { command: "npm test", exitCode: 1 });
  assert.equal(events[1].createdAt, "2026-07-18T01:05:00.000Z");
});

test("codex local connector discovers active desktop threads from codex state sqlite", async () => {
  const root = await mkdtemp(join(tmpdir(), "gitworklog-codex-state-"));
  const stateDbPath = join(root, "state_5.sqlite");
  const logsDbPath = join(root, "logs_2.sqlite");
  const stateDb = new DatabaseSync(stateDbPath);
  stateDb.exec(`
    CREATE TABLE threads (
      id TEXT PRIMARY KEY,
      title TEXT,
      preview TEXT,
      cwd TEXT,
      rollout_path TEXT,
      updated_at INTEGER,
      updated_at_ms INTEGER,
      model TEXT,
      status TEXT
    );
    INSERT INTO threads (
      id, title, preview, cwd, rollout_path, updated_at, updated_at_ms, model, status
    ) VALUES (
      'thread-current',
      '当前 GitWorklog 开发会话',
      '策略中心和会话监测',
      '\\\\?\\C:\\Users\\13605\\Documents\\git-log',
      'C:\\Users\\13605\\.codex\\sessions\\old.jsonl',
      1784436075,
      1784436075260,
      'gpt-5.5',
      'running'
    );
  `);
  stateDb.close();

  const logsDb = new DatabaseSync(logsDbPath);
  logsDb.exec(`
    CREATE TABLE logs (
      id INTEGER PRIMARY KEY,
      ts INTEGER,
      level TEXT,
      target TEXT,
      feedback_log_body TEXT,
      thread_id TEXT
    );
    INSERT INTO logs (
      id, ts, level, target, feedback_log_body, thread_id
    ) VALUES (
      1,
      1784436075,
      'INFO',
      'codex_core::stream_events_utils',
      'ToolCall: shell_command {"command":"npm test"} thread_id=thread-current',
      'thread-current'
    );
  `);
  logsDb.close();

  const connector = new CodexLocalConnector({ sessionsDir: join(root, "missing-jsonl"), stateDbPath, logsDbPath });
  const sessions = await connector.discoverSessions();
  const events = await connector.readSessionEvents(sessions[0]);

  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].sessionId, "thread-current");
  assert.equal(sessions[0].threadId, "thread-current");
  assert.equal(sessions[0].title, "当前 GitWorklog 开发会话");
  assert.equal(sessions[0].projectPath, "C:\\Users\\13605\\Documents\\git-log");
  assert.equal(sessions[0].sourcePath, "codex-state://thread-current");
  assert.equal(sessions[0].lastEventAt, "2026-07-19T04:41:15.260Z");
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "codex_core::stream_events_utils");
  assert.equal(events[0].payload.level, "INFO");
  assert.equal(events[0].createdAt, "2026-07-19T04:41:15.000Z");
});
