# Codex Context — Agent Society

Read this first for any task, then use `PROJECT_MAP.md`, `FEATURE_INDEX.md`, and `DEPENDENCY_MAP.md` to limit file reads.

## Purpose and stack

Agent Society is a client-rendered Next.js 16 AI Mission Control app. It turns a mission brief into a Qwen/DashScope-backed or mock multi-agent workflow with a graph, conflict mediation, a final report, local history, and replay.

- React 19 + TypeScript + Tailwind + Framer Motion
- Zustand for live mission/history/replay/settings state
- React Query provider at the app root
- React Flow and Recharts only for visualization panels
- No bundled backend/database; browser `localStorage` persists user data

## Main architecture

`src/app/page.tsx` dynamically loads `MissionControl` with SSR disabled.

`src/features/mission-control/mission-control.tsx` is the application shell. It owns local UI state, loads history/settings, starts missions through `useMissionEngine`, and coordinates sidebar/replay/drilldown views.

`src/hooks/use-mission-engine.ts` creates `MissionEngine`, initializes the canonical `MissionContext` in Zustand, receives updates, handles lifecycle toasts, cancellation, and optional history autosave.

`src/services/mission-engine/mission-engine.ts` is the central orchestrator: classification → planning/direct tasks → dependency-ready parallel execution → conflict mediation → final report + replay events. Treat it as high risk.

## Feature ownership

| Need | Start here |
| --- | --- |
| Brief/config UI | `src/features/mission-control/components/mission-brief-composer.tsx` |
| Shell/launch/navigation/submissions | `src/features/mission-control/mission-control.tsx` |
| Execution/graph/conflicts | `src/services/mission-engine/mission-engine.ts` |
| Agent prompts/roles | `src/agents/definitions.ts` |
| Active mission UI | `src/features/mission-control/components/council/agent-council-room.tsx` |
| Final report formatting | `src/panels/report-panel.tsx`, `.../council/presentation-renderer.ts` |
| Settings/history/report-library pages | `src/features/mission-control/components/sidebar-pages.tsx` |
| Current mission/history/replay/settings stores | `src/store/` |
| Qwen configuration/client | `src/lib/qwenConfig.ts`, `src/services/qwen/qwen-client.ts` |
| Replay reconstruction/controls | `src/services/replay/replay-engine.ts`, `src/store/replay-store.ts`, `replay-control-bar.tsx` |

## Critical contracts and constraints

- `MissionContext` and related graph/report/replay types live in `src/types/mission.types.ts`; configuration is in `config.types.ts`.
- `useMissionStore` is the canonical live state. The engine mutates a private context and emits snapshots through the hook.
- History, Qwen settings, and preferences are browser-local; do not inspect or expose `.env*` secrets.
- Qwen is called directly from the browser. `qwen-client.ts` handles POST `/chat/completions`, retries/timeouts, API errors, and SSE response parsing.
- Launch is API-key-gated in the hook. Replay intentionally blocks live Qwen calls.
- The client parses streamed responses before returning them; the engine creates replay chunks afterward, so live UI is not token-progressive.
- The app’s current navigation views are local `MissionView` states, not additional Next routes.

## Naming and patterns

- Imports use `@/` for `src/`.
- Feature code belongs under `src/features/mission-control/`; reusable visualizations are in `src/panels/`.
- Use `src/types/index.ts`, `src/store/index.ts`, `src/services/*/index.ts`, and `src/utils/index.ts` barrels where nearby code does.
- UI components use named exports. Zustand stores follow `useXStore`; service factories use `createX`.
- `components/ui/` is the shadcn-style primitive layer; avoid editing it for feature behavior.

## Validation

- Type check: `npx tsc --noEmit`
- Lint: `npm run lint`
- Full build only when warranted: `npm run build`

## Common mistakes to avoid

- Do not alter `mission-engine.ts`, replay code, or `mission.types.ts` for a purely visual change.
- Do not bypass the replay guard or API-key gate.
- Do not change persisted storage keys/schema without inspecting history/replay/settings readers.
- Do not introduce server-only assumptions: the dashboard is dynamically loaded with SSR disabled.
- Do not read `node_modules`, `.next`, lockfiles, assets, or `.env*` for ordinary feature work.
- The worktree may contain user changes; preserve them.
