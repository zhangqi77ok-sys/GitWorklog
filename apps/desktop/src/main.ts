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
