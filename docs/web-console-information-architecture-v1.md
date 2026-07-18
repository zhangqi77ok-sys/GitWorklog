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

## Wiring Plan

The current UI uses local example data only. The next implementation slice should replace the arrays in `App.tsx` with calls to the desktop bridge backed by `DesktopAppService`.

