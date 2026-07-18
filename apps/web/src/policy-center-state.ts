export const POLICY_CENTER_STORAGE_KEY = "gitworklog-policy-center-v1";

export interface PolicyCenterPolicy {
  policyId: string;
  name: string;
  description: string;
  mode: "read_only" | "conservative" | "balanced";
  enabled: boolean;
  autoResumeEnabled: boolean;
  autoResumeLimit: number;
}

export interface PolicyCenterRule {
  ruleId: string;
  title: string;
  description: string;
  enabled: boolean;
  priority: number;
  severity: "low" | "medium" | "high";
}

export interface PolicyCenterState {
  selectedPolicyId: string;
  policies: PolicyCenterPolicy[];
  rules: PolicyCenterRule[];
}

export interface PolicyCenterStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const defaultPolicies: PolicyCenterPolicy[] = [
  {
    policyId: "read-only",
    name: "只读观察",
    description: "只记录、分析和提示，不自动生成续跑动作。",
    mode: "read_only",
    enabled: true,
    autoResumeEnabled: false,
    autoResumeLimit: 0,
  },
  {
    policyId: "conservative",
    name: "保守续跑",
    description: "默认进入人工审核，适合当前桌面端早期阶段。",
    mode: "conservative",
    enabled: true,
    autoResumeEnabled: false,
    autoResumeLimit: 0,
  },
  {
    policyId: "balanced",
    name: "平衡辅助",
    description: "允许少量低风险自动续跑，高风险动作仍必须审核。",
    mode: "balanced",
    enabled: true,
    autoResumeEnabled: true,
    autoResumeLimit: 2,
  },
];

const defaultRules: PolicyCenterRule[] = [
  {
    ruleId: "high-risk-review",
    title: "高风险动作必须审核",
    description: "涉及高风险、不可逆或跨项目操作时，先进入人工审核。",
    enabled: true,
    priority: 10,
    severity: "high",
  },
  {
    ruleId: "resume-limit",
    title: "自动续跑次数限制",
    description: "同一循环达到策略限制后，不再继续自动恢复。",
    enabled: true,
    priority: 20,
    severity: "medium",
  },
  {
    ruleId: "tool-failure-review",
    title: "工具失败后进入审核",
    description: "测试、构建或关键工具失败后，需要先检查证据再继续。",
    enabled: true,
    priority: 30,
    severity: "medium",
  },
];

export function createDefaultPolicyCenterState(): PolicyCenterState {
  return {
    selectedPolicyId: "conservative",
    policies: defaultPolicies.map((policy) => ({ ...policy })),
    rules: defaultRules.map((rule) => ({ ...rule })),
  };
}

export function loadPolicyCenterState(storage: PolicyCenterStorageLike | undefined): PolicyCenterState {
  const defaultState = createDefaultPolicyCenterState();
  if (!storage) {
    return defaultState;
  }

  try {
    const rawValue = storage.getItem(POLICY_CENTER_STORAGE_KEY);
    if (!rawValue) {
      return defaultState;
    }

    const persisted = JSON.parse(rawValue) as Partial<PolicyCenterState>;
    return normalizePolicyCenterState(persisted, defaultState);
  } catch {
    return defaultState;
  }
}

export function savePolicyCenterState(storage: PolicyCenterStorageLike | undefined, state: PolicyCenterState): void {
  if (!storage) {
    return;
  }

  storage.setItem(
    POLICY_CENTER_STORAGE_KEY,
    JSON.stringify({
      selectedPolicyId: state.selectedPolicyId,
      rules: state.rules.map((rule) => ({
        ruleId: rule.ruleId,
        enabled: rule.enabled,
        priority: rule.priority,
      })),
    }),
  );
}

export function selectPolicy(state: PolicyCenterState, policyId: string): PolicyCenterState {
  if (!state.policies.some((policy) => policy.policyId === policyId && policy.enabled)) {
    return state;
  }

  return {
    ...state,
    selectedPolicyId: policyId,
  };
}

export function toggleRuleEnabled(state: PolicyCenterState, ruleId: string): PolicyCenterState {
  return {
    ...state,
    rules: state.rules.map((rule) => (rule.ruleId === ruleId ? { ...rule, enabled: !rule.enabled } : rule)),
  };
}

export function togglePolicyEnabled(state: PolicyCenterState, policyId: string): PolicyCenterState {
  const nextPolicies = state.policies.map((policy) =>
    policy.policyId === policyId ? { ...policy, enabled: !policy.enabled } : policy,
  );
  const selectedPolicy = nextPolicies.find((policy) => policy.policyId === state.selectedPolicyId && policy.enabled);
  const fallbackPolicy = nextPolicies.find((policy) => policy.enabled);

  return {
    ...state,
    policies: nextPolicies,
    selectedPolicyId: selectedPolicy?.policyId ?? fallbackPolicy?.policyId ?? state.selectedPolicyId,
  };
}

export function updatePolicyAutoResume(
  state: PolicyCenterState,
  policyId: string,
  autoResumeEnabled: boolean,
  autoResumeLimit: number,
): PolicyCenterState {
  const safeLimit = Math.min(9, Math.max(0, Math.round(autoResumeLimit)));
  return {
    ...state,
    policies: state.policies.map((policy) =>
      policy.policyId === policyId
        ? { ...policy, autoResumeEnabled, autoResumeLimit: safeLimit }
        : policy,
    ),
  };
}

export function setRulePriority(state: PolicyCenterState, ruleId: string, priority: number): PolicyCenterState {
  const safePriority = Math.min(99, Math.max(1, Math.round(priority)));
  return {
    ...state,
    rules: state.rules.map((rule) => (rule.ruleId === ruleId ? { ...rule, priority: safePriority } : rule)),
  };
}

function normalizePolicyCenterState(
  persisted: Partial<PolicyCenterState>,
  defaultState: PolicyCenterState,
): PolicyCenterState {
  const selectedPolicyId =
    typeof persisted.selectedPolicyId === "string" &&
    defaultState.policies.some((policy) => policy.policyId === persisted.selectedPolicyId)
      ? persisted.selectedPolicyId
      : defaultState.selectedPolicyId;
  const persistedRules: unknown[] = Array.isArray(persisted.rules) ? persisted.rules : [];

  return {
    ...defaultState,
    selectedPolicyId,
    rules: defaultState.rules.map((rule) => {
      const persistedRule = persistedRules.find(
        (candidate) =>
          typeof candidate === "object" &&
          candidate !== null &&
          "ruleId" in candidate &&
          typeof (candidate as { ruleId?: unknown }).ruleId === "string" &&
          (candidate as { ruleId?: string }).ruleId === rule.ruleId,
      ) as { enabled?: unknown; priority?: unknown } | undefined;

      return {
        ...rule,
        enabled: typeof persistedRule?.enabled === "boolean" ? persistedRule.enabled : rule.enabled,
        priority:
          typeof persistedRule?.priority === "number"
            ? Math.min(99, Math.max(1, Math.round(persistedRule.priority)))
            : rule.priority,
      };
    }),
  };
}
