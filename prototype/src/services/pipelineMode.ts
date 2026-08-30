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

export function createPipelineState(): PipelineState {
  return {
    mode: DEFAULT_PIPELINE_MODE,
    status: 'ready'
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
