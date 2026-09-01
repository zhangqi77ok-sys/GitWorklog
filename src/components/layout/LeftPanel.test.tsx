import { describe, it, expect } from 'vitest';
import { LeftPanel } from './LeftPanel';

describe('LeftPanel', () => {
  it('is defined and exports a React FC component', () => {
    expect(LeftPanel).toBeDefined();
    expect(typeof LeftPanel).toBe('function');
  });
});
