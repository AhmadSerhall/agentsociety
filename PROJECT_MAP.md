# Project Map — Agent Society

## 1. Project overview

Agent Society is a frontend-first AI Mission Control dashboard. A user submits a mission brief; the browser classifies it, plans or directly assigns agent work, runs Qwen/DashScope-backed (or mock) specialist workstreams, resolves conflicts, records replay events, and presents a final report.

- Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Framer Motion, Zustand, React Query, shadcn/Radix UI, React Flow, Recharts.
- Architecture: one client-rendered mission-control feature coordinates Zustand stores, a stateful `MissionEngine`, and a browser-side Qwen-compatible client.
- Runtime: no bundled backend/database. Settings, history, and replay data use browser `localStorage`; Qwen calls originate in the browser. `src/app/page.tsx` disables SSR for the dashboard.
- Do not read `.env*` files for normal work; user keys are client-visible by design and must never be documented or exposed.

## 2. Top-level structure

```text
src/app/                             Next entry, layout, providers, global styles
src/features/mission-control/         Mission Control shell and feature UI
src/features/mission-control/components/council/  Active-mission council UI and presentation helpers
src/services/mission-engine/          Classification, graph orchestration, execution, conflicts, replay recording
src/services/qwen/                    Qwen/DashScope-compatible browser client and mock client
src/services/replay/                  Replay state reconstruction/statistics
src/store/                            Zustand mission, history, replay, and runtime-settings stores
src/types/                            Shared domain/API/event TypeScript types
src/agents/                           Agent definitions, registry, base class
src/panels/                           Reusable mission-data panels (graph, report, timeline, etc.)
src/lib/                              Qwen/settings persistence, query client, generic utilities
src/utils/                            IDs, display/sanitizing, report export
src/components/                       Shared background/structured content and shadcn UI primitives
public/                               Static assets; normally avoid for behavior changes
```

## 3. Application entry points

| Responsibility | File |
| --- | --- |
| Next route entry / client-only dashboard loading | `src/app/page.tsx` |
| Root HTML, fonts, global CSS, toast mount | `src/app/layout.tsx` |
| React Query provider | `src/app/providers.tsx`, `src/lib/query-client.ts` |
| Main application shell / initial history & settings load | `src/features/mission-control/mission-control.tsx` |
| Mission lifecycle bridge | `src/hooks/use-mission-engine.ts` |
| Mission state initialization | `src/store/mission-store.ts` |
| Orchestration / service initialization | `src/services/mission-engine/mission-engine.ts` |

## 4. Feature-to-file map

| Feature or UI area | Primary files | Supporting files | Notes |
| --- | --- | --- | --- |
| Mission input & launch | `src/features/mission-control/components/mission-brief-composer.tsx`, `src/features/mission-control/mission-control.tsx` | `src/hooks/use-mission-engine.ts`, `src/store/mission-store.ts` | Brief, Enter-to-launch, examples, validation. |
| Mission configuration suggestions | `src/features/mission-control/components/mission-brief-composer.tsx` | `src/services/mission-engine/mission-engine.ts`, `src/types/config.types.ts` | Uses `MissionEngine.suggestMissionConfiguration`; configuration UI is owned by the composer/shell. |
| Mission execution | `src/services/mission-engine/mission-engine.ts` | `src/hooks/use-mission-engine.ts`, `src/services/mission-engine/mock-agent-runner.ts`, `src/agents/definitions.ts` | Classification, planning/direct path, graph, task scheduling, conflict mediation, finalization. |
| Live agent council | `src/features/mission-control/components/council/agent-council-room.tsx` | `agent-roster.tsx`, `workstream-strip.tsx`, `workstream-inspector.tsx`, `transcript-drawer.tsx` | Rendering-only consumer of mission store context. |
| Mission graph / execution board | `src/services/mission-engine/mission-engine.ts` | `src/panels/network-graph-panel.tsx`, `src/panels/agent-workflow-panel.tsx`, `src/panels/workstreams-panel.tsx`, `src/types/mission.types.ts` | Engine owns graph data; panels visualize it. |
| Agent cards, output, and dialogue | `src/features/mission-control/components/council/agent-council-room.tsx` | `agent-contribution-drawer.tsx`, `agent-output-formatter.ts`, `agent-speech-bubble.tsx`, `src/panels/dialogue-panel.tsx` | Keep data changes in types/engine; these files format/render. |
| Final report | `src/panels/report-panel.tsx` | `presentation-renderer.ts`, `src/components/structured-content.tsx`, `src/utils/report-export.ts` | Engine constructs `MissionReport`; UI composes, displays, copies/exports it. |
| Conflict and efficiency views | `src/panels/conflict-panel.tsx`, `src/panels/efficiency-panel.tsx` | `src/services/mission-engine/mission-engine.ts`, `src/types/mission.types.ts` | Engine detects/resolves and computes metrics; panels render. |
| Settings / Qwen credentials | `src/features/mission-control/components/sidebar-pages.tsx` | `src/store/runtime-settings-store.ts`, `src/lib/qwenConfig.ts`, `src/lib/settingsPreferences.ts`, `src/services/qwen/qwen-client.ts` | `SettingsPage` owns controls; values are browser persisted. |
| Mission history & saved reports | `src/features/mission-control/components/sidebar-pages.tsx` | `src/store/history-store.ts`, `src/types/history.types.ts`, `src/utils/report-export.ts` | `MissionHistoryPage` and `ReportsPage`; storage retains up to 50 entries. |
| Replay | `src/features/mission-control/components/replay-control-bar.tsx` | `src/store/replay-store.ts`, `src/services/replay/replay-engine.ts`, `src/services/mission-engine/mission-engine.ts` | Replay rebuilds mission context from recorded events and blocks live LLM calls. |
| Drilldown/sub-missions | `src/features/mission-control/components/drilldown-drawer.tsx`, `src/features/mission-control/mission-control.tsx` | `src/components/structured-content.tsx`, `src/services/qwen/qwen-client.ts`, `src/types/mission.types.ts` | Direct focused follow-up or sub-mission launch/backlog. |
| Sidebar navigation/pages | `src/features/mission-control/components/mission-sidebar.tsx`, `sidebar-pages.tsx` | `src/features/mission-control/mission-control.tsx` | Agents, history, reports, and settings views are local feature views, not routes. |
| Presentation / text sanitation | `src/features/mission-control/components/council/presentation-renderer.ts`, `agent-output-formatter.ts` | `src/utils/mission-text.ts`, `src/components/structured-content.tsx` | Converts engine output into user-facing display. |
| Styling / animation | `src/app/globals.css`, `src/app/tw-animate.css` | `src/hooks/use-framer-presets.ts`, `src/components/space-background.tsx` | Local styling/animation work should avoid engine files. |

## 5. Shared systems

| System | Owning files |
| --- | --- |
| Current mission state | `src/store/mission-store.ts`; canonical data shape in `src/types/mission.types.ts` |
| Mission engine and graph | `src/services/mission-engine/mission-engine.ts`; agent prompts in `src/agents/definitions.ts` |
| React lifecycle / notifications / autosave | `src/hooks/use-mission-engine.ts`, `src/hooks/use-toast.ts` |
| Replay | `src/store/replay-store.ts`, `src/services/replay/replay-engine.ts` |
| History persistence | `src/store/history-store.ts`, `src/types/history.types.ts` |
| Runtime Qwen settings | `src/store/runtime-settings-store.ts`, `src/lib/qwenConfig.ts`, `src/lib/settingsPreferences.ts` |
| API client / mock fallback | `src/services/qwen/qwen-client.ts`, `src/services/mission-engine/mock-agent-runner.ts` |
| User-facing rendering | `presentation-renderer.ts`, `agent-output-formatter.ts`, `structured-content.tsx` |
| Shared UI primitives | `src/components/ui/`; use as-is unless changing the design system |

## 6. Important data flow

```text
Brief + partial config
→ mission-control.tsx / mission-brief-composer.tsx
→ use-mission-engine.ts (key gate, listeners, autosave)
→ mission-store.ts (creates MissionContext)
→ mission-engine.ts (classify → plan/direct workstreams → tasks/graph → parallel execution → mediation → final report)
→ qwen-client.ts (when not mock) and agents/definitions.ts (system prompts)
→ mission-store.ts context updates
→ agent-council-room.tsx / panels/* / report-panel.tsx
→ history-store.ts (completed/cancelled autosave) and replay events on MissionContext
```

```text
Saved replay events → replay-store.ts → replay-engine.ts (rebuild MissionContext) → mission-store.ts → replay-control-bar.tsx and mission UI
```

## 7. Important types and interfaces

| Domain | Defined in |
| --- | --- |
| `MissionContext`, `MissionState`, `Workstream`, `ExecutionTask`, `ConflictInfo`, `MissionGraph`, `MissionReport`, `MissionExecutionStrategy`, `MissionReplayEvent`, `DrilldownSource` | `src/types/mission.types.ts` |
| `MissionConfiguration` and option unions/defaults | `src/types/config.types.ts` |
| `AgentRole`, `AgentDefinition`, `AgentDialogueEntry` | `src/types/agent.types.ts` |
| lifecycle `MissionEventType` / `MissionEvent` | `src/types/events.types.ts` |
| persisted `MissionHistoryEntry` | `src/types/history.types.ts` |
| Qwen request/response/error contracts | `src/types/api.types.ts` |
| public type barrel | `src/types/index.ts` |

## 8. External services

- Client: `src/services/qwen/qwen-client.ts`; builds a POST to `${baseUrl}/chat/completions` with model, sanitized messages, temperature, token limit, and `stream` preference.
- Configuration: defaults and key-source resolution are in `src/lib/qwenConfig.ts`; `next.config.ts` forwards the documented `VITE_QWEN_*` runtime variables. Browser-saved credentials take precedence over environment values.
- UI/settings: `sidebar-pages.tsx` writes through `runtime-settings-store.ts`; never inspect or copy `.env.local`.
- Streaming: the client parses SSE-style `data:` lines into one returned completion. `mission-engine.ts` then chunks completed text into replay stream events; it is not progressive token-by-token UI streaming.
- Errors: request timeout/retry preferences come from `settingsPreferences.ts`; `QwenApiError` wraps API errors. The engine throws on failure unless `allowMockFallback` is enabled. Replay mode blocks Qwen calls.
- Mode: `getQwenRuntimeInfo()` identifies mock mode for absent/unusable/local endpoints; normal launch is key-gated in `use-mission-engine.ts`.

## 9. Where to look when changing something

| Requested change | Inspect first | Inspect only if needed | Usually avoid |
| --- | --- | --- | --- |
| Change mission input behavior | `mission-brief-composer.tsx`, `mission-control.tsx` | `use-mission-engine.ts`, `types/config.types.ts` | engine, replay code |
| Change config suggestions | `mission-brief-composer.tsx`, `mission-engine.ts` (`suggestMissionConfiguration`) | config types | Qwen client, panels |
| Change agent card/council design | `agent-council-room.tsx` and the specific `council/*.tsx` child | `agent-output-formatter.ts`, `agent-icons.ts` | engine, API client |
| Change graph/workstream display | the relevant `src/panels/*` renderer | `types/mission.types.ts` | Qwen settings/UI |
| Change Qwen request/model/retries | `qwen-client.ts`, `qwenConfig.ts` | `settingsPreferences.ts`, `runtime-settings-store.ts`, `sidebar-pages.tsx` | mission UI/panels |
| Change mission execution logic | `mission-engine.ts` | mission/types, `mock-agent-runner.ts`, agent definitions, hook event listeners | settings UI, static assets |
| Change prompt/persona | `src/agents/definitions.ts` | `mission-engine.ts` prompt assembly | presentation-only components |
| Change final report UI/export | `report-panel.tsx`, `presentation-renderer.ts`, `report-export.ts` | `structured-content.tsx` | input and engine scheduling |
| Change history behavior | `history-store.ts`, `sidebar-pages.tsx` | `history.types.ts`, hook autosave | execution graph |
| Change replay controls/reconstruction | `replay-control-bar.tsx`, `replay-store.ts` | `replay-engine.ts`, replay types | live Qwen request handling |
| Change drilldowns | `drilldown-drawer.tsx`, `mission-control.tsx` | `structured-content.tsx`, Qwen client, mission types | replay engine |
| Change global UI/theme | `globals.css`, `tw-animate.css`, `space-background.tsx` | Framer presets/settings appearance | engine/stores |

## 10. High-risk files

- `src/services/mission-engine/mission-engine.ts` — central state transitions, task dependencies/parallelism, conflict resolution, output shaping, replay recording, and API fallback.
- `src/types/mission.types.ts` — broad shared contract used by engine, stores, replay, and panels; schema changes require coordinated updates.
- `src/store/mission-store.ts` — canonical live context initialization; missing defaults break rendering/replay.
- `src/services/replay/replay-engine.ts` and `src/store/replay-store.ts` — replay reconstruction mutates the shared mission store and protects against live API calls.
- `src/services/qwen/qwen-client.ts` and `src/lib/qwenConfig.ts` — browser-side key handling, request construction, model/base URL resolution, and error behavior.
- `src/features/mission-control/mission-control.tsx` and `components/sidebar-pages.tsx` — large feature coordinators with navigation, launch, persistence, settings, and replay entry points.
