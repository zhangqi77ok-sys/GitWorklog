export type PolicyMode =
  | "read_only"
  | "conservative"
  | "balanced"
  | "aggressive"
  | "strict_review";

export interface PolicyDefinition {
  policyId: string;
  name: string;
  mode: PolicyMode;
  autoResumeEnabled: boolean;
  autoResumeLimit: number;
}

export const DEFAULT_POLICIES: PolicyDefinition[] = [
  {
    policyId: "read-only",
    name: "Read Only",
    mode: "read_only",
    autoResumeEnabled: false,
    autoResumeLimit: 0,
  },
  {
    policyId: "conservative",
    name: "Conservative",
    mode: "conservative",
    autoResumeEnabled: false,
    autoResumeLimit: 0,
  },
  {
    policyId: "balanced",
    name: "Balanced",
    mode: "balanced",
    autoResumeEnabled: true,
    autoResumeLimit: 2,
  },
];
