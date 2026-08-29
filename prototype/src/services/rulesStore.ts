import { RuleItem, INITIAL_RULES } from '../types/contracts';

const STORAGE_KEY_RULES = 'codemind_unified_rules';

export function loadSavedRules(): RuleItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RULES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  return INITIAL_RULES;
}

export function saveRulesToStorage(rules: RuleItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules));
    window.dispatchEvent(new CustomEvent('codemind_rules_updated', { detail: rules }));
  } catch (e) {}
}

export function getActiveRulesList(rules?: RuleItem[]): RuleItem[] {
  const current = rules || loadSavedRules();
  return current.filter(r => r.enabled);
}

export function toggleRuleState(ruleId: string): RuleItem[] {
  const current = loadSavedRules();
  const updated = current.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r);
  saveRulesToStorage(updated);
  return updated;
}
