/**
 * Agent Council — Mission Store
 */

import { create } from "zustand";
import {
  AgentRole,
  MissionState,
  type MissionContext,
  type MissionConfiguration,
  type AgentDialogueEntry,
  type TimelineEntry,
  type Workstream,
  type ConflictInfo,
  type EfficiencyMetrics,
  type MissionReport,
  type DrilldownSource,
  DEFAULT_CONFIGURATION,
} from "@/types";
import { generateId } from "@/utils";

interface MissionStateSlice {
  context: MissionContext | null;
  isRunning: boolean;

  initMission: (brief: string, config?: Partial<MissionConfiguration>, relation?: Partial<Pick<MissionContext, "parentMissionId" | "sourceCardId" | "sourceCardText" | "sourceAgentId" | "sourceWorkstreamId" | "councilHiddenContext">>) => MissionContext;
  setContext: (ctx: MissionContext) => void;
  appendDialogue: (entry: AgentDialogueEntry) => void;
  addBacklogItem: (source: DrilldownSource) => void;
  reset: () => void;
}

const createEmptyContext = (
  brief: string,
  config: MissionConfiguration,
  relation?: Partial<Pick<MissionContext, "parentMissionId" | "sourceCardId" | "sourceCardText" | "sourceAgentId" | "sourceWorkstreamId" | "councilHiddenContext">>
): MissionContext => ({
  missionId: generateId(),
  missionBrief: brief,
  configuration: config,
  ...relation,
  missionClassification: undefined,
  workstreams: [],
  researchSummary: "",
  productStrategy: "",
  technicalArchitecture: "",
  marketingStrategy: "",
  financialPlan: "",
  riskReview: "",
  conflicts: [],
  mediatorDecisions: "",
  finalReport: null,
  dialogue: [],
  timeline: [],
  efficiencyMetrics: null,
  currentAgent: null,
  agentStates: {
    [AgentRole.Planner]: "waiting",
    [AgentRole.Researcher]: "waiting",
    [AgentRole.ProductStrategist]: "waiting",
    [AgentRole.TechnicalArchitect]: "waiting",
    [AgentRole.MarketingStrategist]: "waiting",
    [AgentRole.Finance]: "waiting",
    [AgentRole.RiskCritic]: "waiting",
    [AgentRole.Mediator]: "waiting",
    [AgentRole.Finalizer]: "waiting",
  },
  agentActivities: {},
  executionTasks: [],
  missionGraph: null,
  progress: 0,
  status: MissionState.Idle,
  startedAt: null,
  completedAt: null,
  replayEvents: [],
  missionBacklog: [],
});

export const useMissionStore = create<MissionStateSlice>((set, get) => ({
  context: null,
  isRunning: false,

  initMission: (brief, partialConfig, relation) => {
    const config: MissionConfiguration = { ...DEFAULT_CONFIGURATION, ...partialConfig };
    const ctx = createEmptyContext(brief, config, relation);
    set({ context: ctx, isRunning: false });
    return ctx;
  },

  setContext: (ctx) => set({ context: ctx }),

  appendDialogue: (entry) => set((state) => state.context
    ? { context: { ...state.context, dialogue: [...state.context.dialogue, entry] } }
    : state),

  addBacklogItem: (source) => set((state) => state.context
    ? { context: { ...state.context, missionBacklog: [...(state.context.missionBacklog ?? []), source] } }
    : state),

  reset: () => set({ context: null, isRunning: false }),
}));
