export type ReplayAuditKind = "event" | "evidence" | "decision" | "action" | "review";
export type ReplayAuditFilter = "all" | ReplayAuditKind;

export interface ReplayAuditEntry {
  id: string;
  kind: ReplayAuditKind;
  title: string;
  detail: string;
  meta?: string;
  createdAt?: string;
}

export interface ReplayAuditState {
  filter: ReplayAuditFilter;
  selectedEntryId?: string;
}

export function buildReplayAuditState(entries: ReplayAuditEntry[]): ReplayAuditState {
  return {
    filter: "all",
    selectedEntryId: entries[0]?.id,
  };
}

export function filterReplayAuditEntries(
  entries: ReplayAuditEntry[],
  filter: ReplayAuditFilter,
): ReplayAuditEntry[] {
  return filter === "all" ? entries : entries.filter((entry) => entry.kind === filter);
}

export function selectReplayAuditFilter(
  state: ReplayAuditState,
  filter: ReplayAuditFilter,
  entries: ReplayAuditEntry[],
): ReplayAuditState {
  const visibleEntries = filterReplayAuditEntries(entries, filter);
  const selectedEntryId = visibleEntries.some((entry) => entry.id === state.selectedEntryId)
    ? state.selectedEntryId
    : visibleEntries[0]?.id;

  return {
    filter,
    selectedEntryId,
  };
}

export function selectReplayAuditEntry(
  state: ReplayAuditState,
  entryId: string,
  entries: ReplayAuditEntry[],
): ReplayAuditState {
  if (!entries.some((entry) => entry.id === entryId)) {
    return state;
  }

  return {
    ...state,
    selectedEntryId: entryId,
  };
}

export function selectReplayAuditRelatedEntry(
  state: ReplayAuditState,
  relatedId: string,
  entries: ReplayAuditEntry[],
): ReplayAuditState {
  const relatedEntry = entries.find((entry) => entry.id === relatedId) ?? entries.find((entry) => entry.meta === relatedId);

  if (!relatedEntry) {
    return state;
  }

  return {
    filter: "all",
    selectedEntryId: relatedEntry.id,
  };
}
