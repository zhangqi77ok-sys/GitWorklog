import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function collectTsFiles(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      collectTsFiles(full, out);
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('RunEngine P0 - credential hygiene (no hardcoded secrets in source)', () => {
  it('prototype/src must not contain real sk- secret literals', () => {
    const srcDir = join(process.cwd(), 'src');
    const files = collectTsFiles(srcDir, []);
    expect(files.length).toBeGreaterThan(0);
    const offenders: Array<{ file: string; snippet: string }> = [];
    // Documented placeholder sentinels that the runtime actively clears at load
    // time (PLACEHOLDER_PROVIDER_KEYS sanitization) - they are NOT real secrets.
    const allowlisted = new Set([
      'sk-dashscope-9284719284',
      'sk-sf-938471928471928374',
      'sk-oneapi-9384719284719284'
    ]);
    const secretPattern = /sk-[A-Za-z0-9_-]{16,}/g;
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const match = content.match(secretPattern);
      if (match) {
        for (const snippet of match) {
          if (!allowlisted.has(snippet)) {
            offenders.push({ file: file.replace(process.cwd(), ''), snippet });
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('desktop host scripts must not contain real sk- secret literals', () => {
    const dirs = ['../src-desktop', '../scripts'];
    const offenders: Array<{ file: string; snippet: string }> = [];
    const secretPattern = /sk-[A-Za-z0-9_-]{16,}/g;
    for (const dir of dirs) {
      const abs = join(process.cwd(), dir);
      if (!statSync(abs, { throwIfNoEntry: false })) continue;
      for (const file of collectTsFiles(abs, [])) {
        const content = readFileSync(file, 'utf-8');
        const match = content.match(secretPattern);
        if (match) offenders.push({ file: file.replace(process.cwd(), ''), snippet: match[0] });
      }
    }
    expect(offenders).toEqual([]);
  });
});
