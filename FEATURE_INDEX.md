# Feature Index

## Mission input and launch
Primary:
- `src/features/mission-control/components/mission-brief-composer.tsx`
- `src/features/mission-control/mission-control.tsx`

Related:
- `src/hooks/use-mission-engine.ts`
- `src/store/mission-store.ts`

Search terms:
- `handleLaunch`
- `onLaunch`
- `brief`
- `initMission`

Do not inspect unless necessary:
- `src/services/replay/`
- `src/panels/`

## Mission configuration suggestions
Primary:
- `src/features/mission-control/components/mission-brief-composer.tsx`
- `src/services/mission-engine/mission-engine.ts`

Related:
- `src/types/config.types.ts`

Search terms:
- `suggestMissionConfiguration`
- `MissionConfigSuggestionOverlay`
- `DEFAULT_CONFIGURATION`

Do not inspect unless necessary:
- `src/services/qwen/`

## Execution engine and mission graph
Primary:
- `src/services/mission-engine/mission-engine.ts`

Related:
- `src/services/mission-engine/mock-agent-runner.ts`
- `src/types/mission.types.ts`
- `src/agents/definitions.ts`

Search terms:
- `startMission`
- `classifyMission`
- `runExecutionTasks`
- `createMissionGraph`
- `detectConflicts`

Do not inspect unless necessary:
- `src/features/mission-control/components/sidebar-pages.tsx`
- `src/app/`

## Agent council and workstreams
Primary:
- `src/features/mission-control/components/council/agent-council-room.tsx`

Related:
- `agent-roster.tsx`
- `workstream-strip.tsx`
- `workstream-inspector.tsx`
- `agent-contribution-drawer.tsx`
- `src/store/mission-store.ts`

Search terms:
- `AgentCouncilRoom`
- `executionTasks`
- `workstreams`
- `agentStates`

Do not inspect unless necessary:
- `src/services/qwen/`

## Graph, task, and operations panels
Primary:
- `src/panels/network-graph-panel.tsx`
- `src/panels/agent-workflow-panel.tsx`
- `src/panels/workstreams-panel.tsx`

Related:
- `src/types/mission.types.ts`
- `src/services/mission-engine/mission-engine.ts`

Search terms:
- `MissionGraph`
- `ExecutionTask`
- `dependencyEdges`

Do not inspect unless necessary:
- input/configuration UI

## Final report and presentation
Primary:
- `src/panels/report-panel.tsx`
- `src/features/mission-control/components/council/presentation-renderer.ts`

Related:
- `agent-output-formatter.ts`
- `src/components/structured-content.tsx`
- `src/utils/report-export.ts`

Search terms:
- `composeReportSections`
- `MissionReport`
- `reportToMarkdown`

Do not inspect unless necessary:
- Qwen request code

## Conflict, timeline, dialogue, and metrics
Primary:
- `src/panels/conflict-panel.tsx`
- `src/panels/timeline-panel.tsx`
- `src/panels/dialogue-panel.tsx`
- `src/panels/efficiency-panel.tsx`

Related:
- `src/types/mission.types.ts`
- `src/services/mission-engine/mission-engine.ts`

Search terms:
- `conflicts`
- `timeline`
- `dialogue`
- `efficiencyMetrics`

Do not inspect unless necessary:
- settings/history pages

## Qwen and runtime settings
Primary:
- `src/services/qwen/qwen-client.ts`
- `src/lib/qwenConfig.ts`

Related:
- `src/store/runtime-settings-store.ts`
- `src/lib/settingsPreferences.ts`
- `src/features/mission-control/components/sidebar-pages.tsx`
- `next.config.ts`

Search terms:
- `createQwenClient`
- `getResolvedQwenSettings`
- `setQwenCredentials`
- `streamResponses`

Do not inspect unless necessary:
- `.env*`
- report/council UI

## Mission history and reports library
Primary:
- `src/store/history-store.ts`
- `src/features/mission-control/components/sidebar-pages.tsx`

Related:
- `src/types/history.types.ts`
- `src/hooks/use-mission-engine.ts`

Search terms:
- `MissionHistoryPage`
- `ReportsPage`
- `saveMissionHistory`
- `agent-society-history`

Do not inspect unless necessary:
- mission graph scheduler

## Replay
Primary:
- `src/store/replay-store.ts`
- `src/services/replay/replay-engine.ts`
- `src/features/mission-control/components/replay-control-bar.tsx`

Related:
- `src/services/mission-engine/mission-engine.ts`
- `src/types/mission.types.ts`

Search terms:
- `startReplay`
- `buildMissionStateFromEvents`
- `recordReplayEvent`
- `__AGENT_SOCIETY_REPLAY_ACTIVE__`

Do not inspect unless necessary:
- live input/composer UI

## Drilldowns and sub-missions
Primary:
- `src/features/mission-control/components/drilldown-drawer.tsx`
- `src/features/mission-control/mission-control.tsx`

Related:
- `src/components/structured-content.tsx`
- `src/types/mission.types.ts`
- `src/services/qwen/qwen-client.ts`

Search terms:
- `DrilldownDrawer`
- `handleLaunchSubMission`
- `agentSociety:drilldown`
- `missionBacklog`

Do not inspect unless necessary:
- replay reconstruction

## Navigation, styles, and shared primitives
Primary:
- `src/features/mission-control/components/mission-sidebar.tsx`
- `src/app/globals.css`
- `src/app/tw-animate.css`

Related:
- `src/features/mission-control/components/sidebar-pages.tsx`
- `src/components/space-background.tsx`
- `src/hooks/use-framer-presets.ts`

Search terms:
- `MissionView`
- `MISSION_NAV_ITEMS`
- `agentTheme`

Do not inspect unless necessary:
- engine/stores/API client
