export type RiskLevel = "low" | "medium" | "high";

export interface AnalyzerEvent {
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AnalyzerResult {
  analyzerId: string;
  summary: string;
  riskLevel: RiskLevel;
  evidence: string[];
  tags: string[];
}

export interface ErrorAnalysis {
  failed: boolean;
  errorType: "test_failure" | "compile_error" | "tool_error" | "unknown_error" | "none";
  result: AnalyzerResult;
}

export interface ProgressAnalysis {
  stalled: boolean;
  idleMinutes: number;
  result: AnalyzerResult;
}

export interface RiskAnalysis {
  riskLevel: RiskLevel;
  blocked: boolean;
  result: AnalyzerResult;
}

const TEST_FAILURE_PATTERNS = [/test failed/i, /failed tests?/i, /assertion/i, /pytest/i, /vitest/i];
const COMPILE_ERROR_PATTERNS = [/compile error/i, /typescript error/i, /ts\d{4}/i, /syntaxerror/i];
const TOOL_ERROR_PATTERNS = [/exit code: [1-9]/i, /permission denied/i, /not found/i, /failed/i, /traceback/i];
const HIGH_RISK_PATTERNS = [/\bdrop\b/i, /\bdelete\b/i, /\bauth\b/i, /\bprod\b/i, /\bmigration\b/i, /\bsecret\b/i];

export function analyzeErrors(events: AnalyzerEvent[]): ErrorAnalysis {
  const recentText = collectRecentText(events, 20);
  const errorType = classifyError(recentText);
  const failed = errorType !== "none";

  return {
    failed,
    errorType,
    result: {
      analyzerId: "error-analyzer",
      summary: failed ? `Detected ${errorType.replaceAll("_", " ")} signal.` : "No failure signal detected.",
      riskLevel: failed ? "medium" : "low",
      evidence: failed ? [truncate(recentText)] : [],
      tags: failed ? ["failed", errorType] : ["healthy"],
    },
  };
}

export function analyzeProgress(
  events: AnalyzerEvent[],
  options: { now?: Date; idleThresholdMinutes?: number } = {},
): ProgressAnalysis {
  const now = options.now ?? new Date();
  const threshold = options.idleThresholdMinutes ?? 10;
  const newestEvent = [...events].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
  const idleMinutes = newestEvent ? Math.max(0, (now.getTime() - Date.parse(newestEvent.createdAt)) / 60000) : Infinity;
  const hasProgressSignal = events.some((event) =>
    ["file_change", "tool_result", "test_passed", "decision"].includes(event.eventType),
  );
  const stalled = idleMinutes >= threshold && !hasProgressSignal;

  return {
    stalled,
    idleMinutes,
    result: {
      analyzerId: "progress-analyzer",
      summary: stalled
        ? `No progress signal for ${Math.round(idleMinutes)} minutes.`
        : "Recent progress signal looks acceptable.",
      riskLevel: stalled ? "medium" : "low",
      evidence: newestEvent ? [`Latest event: ${newestEvent.eventType} at ${newestEvent.createdAt}`] : ["No events found."],
      tags: stalled ? ["stalled"] : ["progressing"],
    },
  };
}

export function analyzeRisk(input: { text: string; touchedFiles?: string[] }): RiskAnalysis {
  const haystack = [input.text, ...(input.touchedFiles ?? [])].join("\n");
  const matched = HIGH_RISK_PATTERNS.filter((pattern) => pattern.test(haystack)).map(String);
  const blocked = matched.length > 0;

  return {
    riskLevel: blocked ? "high" : "low",
    blocked,
    result: {
      analyzerId: "risk-analyzer",
      summary: blocked ? "High-risk keyword or path signal detected." : "No high-risk signal detected.",
      riskLevel: blocked ? "high" : "low",
      evidence: matched,
      tags: blocked ? ["high_risk", "manual_review"] : ["low_risk"],
    },
  };
}

export function buildRuleBasedAnalyzerResult(
  analyzerId: string,
  summary: string,
  riskLevel: RiskLevel,
): AnalyzerResult {
  return { analyzerId, summary, riskLevel, evidence: [], tags: [] };
}

function classifyError(text: string): ErrorAnalysis["errorType"] {
  if (!text.trim()) {
    return "none";
  }
  if (TEST_FAILURE_PATTERNS.some((pattern) => pattern.test(text))) {
    return "test_failure";
  }
  if (COMPILE_ERROR_PATTERNS.some((pattern) => pattern.test(text))) {
    return "compile_error";
  }
  if (TOOL_ERROR_PATTERNS.some((pattern) => pattern.test(text))) {
    return "tool_error";
  }
  return "none";
}

function collectRecentText(events: AnalyzerEvent[], limit: number): string {
  return events
    .slice(-limit)
    .map((event) => JSON.stringify(event.payload))
    .join("\n");
}

function truncate(value: string, maxLength = 500): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
