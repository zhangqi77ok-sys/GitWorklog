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

export interface ReviewGateInput {
  policy: PolicyDefinition;
  riskLevel: "low" | "medium" | "high";
  autoResumeCount: number;
  actionType: "observe" | "suggest" | "resume_with_prompt" | "pause_loop" | "request_manual_takeover";
}

export interface ReviewGateResult {
  allowed: boolean;
  requiresReview: boolean;
  reason: string;
}

export function evaluateReviewGate(input: ReviewGateInput): ReviewGateResult {
  if (input.riskLevel === "high") {
    return {
      allowed: false,
      requiresReview: true,
      reason: "High-risk action requires manual review.",
    };
  }

  if (input.actionType !== "resume_with_prompt") {
    return {
      allowed: true,
      requiresReview: false,
      reason: "Non-resume action is allowed by default.",
    };
  }

  if (!input.policy.autoResumeEnabled) {
    return {
      allowed: false,
      requiresReview: true,
      reason: "Auto resume is disabled by policy.",
    };
  }

  if (input.autoResumeCount >= input.policy.autoResumeLimit) {
    return {
      allowed: false,
      requiresReview: true,
      reason: "Auto resume limit reached.",
    };
  }

  return {
    allowed: true,
    requiresReview: false,
    reason: "Auto resume is allowed by policy.",
  };
}
