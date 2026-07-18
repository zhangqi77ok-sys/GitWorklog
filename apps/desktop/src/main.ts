import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { BrowserWindow, app } from "electron";

export type DesktopLifecycleState =
  | "booting"
  | "ready"
  | "watching"
  | "degraded"
  | "shutdown";

export interface DesktopRuntime {
  state: DesktopLifecycleState;
  webEntry: string;
}

export function createDesktopRuntime(webEntry = "http://localhost:5173"): DesktopRuntime {
  return {
    state: "booting",
    webEntry,
  };
}

export function startDesktopRuntime(runtime: DesktopRuntime): DesktopRuntime {
  return {
    ...runtime,
    state: "ready",
  };
}

export async function startElectronApp(): Promise<void> {
  await app.whenReady();

  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: "GitWorklog",
    backgroundColor: "#f3eddc",
    webPreferences: {
      preload: join(dirname(fileURLToPath(import.meta.url)), "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.GITWORKLOG_WEB_URL;
  if (devUrl) {
    await window.loadURL(devUrl);
  } else {
    const webIndex = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "web", "dist", "index.html");
    if (existsSync(webIndex)) {
      await window.loadFile(webIndex);
    } else {
      await window.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(
          "<h1>GitWorklog</h1><p>Web build not found. Run npm run build first.</p>",
        )}`,
      );
    }
  }
}

if (process.versions.electron) {
  startElectronApp().catch((error: unknown) => {
    console.error(error);
    app.exit(1);
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void startElectronApp();
    }
  });
}

export { createDesktopAppService, DesktopAppService } from "./local-service.js";
export type {
  BindDiscoveredSessionInput,
  CreateTaskAndRunInput,
  DesktopAppServiceOptions,
  LoopRunSnapshot,
  TaskListItem,
} from "./local-service.js";
