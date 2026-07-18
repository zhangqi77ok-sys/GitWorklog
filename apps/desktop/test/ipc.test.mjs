import assert from "node:assert/strict";
import test from "node:test";

import { createDesktopIpcApi, registerDesktopIpcHandlers } from "../dist/ipc.js";

test("registers desktop IPC channels and forwards calls to the service", async () => {
  const handlers = new Map();
  const ipcMain = {
    handle(channel, handler) {
      handlers.set(channel, handler);
    },
  };
  const service = {
    listTasks() {
      return [{ task: { taskId: "task-1", title: "Demo" } }];
    },
    getLoopRunSnapshot(loopRunId) {
      return { loopRun: { loopRunId } };
    },
  };

  registerDesktopIpcHandlers(ipcMain, service);

  assert.equal(handlers.has("tasks:list"), true);
  assert.equal(handlers.has("loopRuns:snapshot"), true);
  assert.deepEqual(await handlers.get("tasks:list")(), service.listTasks());
  assert.deepEqual(await handlers.get("loopRuns:snapshot")({}, "run-1"), { loopRun: { loopRunId: "run-1" } });
});

test("preload API invokes namespaced desktop IPC channels", async () => {
  const calls = [];
  const ipcRenderer = {
    invoke(channel, payload) {
      calls.push([channel, payload]);
      return Promise.resolve({ channel, payload });
    },
  };

  const api = createDesktopIpcApi(ipcRenderer);
  const result = await api.tasks.createAndRun({ task: { title: "Demo", goal: "Ship" } });

  assert.deepEqual(calls, [["tasks:createAndRun", { task: { title: "Demo", goal: "Ship" } }]]);
  assert.deepEqual(result, {
    channel: "tasks:createAndRun",
    payload: { task: { title: "Demo", goal: "Ship" } },
  });
});

