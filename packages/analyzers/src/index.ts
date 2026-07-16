export interface AnalyzerResult {
  analyzerId: string;
  summary: string;
  riskLevel: "low" | "medium" | "high";
}

export function buildRuleBasedAnalyzerResult(
  analyzerId: string,
  summary: string,
  riskLevel: "low" | "medium" | "high",
): AnalyzerResult {
  return { analyzerId, summary, riskLevel };
}
