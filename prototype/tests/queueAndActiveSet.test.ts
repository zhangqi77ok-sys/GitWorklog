import { describe, it, expect } from 'vitest';
import {
  enqueueItem,
  withdrawItem,
  editItem,
  moveItem,
  popNext,
  type QueuedPromptItem
} from '../src/services/promptQueueStore';
import { prioritizeActiveFiles } from '../src/services/cacheEngine';

const mk = (id: string, text: string): QueuedPromptItem => ({ id, text, createdAt: 1 });

describe('per-session prompt queue store (WP-C 完善)', () => {
  it('enqueue appends to the tail', () => {
    const q = enqueueItem([], mk('a', 'A'));
    const q2 = enqueueItem(q, mk('b', 'B'));
    expect(q2.map(i => i.id)).toEqual(['a', 'b']);
  });

  it('withdraw removes by id', () => {
    const q = [mk('a', 'A'), mk('b', 'B')];
    expect(withdrawItem(q, 'a').map(i => i.id)).toEqual(['b']);
  });

  it('edit updates text by id', () => {
    const q = [mk('a', 'A')];
    expect(editItem(q, 'a', 'Z')[0].text).toBe('Z');
  });

  it('moveItem shifts within bounds and is a no-op at edges', () => {
    const q = [mk('a', 'A'), mk('b', 'B'), mk('c', 'C')];
    expect(moveItem(q, 0, 1).map(i => i.id)).toEqual(['b', 'a', 'c']);
    expect(moveItem(q, 0, -1).map(i => i.id)).toEqual(['a', 'b', 'c']);
    expect(moveItem(q, 2, 1).map(i => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('popNext returns head item and remaining queue; empty queue -> null', () => {
    const q = [mk('a', 'A'), mk('b', 'B')];
    const { item, queue } = popNext(q);
    expect(item?.id).toBe('a');
    expect(queue.map(i => i.id)).toEqual(['b']);
    const empty = popNext([]);
    expect(empty.item).toBeNull();
  });
});

describe('active working set pinning (模块七 完善)', () => {
  it('prioritizeActiveFiles keeps active files first, capped at max', () => {
    const selected = ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts'].map(p => ({ filePath: p }));
    const active = ['src/c.ts', 'src/a.ts'];
    const out = prioritizeActiveFiles(selected, active, 3).map(f => f.filePath);
    expect(out[0]).toBe('src/c.ts');
    expect(out[1]).toBe('src/a.ts');
    expect(out).toHaveLength(3);
  });

  it('prioritizeActiveFiles ignores active files not in selection and keeps determinism', () => {
    const selected = ['src/b.ts', 'src/a.ts'].map(p => ({ filePath: p }));
    const out = prioritizeActiveFiles(selected, ['nope.ts', 'src/a.ts'], 5).map(f => f.filePath);
    expect(out).toEqual(['src/a.ts', 'src/b.ts']);
  });
});
