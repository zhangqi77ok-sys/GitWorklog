import type { BindDiscoveredSessionInput, CreateTaskAndRunInput, DesktopAppService } from "./local-service.js";
import type { CreateSessionEventInput } from "@gitworklog/shared-types";

export interface IpcMainLike {
  handle(channel: string, handler: (event: unknown, ...args: unknown[]) => unknown): void;
}

export interface IpcRendererLike {
  invoke(channel: string, payload?: unknown): Promise<unknown>;
}

export interface DesktopIpcApi {
  tasks: {
    list(): Promise<unknown>;
    createAndRun(input: CreateTaskAndRunInput): Promise<unknown>;
  };
  sessions: {
    discover(): Promise<unknown>;
    bind(input: BindDiscoveredSessionInput): Promise<unknown>;
  };
  sessionEvents: {
    append(input: CreateSessionEventInput): Promise<unknown>;
  };
  analysis: {
    run(loopRunId: string): Promise<unknown>;
  };
  loopRuns: {
    snapshot(loopRunId: string): Promise<unknown>;
  };
  reviews: {
    listPending(): Promise<unknown>;
  };
}

type DesktopIpcService = Pick<
  DesktopAppService,
  | "appendSessionEvent"
  | "bindDiscoveredSession"
  | "createTaskAndRun"
  | "discoverSessions"
  | "getLoopRunSnapshot"
  | "listPendingReviews"
  | "listTasks"
  | "runAnalysis"
>;

export function registerDesktopIpcHandlers(ipcMain: IpcMainLike, service: DesktopIpcService): void {
  ipcMain.handle("tasks:list", () => service.listTasks());
  ipcMain.handle("tasks:createAndRun", (_event, input) => service.createTaskAndRun(input as CreateTaskAndRunInput));
  ipcMain.handle("sessions:discover", () => service.discoverSessions());
  ipcMain.handle("sessions:bind", (_event, input) => service.bindDiscoveredSession(input as BindDiscoveredSessionInput));
  ipcMain.handle("sessionEvents:append", (_event, input) => service.appendSessionEvent(input as CreateSessionEventInput));
  ipcMain.handle("analysis:run", (_event, loopRunId) => service.runAnalysis(String(loopRunId)));
  ipcMain.handle("loopRuns:snapshot", (_event, loopRunId) => service.getLoopRunSnapshot(String(loopRunId)));
  ipcMain.handle("reviews:listPending", () => service.listPendingReviews());
}

export function createDesktopIpcApi(ipcRenderer: IpcRendererLike): DesktopIpcApi {
  return {
    tasks: {
      list: () => ipcRenderer.invoke("tasks:list"),
      createAndRun: (input) => ipcRenderer.invoke("tasks:createAndRun", input),
    },
    sessions: {
      discover: () => ipcRenderer.invoke("sessions:discover"),
      bind: (input) => ipcRenderer.invoke("sessions:bind", input),
    },
    sessionEvents: {
      append: (input) => ipcRenderer.invoke("sessionEvents:append", input),
    },
    analysis: {
      run: (loopRunId) => ipcRenderer.invoke("analysis:run", loopRunId),
    },
    loopRuns: {
      snapshot: (loopRunId) => ipcRenderer.invoke("loopRuns:snapshot", loopRunId),
    },
    reviews: {
      listPending: () => ipcRenderer.invoke("reviews:listPending"),
    },
  };
}

