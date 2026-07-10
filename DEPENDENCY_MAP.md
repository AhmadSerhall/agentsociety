# Meaningful Dependency Map

```text
src/app/page.tsx (client-only dynamic import)
└── MissionControl — src/features/mission-control/mission-control.tsx
    ├── MissionBriefComposer (brief/config UI)
    │   └── MissionEngine.suggestMissionConfiguration
    ├── useMissionEngine (lifecycle bridge)
    │   ├── useMissionStore (canonical live MissionContext)
    │   ├── useHistoryStore (autosave)
    │   └── MissionEngine
    │       ├── agents/definitions.ts (roles + system prompts)
    │       ├── qwen-client.ts (network side effect) or mock-agent-runner.ts
    │       └── replay events on MissionContext
    ├── AgentCouncilRoom / panels (render MissionContext)
    ├── SidebarPageView
    │   ├── history-store.ts
    │   └── runtime-settings-store.ts → qwenConfig.ts / settingsPreferences.ts
    ├── ReplayControlBar → replay-store.ts → replay-engine.ts → mission-store.ts
    └── DrilldownDrawer → qwen-client.ts or mission launch/backlog
```

## State ownership

| State | Owner | Consumers |
| --- | --- | --- |
| Live mission context and running flag | `src/store/mission-store.ts` | engine hook, mission shell, council, all `src/panels/`, history/replay bridge |
| Engine instance/listeners/cancellation | `src/hooks/use-mission-engine.ts` | `MissionControl` only |
| Engine-internal mutable execution context | `src/services/mission-engine/mission-engine.ts` | emits snapshots to mission store via hook |
| Replay mode/time/events/preferences | `src/store/replay-store.ts` | replay controls, mission shell/header/war room |
| Persisted history entries | `src/store/history-store.ts` | composer, sidebar, history/reports pages, lifecycle autosave |
| Runtime API credentials/fallback/debug toggles | `src/store/runtime-settings-store.ts` | settings page, engine fallback decision |
| Local UI state (brief, dialogs, tabs, view) | `src/features/mission-control/mission-control.tsx` | direct children only |

## Rendering-only modules

- `src/panels/*.tsx` read mission-store data and render views; they should not own execution behavior.
- `src/features/mission-control/components/council/*.tsx` render/format active-mission data. `presentation-renderer.ts` and `agent-output-formatter.ts` are pure display-shaping helpers.
- `src/components/structured-content.tsx`, `src/components/space-background.tsx`, and `src/components/ui/` are shared presentation primitives.

## Side-effectful modules

- `src/services/qwen/qwen-client.ts`: browser `fetch`, timeout/retry, SSE response parsing, API errors.
- `src/services/mission-engine/mission-engine.ts`: asynchronous execution/timers, event listeners, cancellation, API/mock invocation, replay recording.
- `src/store/history-store.ts`, `src/store/runtime-settings-store.ts`, `src/lib/qwenConfig.ts`, `src/lib/settingsPreferences.ts`: `localStorage` and document appearance updates.
- `src/store/replay-store.ts`: writes reconstructed state to the mission store and toggles the global replay guard.
- `src/utils/report-export.ts`: clipboard/download browser operations.

## Coupling and safe edit boundaries

| Area | Coupling | Safe independent changes |
| --- | --- | --- |
| Input/composer | Medium to shell/hook contracts | copy, layout, examples, config controls that retain props |
| Council/panels | Low to data-shape contract | visual/layout/formatting work within a panel or council child |
| Presentation helpers | Shared by several renderers | change carefully; validate affected report/dialogue/workstream displays |
| Settings UI | Medium to runtime settings contracts | control layout/labels; inspect persistence for new settings |
| History UI | Medium to history entry schema | visual filtering/export work |
| Engine/types/replay | Tight | change as one coordinated system and validate execution/replay |
| Qwen config/client/engine fallback | Tight | inspect all three when changing request, key, or failure behavior |
