import { contextBridge, ipcRenderer } from "electron";

import { createDesktopIpcApi, type DesktopIpcApi } from "./ipc.js";

export interface DesktopBridge {
  platform: "desktop";
  version: string;
  capabilities: string[];
  api: DesktopIpcApi;
}

export const desktopBridge: DesktopBridge = {
  platform: "desktop",
  version: "0.1.0",
  capabilities: ["local-sqlite", "codex-session-discovery", "review-gates"],
  api: createDesktopIpcApi(ipcRenderer),
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld("gitWorklog", desktopBridge);
}
