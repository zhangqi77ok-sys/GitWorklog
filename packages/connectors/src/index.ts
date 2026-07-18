import { createReadStream } from "node:fs";
import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";

export interface DiscoveredSession {
  sessionId: string;
  title: string;
  threadId?: string;
  projectPath?: string;
  sourcePath: string;
  lastEventAt?: string;
}

export interface SessionConnector {
  connectorId: string;
  displayName: string;
  discoverSessions(): Promise<DiscoveredSession[]>;
}

export interface CodexLocalConnectorOptions {
  sessionsDir?: string;
  maxFiles?: number;
}

export class CodexLocalConnector implements SessionConnector {
  connectorId = "codex-local";
  displayName = "Codex Local Session Reader";

  private readonly sessionsDir: string;
  private readonly maxFiles: number;

  constructor(options: CodexLocalConnectorOptions = {}) {
    this.sessionsDir = options.sessionsDir ?? join(homedir(), ".codex", "sessions");
    this.maxFiles = options.maxFiles ?? 200;
  }

  async discoverSessions(): Promise<DiscoveredSession[]> {
    const files = await findJsonlFiles(this.sessionsDir);
    const newestFiles = files
      .sort((left, right) => right.lastModifiedMs - left.lastModifiedMs)
      .slice(0, this.maxFiles);

    const sessions = await Promise.all(
      newestFiles.map(async (file) => {
        const filenameMeta = parseSessionFilename(file.path);
        const contentMeta = await readSessionHeader(file.path);

        return {
          sessionId: contentMeta.sessionId ?? filenameMeta.sessionId,
          threadId: contentMeta.threadId ?? filenameMeta.sessionId,
          title: contentMeta.title ?? filenameMeta.title,
          projectPath: contentMeta.projectPath,
          sourcePath: file.path,
          lastEventAt: contentMeta.lastEventAt ?? new Date(file.lastModifiedMs).toISOString(),
        };
      }),
    );

    return sessions.filter((session) => Boolean(session.sessionId));
  }
}

interface SessionFile {
  path: string;
  lastModifiedMs: number;
}

async function findJsonlFiles(root: string): Promise<SessionFile[]> {
  const files: SessionFile[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: Dirent<string>[];
    try {
      entries = await readdir(dir, { withFileTypes: true, encoding: "utf8" });
    } catch {
      return;
    }

    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
          return;
        }
        if (!entry.isFile() || !entry.name.endsWith(".jsonl")) {
          return;
        }

        try {
          const fileStat = await stat(fullPath);
          files.push({ path: fullPath, lastModifiedMs: fileStat.mtimeMs });
        } catch {
          // Ignore files that disappear or cannot be read while scanning.
        }
      }),
    );
  }

  await walk(root);
  return files;
}

function parseSessionFilename(path: string): Pick<DiscoveredSession, "sessionId" | "title"> {
  const name = basename(path, ".jsonl");
  const idMatch = name.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  const sessionId = idMatch?.[1] ?? name;
  const title = name.replace(/^rollout-\d{4}-\d{2}-\d{2}T/i, "Codex session ");
  return { sessionId, title };
}

async function readSessionHeader(path: string): Promise<Partial<DiscoveredSession>> {
  const metadata: Partial<DiscoveredSession> = {};

  try {
    const stream = createReadStream(path, { encoding: "utf8" });
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    let count = 0;

    for await (const line of lines) {
      count += 1;
      mergeJsonLine(metadata, line);
      if (count >= 20 || (metadata.title && metadata.projectPath && metadata.lastEventAt)) {
        lines.close();
        break;
      }
    }
  } catch {
    return metadata;
  }

  return metadata;
}

function mergeJsonLine(metadata: Partial<DiscoveredSession>, line: string): void {
  try {
    const event = JSON.parse(line) as Record<string, unknown>;
    const payload = typeof event.payload === "object" && event.payload ? (event.payload as Record<string, unknown>) : event;

    metadata.sessionId ??= readString(payload, ["session_id", "sessionId", "id"]);
    metadata.threadId ??= readString(payload, ["thread_id", "threadId"]);
    metadata.title ??= readString(payload, ["title", "name"]);
    metadata.projectPath ??= readString(payload, ["cwd", "project_path", "projectPath"]);
    metadata.lastEventAt ??= readString(event, ["timestamp", "created_at", "createdAt"]);
  } catch {
    // JSONL files can contain partial or evolving event shapes; discovery should stay best-effort.
  }
}

function readString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return undefined;
}
