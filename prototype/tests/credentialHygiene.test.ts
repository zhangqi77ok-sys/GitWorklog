import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SECRET_PATTERN = /sk-[A-Za-z0-9_-]{16,}/g;

// Documented test fixtures / runtime-cleared placeholder sentinels.
// REAL secrets must NEVER be added here; only clearly-fake test literals.
const DOCUMENTED_FAKES = new Set([
  'sk-abcdef1234567890xyz',
  'sk-proj-1234567890abcdef1234567890',
  'sk-custom-real-key-12345678',
  'sk-test-masking-key-0123456789abcd',
  'sk-dashscope-9284719284',
  'sk-sf-938471928471928374',
  'sk-oneapi-9384719284719284',
  'sk-tcode-bogus-1234',
  'sk-invalid-key-test-999'
]);

function collectSourceFiles(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git' || entry === 'coverage') continue;
      collectSourceFiles(full, out);
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx') || entry.endsWith('.py')) {
      out.push(full);
    }
  }
  return out;
}

function findOffenders(dir: string, allowlisted: Set<string> = new Set()): Array<{ file: string; snippet: string }> {
  const offenders: Array<{ file: string; snippet: string }> = [];
  const files = collectSourceFiles(dir, []);
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const match = content.match(SECRET_PATTERN);
    if (match) {
      for (const snippet of match) {
        if (!allowlisted.has(snippet)) {
          offenders.push({ file: file.replace(process.cwd(), ''), snippet });
        }
      }
    }
  }
  return offenders;
}

describe('RunEngine P0 - credential hygiene (no hardcoded secrets in source)', () => {
  it('prototype/src must not contain real sk- secret literals', () => {
    // Documented placeholder sentinels that the runtime actively clears at load
    // time (PLACEHOLDER_PROVIDER_KEYS sanitization) - they are NOT real secrets.
    const offenders = findOffenders(join(process.cwd(), 'src'), DOCUMENTED_FAKES);
    expect(offenders).toEqual([]);
  });

  it('prototype/tests must not contain real sk- secret literals', () => {
    const offenders = findOffenders(join(process.cwd(), 'tests'), DOCUMENTED_FAKES);
    expect(offenders).toEqual([]);
  });

  it('desktop host & scripts (ts/py) must not contain real sk- secret literals', () => {
    const offenders: Array<{ file: string; snippet: string }> = [];
    for (const dir of ['../src-desktop', '../scripts']) {
      offenders.push(...findOffenders(join(process.cwd(), dir), DOCUMENTED_FAKES));
    }
    expect(offenders).toEqual([]);
  });
});
