import { ManagedRule, INITIAL_MANAGED_RULES } from '../types/contracts';

const STORAGE_KEY_RULES = 'tcode_managed_rules';

let memoryRulesCache: ManagedRule[] | null = null;

export function loadSavedRules(): ManagedRule[] {
  if (memoryRulesCache) {
    return memoryRulesCache;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_RULES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryRulesCache = parsed;
          return parsed;
        }
      }
    }
  } catch (e) {}
  memoryRulesCache = INITIAL_MANAGED_RULES;
  return INITIAL_MANAGED_RULES;
}

export function saveRulesToStorage(rules: ManagedRule[]): void {
  memoryRulesCache = rules;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules));
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('codemind_rules_updated', { detail: rules }));
    }
  } catch (e) {}
}

export function getActiveRulesList(rules?: ManagedRule[]): ManagedRule[] {
  const current = rules || loadSavedRules();
  return current.filter(r => r.enabled).sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

export function toggleRuleState(ruleId: string): ManagedRule[] {
  const current = loadSavedRules();
  const updated = current.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled, updatedAt: Date.now() } : r);
  saveRulesToStorage(updated);
  return updated;
}

export function addManagedRule(newRule: Omit<ManagedRule, 'id' | 'updatedAt' | 'version'>): ManagedRule[] {
  const current = loadSavedRules();
  const rule: ManagedRule = {
    ...newRule,
    id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    updatedAt: Date.now(),
    version: 1
  };
  const updated = [rule, ...current];
  saveRulesToStorage(updated);
  return updated;
}

export function updateManagedRule(ruleId: string, updates: Partial<ManagedRule>): ManagedRule[] {
  const current = loadSavedRules();
  const updated = current.map(r => r.id === ruleId ? {
    ...r,
    ...updates,
    updatedAt: Date.now(),
    version: (r.version || 1) + 1
  } : r);
  saveRulesToStorage(updated);
  return updated;
}

export function deleteManagedRule(ruleId: string): ManagedRule[] {
  const current = loadSavedRules();
  const updated = current.filter(r => r.id !== ruleId);
  saveRulesToStorage(updated);
  return updated;
}

/** Formats the currently active rules into a markdown snapshot injected into the agent system prompt */
export function buildPromptRulesSnapshot(rules?: ManagedRule[]): {
  rulesSnapshotText: string;
  activeCount: number;
  snapshotId: string;
} {
  const active = getActiveRulesList(rules);
  const snapshotId = `rules-snapshot-${new Date().toISOString().slice(0, 10)}-${Date.now().toString().slice(-4)}`;
  
  if (active.length === 0) {
    return {
      rulesSnapshotText: '',
      activeCount: 0,
      snapshotId
    };
  }

  const categoryNames: Record<string, string> = {
    iron_law: '项目铁律',
    team_rule: '团队规范',
    lesson: '经验沉淀',
    global: '全局准则'
  };

  const lines = [
    `\n📜【Tcode 生效规则快照】(共 ${active.length} 条 · 快照: ${snapshotId}):`
  ];

  active.forEach((r, idx) => {
    const cat = categoryNames[r.category] || r.category;
    lines.push(`${idx + 1}. [${cat} | 来源: ${r.sourceFile}] ${r.title}: ${r.description}`);
  });

  return {
    rulesSnapshotText: lines.join('\n') + '\n',
    activeCount: active.length,
    snapshotId
  };
}

