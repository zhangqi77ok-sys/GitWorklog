import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultPolicyCenterState,
  loadPolicyCenterState,
  selectPolicy,
  savePolicyCenterState,
  setRulePriority,
  togglePolicyEnabled,
  toggleRuleEnabled,
  updatePolicyAutoResume,
} from "../build/test/policy-center-state.js";

test("creates default policy center state with conservative policy selected", () => {
  const state = createDefaultPolicyCenterState();

  assert.equal(state.selectedPolicyId, "conservative");
  assert.deepEqual(
    state.policies.map((policy) => [policy.policyId, policy.name, policy.enabled]),
    [
      ["read-only", "只读观察", true],
      ["conservative", "保守续跑", true],
      ["balanced", "平衡辅助", true],
    ],
  );
  assert.deepEqual(
    state.rules.map((rule) => [rule.ruleId, rule.enabled, rule.priority]),
    [
      ["high-risk-review", true, 10],
      ["resume-limit", true, 20],
      ["tool-failure-review", true, 30],
    ],
  );
});

test("selects a known policy and ignores unknown policy ids", () => {
  const state = createDefaultPolicyCenterState();

  assert.equal(selectPolicy(state, "balanced").selectedPolicyId, "balanced");
  assert.equal(selectPolicy(state, "unknown").selectedPolicyId, "conservative");
});

test("toggles rules and clamps priority to a safe desktop range", () => {
  const state = createDefaultPolicyCenterState();
  const disabled = toggleRuleEnabled(state, "resume-limit");
  const prioritized = setRulePriority(disabled, "resume-limit", 200);

  assert.equal(disabled.rules.find((rule) => rule.ruleId === "resume-limit").enabled, false);
  assert.equal(prioritized.rules.find((rule) => rule.ruleId === "resume-limit").priority, 99);
});

test("disables a policy and falls back to the next enabled policy", () => {
  const state = createDefaultPolicyCenterState();
  const disabled = togglePolicyEnabled(state, "conservative");

  assert.equal(disabled.policies.find((policy) => policy.policyId === "conservative").enabled, false);
  assert.equal(disabled.selectedPolicyId, "read-only");
});

test("updates policy auto resume settings within a safe range", () => {
  const state = createDefaultPolicyCenterState();
  const updated = updatePolicyAutoResume(state, "balanced", false, 12);

  assert.equal(updated.policies.find((policy) => policy.policyId === "balanced").autoResumeEnabled, false);
  assert.equal(updated.policies.find((policy) => policy.policyId === "balanced").autoResumeLimit, 9);
});

test("loads persisted policy center state while preserving built-in definitions", async () => {
  const storage = new Map([
    [
      "gitworklog-policy-center-v1",
      JSON.stringify({
        selectedPolicyId: "balanced",
        policies: [
          { policyId: "read-only", enabled: true, autoResumeEnabled: false, autoResumeLimit: 0 },
          { policyId: "conservative", enabled: false, autoResumeEnabled: false, autoResumeLimit: 0 },
          { policyId: "balanced", enabled: true, autoResumeEnabled: true, autoResumeLimit: 4 },
        ],
        rules: [
          { ruleId: "resume-limit", enabled: false, priority: 5 },
          { ruleId: "unknown", enabled: false, priority: 1 },
        ],
      }),
    ],
  ]);

  const state = await loadPolicyCenterState(undefined, {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  });

  assert.equal(state.selectedPolicyId, "balanced");
  assert.equal(state.policies.find((policy) => policy.policyId === "balanced").autoResumeLimit, 4);
  assert.equal(state.rules.length, 3);
  assert.equal(state.rules.find((rule) => rule.ruleId === "resume-limit").enabled, false);
  assert.equal(state.rules.find((rule) => rule.ruleId === "resume-limit").priority, 5);
});

test("saves policy center state through the desktop bridge when available", async () => {
  const saved = [];
  const bridge = {
    api: {
      policyCenter: {
        getState: async () => createDefaultPolicyCenterState(),
        saveState: async (state) => {
          saved.push(state);
        },
      },
    },
  };

  await savePolicyCenterState(bridge, undefined, {
    ...createDefaultPolicyCenterState(),
    selectedPolicyId: "balanced",
  });

  assert.equal(saved.length, 1);
  assert.equal(saved[0].selectedPolicyId, "balanced");
});
