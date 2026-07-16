export interface DiscoveredSession {
  sessionId: string;
  title: string;
  threadId?: string;
  projectPath?: string;
  lastEventAt?: string;
}

export interface SessionConnector {
  connectorId: string;
  displayName: string;
  discoverSessions(): Promise<DiscoveredSession[]>;
}

export class CodexLocalConnector implements SessionConnector {
  connectorId = "codex-local";
  displayName = "Codex Local Session Reader";

  async discoverSessions(): Promise<DiscoveredSession[]> {
    return [];
  }
}
