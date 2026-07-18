import type { GitWorklogBridgeLike } from "./desktop-data";

declare global {
  interface Window {
    gitWorklog?: GitWorklogBridgeLike;
  }
}

