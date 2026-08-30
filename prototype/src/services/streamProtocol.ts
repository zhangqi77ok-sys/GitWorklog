export type StreamTermination = 'completed' | 'interrupted' | 'cancelled';

export interface StreamTerminationInput {
  readerDone: boolean;
  sawDoneSentinel: boolean;
  sawFinishReason: boolean;
  aborted?: boolean;
}

export function classifyStreamTermination(input: StreamTerminationInput): StreamTermination {
  if (input.aborted) return 'cancelled';
  if (input.sawDoneSentinel || input.sawFinishReason) return 'completed';
  return input.readerDone ? 'interrupted' : 'interrupted';
}

export function isNormalStreamTermination(input: StreamTerminationInput): boolean {
  return classifyStreamTermination(input) === 'completed';
}
