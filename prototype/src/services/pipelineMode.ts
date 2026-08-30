import { saveToDiskStorageAsync } from '../types/contracts';

export type PipelineMode = 'harness' | 'swarm';

export type PipelineExecutionStatus =
  | 'ready'
  | 'awaiting_start'
  | 'running'
  | 'unavailable';

export interface PipelineState {
  mode: PipelineMode;
  status: PipelineExecutionStatus;
  activeRunId?: string;
}

export interface PipelineStartResult {
  accepted: boolean;
  runId?: string;
}

export const DEFAULT_PIPELINE_MODE: PipelineMode = 'harness';

export function loadSavedPipelineMode(): PipelineMode {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('tcode_pipeline_mode');
      if (saved === 'swarm' || saved === 'harness') {
        return saved;
      }
    }
  } catch (e) {}
  return DEFAULT_PIPELINE_MODE;
}

export function savePipelineModeToStorage(mode: PipelineMode): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tcode_pipeline_mode', mode);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tcode_pipeline_mode_updated', { detail: mode }));
      }
    }
    saveToDiskStorageAsync('tcode_pipeline_mode', { mode });
  } catch (e) {}
}

export function createPipelineState(initialMode?: PipelineMode): PipelineState {
  const mode = initialMode || loadSavedPipelineMode();
  return {
    mode,
    status: mode === 'swarm' ? 'awaiting_start' : 'ready'
  };
}

export function selectPipelineMode(
  _state: PipelineState,
  mode: PipelineMode
): PipelineState {
  return mode === 'swarm'
    ? { mode, status: 'awaiting_start' }
    : { mode, status: 'ready' };
}

export function startPipelineRun(
  state: PipelineState,
  result: PipelineStartResult
): PipelineState {
  if (state.mode !== 'swarm') {
    return state;
  }

  if (!result.accepted || !result.runId) {
    return {
      mode: 'swarm',
      status: 'unavailable'
    };
  }

  return {
    mode: 'swarm',
    status: 'running',
    activeRunId: result.runId
  };
}
