import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { ExecutionModeCapsule } from './ExecutionModeCapsule';

describe('ExecutionModeCapsule Component', () => {
  it('exports ExecutionModeCapsule component as a callable functional component', () => {
    expect(ExecutionModeCapsule).toBeDefined();
    expect(typeof ExecutionModeCapsule).toBe('function');
  });

  it('can be invoked as a React element with coding mode props', () => {
    const onModeChange = vi.fn();
    const element = React.createElement(ExecutionModeCapsule, {
      mode: 'coding',
      onModeChange,
      swarmBudgetTokens: 25000,
    });

    expect(element).toBeDefined();
    expect(element.props.mode).toBe('coding');
    expect(element.props.swarmBudgetTokens).toBe(25000);
  });

  it('can be invoked as a React element with swarm mode props', () => {
    const onModeChange = vi.fn();
    const element = React.createElement(ExecutionModeCapsule, {
      mode: 'swarm',
      onModeChange,
      swarmBudgetTokens: 50000,
    });

    expect(element).toBeDefined();
    expect(element.props.mode).toBe('swarm');
    expect(element.props.swarmBudgetTokens).toBe(50000);
  });
});
