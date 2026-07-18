import { contextBridge } from "electron";

export interface DesktopBridge {
  platform: "desktop";
  version: string;
  capabilities: string[];
}

export const desktopBridge: DesktopBridge = {
  platform: "desktop",
  version: "0.1.0",
  capabilities: ["local-sqlite", "codex-session-discovery", "review-gates"],
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld("gitWorklog", desktopBridge);
}
