export type EvidenceType =
  | "last_message"
  | "tool_error"
  | "tool_result"
  | "idle_window"
  | "plan_step_match";

export interface EvidenceRecord {
  evidenceId: string;
  evidenceType: EvidenceType;
  snippet: string;
  confidence: number;
}

export function createEvidenceRecord(input: EvidenceRecord): EvidenceRecord {
  return input;
}
