/**
 * Agent Society — Mission Store
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
  DEFAULT_CONFIGURATION,
} from "@/types";
import { generateId } from "@/utils";

interface MissionStateSlice {
  context: MissionContext | null;
  isRunning: boolean;

  initMission: (brief: string, config?: Partial<MissionConfiguration>) => MissionContext;
  setContext: (ctx: MissionContext) => void;
  appendDialogue: (entry: AgentDialogueEntry) => void;
  reset: () => void;
}

const createEmptyContext = (brief: string, config: MissionConfiguration): MissionContext => ({
  missionId: generateId(),
  missionBrief: brief,
  configuration: config,
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
  executionTasks: [],
  progress: 0,
  status: MissionState.Idle,
  startedAt: null,
  completedAt: null,
  replayEvents: [],
});

export const useMissionStore = create<MissionStateSlice>((set, get) => ({
  context: null,
  isRunning: false,

  initMission: (brief, partialConfig) => {
    const config: MissionConfiguration = { ...DEFAULT_CONFIGURATION, ...partialConfig };
    const ctx = createEmptyContext(brief, config);
    set({ context: ctx, isRunning: false });
    return ctx;
  },

  setContext: (ctx) => set({ context: ctx }),

  appendDialogue: (entry) => set((state) => state.context
    ? { context: { ...state.context, dialogue: [...state.context.dialogue, entry] } }
    : state),

  reset: () => set({ context: null, isRunning: false }),
}));
