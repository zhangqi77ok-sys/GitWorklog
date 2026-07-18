# Web Console Information Architecture v1

## Purpose

The Web console should make the loop control plane understandable before real IPC data is wired in. The first screen presents the product around the core chain:

`Task -> LoopRun -> Evidence -> Decision -> Action -> Review`

## Layout

- Hero: explains local loop engineering and current runtime stance.
- Metrics: summarizes the latest evidence, decision, and action state.
- Task queue: keeps tasks as the primary object instead of raw sessions.
- Loop detail: shows the ordered control flow for the selected run.
- Review gate: highlights pending manual approval and active policy.

## Desktop UX Phase

The next console iteration uses a desktop-oriented control surface instead of a landing-page style layout:

- Left rail: product identity, primary sections, connection status, and quick actions.
- Main workspace: task queue, selected task summary, loop timeline, and evidence cues.
- Right inspector: review queue, approve/reject actions, and active policy explanation.
- Task creation: inline form for creating a task and its first conservative LoopRun through the desktop bridge.
- Empty states: each region must explain what the user can do next instead of showing blank panels.
- Selected LoopRun snapshot: the main workspace shows live counts for sessions, evidences, decisions, actions, and pending reviews.
- Session Discovery: the right inspector can scan local Codex sessions and bind one to the selected LoopRun.
- Replay seed timeline: Loop Detail shows recent session events from the selected LoopRun so users can see the beginning of an audit trail before the full Replay page exists.

Interaction rules:

- Desktop bridge data is preferred; browser preview uses fixture data.
- Create/approve/reject actions refresh visible console state after completion.
- Selecting a task loads its latest LoopRun snapshot when `loopRunId` exists.
- Binding a session refreshes task data and the selected LoopRun snapshot.
- Session events in the selected snapshot render newest first and use short readable summaries.
- Session cards expose an explicit import action that reads bound Codex JSONL events and refreshes the selected snapshot.
- Risk and policy language stays visible near destructive or automation-related actions.

## Wiring Plan

The current UI reads task and review data from `window.gitWorklog.api` when running in Electron, with fixture fallback for browser-only previews.

Implemented bridge-backed slices:

- Task list and Review Queue load from `window.gitWorklog.api`.
- Task creation calls `tasks:createAndRun`.
- Review approve/reject calls `reviews:approve` and `reviews:reject`.
- Selected task snapshot calls `loopRuns:snapshot`.
- Session Discovery calls `sessions:discover` and `sessions:bind`.
- Loop Detail renders `sessionEvents` from `loopRuns:snapshot` as the first Replay/Audit surface.
- Session event import calls `sessions:ingestEvents`.

Next implementation slices:

- Add Replay & Audit view for event/evidence/decision/action history.
- Add a dedicated Replay & Audit page that combines session events, evidence, decisions, actions, and review results.
