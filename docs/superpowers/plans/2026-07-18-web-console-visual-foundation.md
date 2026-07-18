# Web Console Visual Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current warm prototype styling with the first Engineering Mission Control visual foundation while preserving existing React data flow.

**Architecture:** This phase is CSS-first. `apps/web/src/App.tsx` keeps the same data operations and receives only small class/label adjustments if needed. `apps/web/src/styles.css` owns design tokens, shell surfaces, queue rows, cockpit surfaces, signal chips, timeline, inspector panels, and state badges.

**Tech Stack:** React, TypeScript, Vite, CSS, Node test runner.

## Global Constraints

- Preserve all existing desktop bridge behavior.
- Do not add new backend capabilities in this phase.
- Use `docs/web-console-visual-redesign-v2.md` as the visual source of truth.
- Keep the UI desktop-first and readable around 1280px width.
- Run `cmd /c npm.cmd run test --workspace @gitworklog/web`, `cmd /c npm.cmd run typecheck`, and `cmd /c npm.cmd run build` before commit.

---

### Task 1: Visual Foundation Tokens

**Files:**
- Modify: `apps/web/src/styles.css`
- Modify: `docs/v1-development-task-breakdown.md`
- Modify: `docs/web-console-information-architecture-v1.md`

**Interfaces:**
- Consumes: Existing CSS class names from `apps/web/src/App.tsx`.
- Produces: Dark graphite CSS variables and base typography used by later component styling.

- [ ] **Step 1: Snapshot current Web test baseline**

Run: `cmd /c npm.cmd run test --workspace @gitworklog/web`
Expected: PASS with existing tests.

- [ ] **Step 2: Replace root tokens and global surface**

Update `apps/web/src/styles.css` `:root` and `body` to use:

```css
:root {
  color-scheme: dark;
  --bg: #0b0d10;
  --bg-grid: rgba(88, 166, 255, 0.045);
  --surface: #11151b;
  --surface-raised: #171c24;
  --surface-soft: rgba(23, 28, 36, 0.76);
  --ink: #e6edf3;
  --muted: #8b949e;
  --faint: #6e7681;
  --line: rgba(148, 163, 184, 0.16);
  --line-strong: rgba(148, 163, 184, 0.28);
  --accent: #58a6ff;
  --success: #3fb950;
  --warning: #d29922;
  --danger: #f85149;
  --review: #bc8cff;
  --shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
  --radius-panel: 18px;
  --radius-control: 12px;
}
```

- [ ] **Step 3: Run Web test**

Run: `cmd /c npm.cmd run test --workspace @gitworklog/web`
Expected: PASS.

### Task 2: Mission Control Layout Styling

**Files:**
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: Current `desktop-shell`, `side-rail`, `workbench`, `inspector`, `top-bar`, `workspace-layout`.
- Produces: A darker desktop shell with center Loop area visually dominant.

- [ ] **Step 1: Rework shell panels**

Update layout classes so:

```css
.desktop-shell { background: ...; grid-template-columns: 232px minmax(620px, 1fr) 344px; }
.side-rail { background: linear-gradient(180deg, #0f141b, #0b0d10); border: 1px solid var(--line); }
.top-bar { background: var(--surface-soft); border: 1px solid var(--line); }
.panel, .metric-card { background: var(--surface); border: 1px solid var(--line); box-shadow: none; }
.loop-zone { background: linear-gradient(180deg, rgba(23, 28, 36, 0.98), rgba(14, 18, 24, 0.96)); }
```

- [ ] **Step 2: Run Web build**

Run: `cmd /c npm.cmd run build --workspace @gitworklog/web`
Expected: PASS.

### Task 3: Component Visual Polish

**Files:**
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: Existing task cards, metrics, session cards, review cards, timeline cards.
- Produces: Queue-like task rows, compact signal chips, stronger timeline and review visual hierarchy.

- [ ] **Step 1: Rework task, metric, session, review, timeline styles**

Make:

- `.task-card` feel like queue rows.
- `.metric-card` feel like signal chips.
- `.event-card` use monospaced metadata and accent rail.
- `.review-card` use warning/review tone.
- `.session-card button` use command-style controls.

- [ ] **Step 2: Run Web tests**

Run: `cmd /c npm.cmd run test --workspace @gitworklog/web`
Expected: PASS.

### Task 4: Documentation And Final Verification

**Files:**
- Modify: `docs/v1-development-task-breakdown.md`
- Modify: `docs/web-console-information-architecture-v1.md`

**Interfaces:**
- Consumes: Existing UI v2 documentation.
- Produces: Records that Phase 1 visual foundation has been implemented.

- [ ] **Step 1: Update docs**

Add notes that Phase 1 introduces:

- Graphite theme tokens.
- Dark desktop control-plane shell.
- Queue rows and signal chips.
- Existing bridge behavior preserved.

- [ ] **Step 2: Run final verification**

Run:

```powershell
cmd /c npm.cmd run typecheck
cmd /c npm.cmd run build
cmd /c npm.cmd run test --workspace @gitworklog/web
cmd /c npm.cmd audit --audit-level=moderate
```

Expected: all commands exit 0.

- [ ] **Step 3: Commit**

```powershell
git add apps/web/src/styles.css docs/v1-development-task-breakdown.md docs/web-console-information-architecture-v1.md docs/superpowers/plans/2026-07-18-web-console-visual-foundation.md
git commit -m "feat: apply mission control visual foundation"
```
