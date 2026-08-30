export type WorkflowProviderKind = 'builtin' | 'workspace' | 'user' | 'cli';
export type WorkflowProviderSupport = 'native' | 'manifest' | 'cli_adapter' | 'discovered_only';
export type WorkflowSelectionState = 'normal' | 'discovered' | 'selected' | 'active' | 'cancelled';
export type WorkflowMode = 'normal' | 'sdd' | 'tdd' | 'sdd_tdd' | 'custom';

export interface WorkflowProviderManifest {
  id: string;
  displayName: string;
  version?: string;
  kind: WorkflowProviderKind;
  source: string;
  support: WorkflowProviderSupport;
  capabilities: string[];
  phases: Array<{
    id: string;
    title: string;
    requiresUserConfirmation: boolean;
  }>;
  permissions: Array<'read_files' | 'write_files' | 'run_commands' | 'network'>;
}

export interface WorkflowIntent {
  mode: WorkflowMode;
  providerId?: string;
  source: 'explicit' | 'ambiguous' | 'negative' | 'none';
  confidence: number;
  matchedTerms: string[];
  userConfirmed: boolean;
}

export interface WorkflowSelection {
  providerId?: string;
  mode: WorkflowMode;
  state: WorkflowSelectionState;
  confirmedAt?: number;
}

const EDUCATIONAL_INTENT = /什么是|解释|区别|介绍|定义|含义|了解/i;
const NEGATIVE_INTENT = /(?:不要|不用|无需|不使用|别用|不走)[^。！？\n]{0,14}(?:sdd|tdd|superspec|spec\s*kit|openspec)/i;
const AMBIGUOUS_INTENT = /最佳实践|专业流程|规范开发|结构化开发|工作流|方法论/i;
const EXPLICIT_INTENT = /使用|采用|启用|按照|按|用|走|use|with|workflow/i;

function hasTerm(input: string, term: RegExp): boolean {
  return term.test(input);
}

export function classifyWorkflowIntent(input: string): WorkflowIntent {
  const text = input.trim();
  const normalized = text.toLowerCase();
  const emptyIntent: WorkflowIntent = {
    mode: 'normal',
    source: 'none',
    confidence: 1,
    matchedTerms: [],
    userConfirmed: false
  };

  if (!text) return emptyIntent;

  const workflowTerms = normalized.match(/sdd|tdd|superspec|spec\s*kit|openspec/gi) || [];
  if (hasTerm(text, NEGATIVE_INTENT)) {
    return {
      ...emptyIntent,
      source: 'negative',
      confidence: 1,
      matchedTerms: workflowTerms
    };
  }

  if (workflowTerms.length > 0 && hasTerm(text, EDUCATIONAL_INTENT) && !hasTerm(text, EXPLICIT_INTENT)) {
    return { ...emptyIntent, matchedTerms: workflowTerms };
  }

  const hasExplicitRequest = hasTerm(text, EXPLICIT_INTENT);
  const hasSdd = /\bsdd\b/i.test(text);
  const hasTdd = /\btdd\b/i.test(text);
  const hasSuperspec = /superspec/i.test(text);
  const hasOtherExternalProvider = /spec\s*kit|openspec/i.test(text);

  if (hasExplicitRequest && hasSuperspec) {
    return {
      mode: 'custom',
      providerId: 'superspec',
      source: 'explicit',
      confidence: 0.98,
      matchedTerms: ['Superspec'],
      userConfirmed: false
    };
  }

  if (hasExplicitRequest && hasOtherExternalProvider) {
    const providerId = /spec\s*kit/i.test(text) ? 'speckit' : 'openspec';
    return {
      mode: 'custom',
      providerId,
      source: 'explicit',
      confidence: 0.9,
      matchedTerms: workflowTerms,
      userConfirmed: false
    };
  }

  if (hasExplicitRequest && hasSdd && hasTdd) {
    return {
      mode: 'sdd_tdd',
      source: 'explicit',
      confidence: 0.99,
      matchedTerms: ['SDD', 'TDD'],
      userConfirmed: false
    };
  }

  if (hasExplicitRequest && hasSdd) {
    return {
      mode: 'sdd',
      source: 'explicit',
      confidence: 0.95,
      matchedTerms: ['SDD'],
      userConfirmed: false
    };
  }

  if (hasExplicitRequest && hasTdd) {
    return {
      mode: 'tdd',
      source: 'explicit',
      confidence: 0.95,
      matchedTerms: ['TDD'],
      userConfirmed: false
    };
  }

  if (hasTerm(text, AMBIGUOUS_INTENT)) {
    return {
      ...emptyIntent,
      source: 'ambiguous',
      confidence: 0.5,
      matchedTerms: []
    };
  }

  return { ...emptyIntent, matchedTerms: workflowTerms };
}

export function filterWorkflowProviders(
  providers: WorkflowProviderManifest[],
  query: string
): WorkflowProviderManifest[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return providers;

  return providers.filter(provider => [
    provider.id,
    provider.displayName,
    provider.source,
    ...provider.capabilities
  ].some(value => value.toLowerCase().includes(normalized)));
}

export function createWorkflowSelection(
  provider: WorkflowProviderManifest | undefined,
  mode: WorkflowMode
): WorkflowSelection {
  if (!provider || mode === 'normal') {
    return { mode: 'normal', state: 'normal' };
  }

  return {
    providerId: provider.id,
    mode,
    state: 'selected'
  };
}

export function confirmWorkflowSelection(
  selection: WorkflowSelection,
  now: number = Date.now()
): WorkflowSelection {
  if (selection.state !== 'selected' || !selection.providerId || selection.mode === 'normal') {
    return selection;
  }

  return {
    ...selection,
    state: 'active',
    confirmedAt: now
  };
}

export function cancelWorkflowSelection(selection: WorkflowSelection): WorkflowSelection {
  return {
    ...selection,
    state: 'cancelled',
    confirmedAt: undefined
  };
}

export function canExecuteWorkflowProvider(
  provider: WorkflowProviderManifest,
  selection: WorkflowSelection
): boolean {
  return selection.state === 'active'
    && selection.providerId === provider.id
    && provider.support !== 'discovered_only';
}
