# Web Console Visual Redesign v2

## Purpose

The current Web console has useful product functions, but its visual language does not yet match the product ambition. It feels like a warm demo dashboard, not a desktop-grade control plane for AI coding loops.

This redesign defines the next visual direction before implementation so future UI work is intentional, consistent, and easier to evaluate.

## Product Position

GitWorklog should feel like an engineering mission control product:

- A desktop control plane for AI coding tasks.
- A system that watches, audits, and resumes loops.
- A tool for developers who need confidence, not decorative UI.

The UI should communicate: precise, technical, calm, inspectable, and action-oriented.

## Industry References

The redesign should learn from these product categories rather than copying one product directly:

- AI coding and IDE products: Cursor, GitHub Copilot, JetBrains.
- Observability and incident platforms: Datadog, Grafana-style dashboards.
- High-density productivity tools: Linear, Raycast, Notion Projects.

Useful patterns:

- IDE products keep the current task and active context central.
- Observability products make state, event timelines, and risk easy to scan.
- Linear/Raycast-style tools use restrained surfaces, crisp typography, and strong command affordances.

Patterns to avoid:

- Marketing-page gradients and oversized hero treatment inside a desktop tool.
- Generic SaaS dashboard cards with weak relationships between panels.
- Decorative warmth that competes with status and risk signals.

## Current UI Problems

The current UI should be treated as a functional prototype, not the final design.

Main issues:

- The beige paper texture makes the product feel soft and editorial instead of operational.
- Cards repeat the same visual weight, so task, evidence, action, and review feel equally important.
- The main action path is not dominant enough: create task, bind session, import events, run analysis, review.
- The layout is a three-column shell, but the center does not yet feel like the cockpit of the product.
- Mixed Chinese and English labels are visually uneven and do not follow a naming system.
- Status colors are not systematic enough for failed, running, review, risk, and completed states.

## Recommended Direction

Use the direction: **Engineering Mission Control**.

This direction combines:

- IDE-like focus on the selected task.
- Observability-like timelines and status markers.
- Linear-like density, polish, and restraint.

The UI should use a dark neutral foundation with precise panels and limited high-signal color.

Visual keywords:

- Graphite
- Terminal glass
- Signal lines
- Command center
- Audit trail
- Risk gate

## Layout Model

Keep the three-region desktop structure, but change the visual hierarchy.

### Left Rail

Purpose:

- Navigation
- Product identity
- Workspace status
- Global command entry

Design:

- Narrower than current rail.
- Dark graphite background.
- Icon-first navigation with short labels.
- Connection state as a compact system indicator, not a large card.

Content:

- GitWorklog logo / product mark.
- Tasks
- Loop Detail
- Replay
- Review
- Policy
- Settings
- Desktop bridge status.

### Center Mission Area

Purpose:

- Own the selected LoopRun.
- Show current objective, state, event/evidence timeline, and primary action.

Design:

- Largest visual area.
- Top command strip: selected task title, status, risk, primary action.
- Timeline-first layout: session events, evidence, decisions, actions.
- Metrics become compact chips, not large cards.

Primary actions:

- Run analysis
- Import latest events
- Open Replay
- Mark for review

### Right Inspector

Purpose:

- Contextual controls and supporting information.
- Review Queue
- Session Discovery
- Policy Gate

Design:

- Inspector panels should be quieter than center.
- Each panel has one clear purpose.
- Buttons should be command-like, not oversized form buttons.

## Visual System

### Color

Use dark neutral as the base.

Suggested palette:

- Background: `#0B0D10`
- Surface: `#11151B`
- Elevated surface: `#171C24`
- Border: `rgba(148, 163, 184, 0.16)`
- Primary text: `#E6EDF3`
- Secondary text: `#8B949E`
- Accent blue: `#58A6FF`
- Success green: `#3FB950`
- Warning amber: `#D29922`
- Danger red: `#F85149`
- Review violet: `#BC8CFF`

Rules:

- Use accent blue for current selection and primary commands.
- Use red only for real failed/risk states.
- Use amber for waiting/review signals.
- Avoid large colored backgrounds except for selected items or high-risk alerts.

### Typography

Use a technical but readable stack:

- UI: `IBM Plex Sans`, `Segoe UI`, `PingFang SC`, sans-serif.
- Code / IDs / event payloads: `JetBrains Mono`, `Cascadia Code`, monospace.

Rules:

- Reduce oversized display headings.
- Use tight labels and strong hierarchy.
- Make IDs, commands, event types, and timestamps monospaced.

### Shape And Depth

Rules:

- Border radius: 10-14px for controls, 14-18px for panels.
- Avoid heavy shadows.
- Use thin borders and subtle background contrast.
- Prefer density over empty decorative space.

### Motion

Use motion sparingly:

- Short fade/slide when switching selected task.
- Subtle pulse only for active running state.
- No decorative perpetual animation except live status.

## Component Redesign

### Task List

Current problem:

- Task cards look like generic content cards.

New design:

- Task rows should look like queue items.
- Each row shows status, title, latest loop status, risk, and updated time.
- Selected task gets a left accent rail and brighter surface.

### Loop Header

New component:

- Task title
- LoopRun state
- Risk badge
- Policy badge
- Primary action button
- Secondary actions menu

This becomes the cockpit header.

### Snapshot Metrics

Current problem:

- Large metric cards consume too much attention.

New design:

- Compact signal chips:
  - Events
  - Evidence
  - Decisions
  - Actions
  - Reviews

### Timeline

Current problem:

- Timeline exists but feels like a secondary card.

New design:

- Timeline becomes central.
- Each entry has:
  - Timestamp
  - Type
  - Source session
  - Short summary
  - Link to related evidence/action when available

### Review Queue

New design:

- Use high-contrast action cards only for pending reviews.
- Show why review is required.
- Buttons:
  - Approve
  - Reject
  - Inspect

### Session Discovery

New design:

- Sessions should be small attachable sources.
- Bind / Import should be compact commands.
- Bound sessions should move from discovery into Loop context.

## Interaction Path

The primary user path should be visually obvious:

1. Create or select a task.
2. Bind a Codex session.
3. Import events.
4. Run analysis.
5. Review suggested action.
6. Replay audit trail.

The current UI supports these operations, but the redesign should make them feel like one continuous workflow.

## Implementation Phases

### Phase 1: Visual Foundation

- Replace warm beige theme with graphite mission-control theme.
- Introduce design tokens in CSS variables.
- Rework global typography and spacing.
- Keep existing React data flow unchanged.

### Phase 2: Layout Hierarchy

- Convert top bar into Loop cockpit header.
- Reduce metric cards into compact signal chips.
- Make timeline central in Loop Detail.
- Tighten left rail and right inspector density.

### Phase 3: Component Polish

- Redesign task rows.
- Redesign session source cards.
- Redesign review cards.
- Add status badge system.
- Add empty states that feel operational, not decorative.

### Phase 4: Replay Page

- Add dedicated Replay & Audit page using the same timeline system.
- Show events, evidence, decisions, actions, and reviews in one chain.

## Acceptance Criteria

The redesigned console is acceptable when:

- It no longer feels like a generic SaaS dashboard.
- The selected task and LoopRun are visually dominant.
- The primary workflow can be understood without reading documentation.
- Status, risk, review, and failure states are visually distinct.
- The UI remains readable at desktop widths around 1280px.
- The visual system can be extended to Replay, Policy, and Settings without another redesign.

## Non-Goals

This redesign does not include:

- New backend features.
- Real-time streaming.
- Full Replay page implementation.
- Custom icon system beyond basic text/icon placeholders.
- Mobile-first layout.

## Decision

Proceed with **Engineering Mission Control** as the v2 visual direction.

The current UI should be refactored in phases rather than replaced with an unrelated prototype. Existing working data flows should stay intact while visual hierarchy and component structure improve.
