/**
 * WP-C 完善：每会话 prompt 队列的纯函数存储。
 * App 按 sessionId 持有独立队列，互不串扰。
 */
import type { QueuedPromptItem } from '../types/contracts';
export type { QueuedPromptItem };

export function enqueueItem(queue: QueuedPromptItem[], item: QueuedPromptItem): QueuedPromptItem[] {
  return [...queue, item];
}

export function withdrawItem(queue: QueuedPromptItem[], id: string): QueuedPromptItem[] {
  return queue.filter(q => q.id !== id);
}

export function editItem(queue: QueuedPromptItem[], id: string, text: string): QueuedPromptItem[] {
  return queue.map(q => q.id === id ? { ...q, text } : q);
}

export function moveItem(queue: QueuedPromptItem[], index: number, direction: -1 | 1): QueuedPromptItem[] {
  const nextIdx = index + direction;
  if (nextIdx < 0 || nextIdx >= queue.length) return queue;
  const copy = [...queue];
  const tmp = copy[index];
  copy[index] = copy[nextIdx];
  copy[nextIdx] = tmp;
  return copy;
}

export function popNext(queue: QueuedPromptItem[]): { item: QueuedPromptItem | null; queue: QueuedPromptItem[] } {
  if (queue.length === 0) return { item: null, queue: [] };
  const [item, ...rest] = queue;
  return { item, queue: rest };
}
