import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { BrowserWindow, Menu, app, ipcMain, screen } from "electron";

import { createDesktopIpcApi, registerDesktopIpcHandlers } from "./ipc.js";
import { createDesktopAppService } from "./local-service.js";

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

let ipcHandlersRegistered = false;

export async function startElectronApp(): Promise<void> {
  await app.whenReady();

  if (!ipcHandlersRegistered) {
    registerDesktopIpcHandlers(ipcMain, createDesktopAppService());
    ipcHandlersRegistered = true;
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "文件",
        submenu: [{ role: "quit", label: "退出" }],
      },
      {
        label: "编辑",
        submenu: [
          { role: "undo", label: "撤销" },
          { role: "redo", label: "重做" },
          { type: "separator" },
          { role: "cut", label: "剪切" },
          { role: "copy", label: "复制" },
          { role: "paste", label: "粘贴" },
          { role: "selectAll", label: "全选" },
        ],
      },
      {
        label: "视图",
        submenu: [
          { role: "reload", label: "重新加载" },
          { role: "toggleDevTools", label: "开发者工具" },
          { type: "separator" },
          { role: "resetZoom", label: "实际大小" },
          { role: "zoomIn", label: "放大" },
          { role: "zoomOut", label: "缩小" },
          { type: "separator" },
          { role: "togglefullscreen", label: "切换全屏" },
        ],
      },
      {
        label: "窗口",
        submenu: [
          { role: "minimize", label: "最小化" },
          { role: "close", label: "关闭" },
        ],
      },
    ]),
  );

  const { width: workAreaWidth, height: workAreaHeight } = screen.getPrimaryDisplay().workAreaSize;
  const window = new BrowserWindow({
    width: Math.min(1280, Math.max(980, workAreaWidth - 80)),
    height: Math.min(860, Math.max(680, workAreaHeight - 80)),
    minWidth: 980,
    minHeight: 680,
    center: true,
    title: "GitWorklog 循环工程控制台",
    backgroundColor: "#0b0d10",
    webPreferences: {
      preload: join(dirname(fileURLToPath(import.meta.url)), "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window.maximize();

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
export { createDesktopIpcApi, registerDesktopIpcHandlers } from "./ipc.js";
export type {
  BindDiscoveredSessionInput,
  CreateTaskAndRunInput,
  DesktopAppServiceOptions,
  LoopRunSnapshot,
  ReviewDecisionInput,
  TaskListItem,
} from "./local-service.js";
