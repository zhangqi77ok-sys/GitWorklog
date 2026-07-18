import type {
  BindDiscoveredSessionInput,
  CreateTaskAndRunInput,
  DesktopAppService,
  IngestSessionEventsInput,
  ReviewDecisionInput,
} from "./local-service.js";
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
    ingestEvents(input: IngestSessionEventsInput): Promise<unknown>;
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
    approve(input: ReviewDecisionInput): Promise<unknown>;
    reject(input: ReviewDecisionInput): Promise<unknown>;
  };
}

type DesktopIpcService = Pick<
  DesktopAppService,
  | "appendSessionEvent"
  | "bindDiscoveredSession"
  | "createTaskAndRun"
  | "discoverSessions"
  | "getLoopRunSnapshot"
  | "ingestSessionEvents"
  | "listPendingReviews"
  | "approveReview"
  | "rejectReview"
  | "listTasks"
  | "runAnalysis"
>;

export function registerDesktopIpcHandlers(ipcMain: IpcMainLike, service: DesktopIpcService): void {
  ipcMain.handle("tasks:list", () => service.listTasks());
  ipcMain.handle("tasks:createAndRun", (_event, input) => service.createTaskAndRun(input as CreateTaskAndRunInput));
  ipcMain.handle("sessions:discover", () => service.discoverSessions());
  ipcMain.handle("sessions:bind", (_event, input) => service.bindDiscoveredSession(input as BindDiscoveredSessionInput));
  ipcMain.handle("sessions:ingestEvents", (_event, input) => service.ingestSessionEvents(input as IngestSessionEventsInput));
  ipcMain.handle("sessionEvents:append", (_event, input) => service.appendSessionEvent(input as CreateSessionEventInput));
  ipcMain.handle("analysis:run", (_event, loopRunId) => service.runAnalysis(String(loopRunId)));
  ipcMain.handle("loopRuns:snapshot", (_event, loopRunId) => service.getLoopRunSnapshot(String(loopRunId)));
  ipcMain.handle("reviews:listPending", () => service.listPendingReviews());
  ipcMain.handle("reviews:approve", (_event, input) => service.approveReview(input as ReviewDecisionInput));
  ipcMain.handle("reviews:reject", (_event, input) => service.rejectReview(input as ReviewDecisionInput));
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
      ingestEvents: (input) => ipcRenderer.invoke("sessions:ingestEvents", input),
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
      approve: (input) => ipcRenderer.invoke("reviews:approve", input),
      reject: (input) => ipcRenderer.invoke("reviews:reject", input),
    },
  };
}
