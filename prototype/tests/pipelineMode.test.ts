import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PIPELINE_MODE,
  createPipelineState,
  selectPipelineMode,
  startPipelineRun
} from '../src/services/pipelineMode';

describe('Harness / Swarm pipeline mode contract', () => {
  it('defaults to the connected Harness execution engine', () => {
    expect(DEFAULT_PIPELINE_MODE).toBe('harness');
    expect(createPipelineState()).toEqual({
      mode: 'harness',
      status: 'ready'
    });
  });

  it('changes selection without creating a run', () => {
    const state = selectPipelineMode(createPipelineState(), 'swarm');

    expect(state).toEqual({
      mode: 'swarm',
      status: 'awaiting_start'
    });
  });

  it('does not auto-start when Swarm is selected', () => {
    const state = selectPipelineMode(createPipelineState(), 'swarm');

    expect(state.status).toBe('awaiting_start');
    expect('activeRunId' in state).toBe(false);
  });

  it('enters running only after an explicit start returns a run id', () => {
    const selected = selectPipelineMode(createPipelineState(), 'swarm');

    expect(startPipelineRun(selected, { runId: 'swarm-run-1', accepted: true })).toEqual({
      mode: 'swarm',
      status: 'running',
      activeRunId: 'swarm-run-1'
    });
  });

  it('reports unavailable instead of pretending to run when start is rejected', () => {
    const selected = selectPipelineMode(createPipelineState(), 'swarm');

    expect(startPipelineRun(selected, { accepted: false })).toEqual({
      mode: 'swarm',
      status: 'unavailable'
    });
  });
});
