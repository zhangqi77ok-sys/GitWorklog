// Tcode Layout ???? (extracted from contracts.ts)
import type { WindowBreakpoint } from './contractsTypes';

export function clampLeftPanelWidth(width: number): number {
  return Math.min(Math.max(width, 180), 420);
}

export function clampLeftPanelWithCollapse(width: number): number {
  if (width < 80) return 0;
  return clampLeftPanelWidth(width);
}


export function clampWorkbenchWidth(width: number, containerWidth: number = 1440): number {
  const minWidth = 320;
  const maxWidth = Math.max(minWidth, containerWidth * 0.65);
  return Math.min(Math.max(width, minWidth), maxWidth);
}

export function clampTerminalHeightPercent(percent: number): number {
  return Math.min(Math.max(percent, 20), 80);
}


// ============================================================================
// 14. SENIOR DEV PRODUCTION FEATURES CONTRACTS (Lessons, CI, Commits, Probes, Blast)
// ============================================================================


export function clampChangesetHeight(height: number): number {
  return Math.min(Math.max(height, 80), 450);
}



export function getWindowBreakpoint(width: number): WindowBreakpoint {
  if (width >= 2000) return 'ultrawide';
  if (width >= 1400) return 'standard';
  if (width >= 1000) return 'laptop';
  return 'split_half';
}

// Session Tree Operations