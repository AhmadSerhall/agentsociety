/**
 * Agent Society — Mission Type Definitions
 */

import type { AgentDialogueEntry } from "./agent.types";
import type { MissionConfiguration } from "./config.types";

// Import AgentRole as a type-only to avoid circular initialization.
// The actual map is built lazily via getStateAgentMap().
import type { AgentRole } from "./agent.types";

export type MissionId = string;

export enum MissionState {
  Idle = "idle",
  Preparing = "preparing",
  Planning = "planning",
  Researching = "researching",
  ProductStrategy = "product-strategy",
  TechnicalArchitecture = "technical-architecture",
  MarketingStrategy = "marketing-strategy",
  FinancialAnalysis = "financial-analysis",
  RiskReview = "risk-review",
  ConflictResolution = "conflict-resolution",
  Finalizing = "finalizing",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
}

/** Maps each mission state to the agent responsible, or null. */
export const STATE_AGENT_MAP: Record<MissionState, AgentRole | null> = {
  [MissionState.Idle]: null,
  [MissionState.Preparing]: "planner" as AgentRole,
  [MissionState.Planning]: "planner" as AgentRole,
  [MissionState.Researching]: "researcher" as AgentRole,
  [MissionState.ProductStrategy]: "product-strategist" as AgentRole,
  [MissionState.TechnicalArchitecture]: "technical-architect" as AgentRole,
  [MissionState.MarketingStrategy]: "marketing-strategist" as AgentRole,
  [MissionState.FinancialAnalysis]: "finance" as AgentRole,
  [MissionState.RiskReview]: "risk-critic" as AgentRole,
  [MissionState.ConflictResolution]: "mediator" as AgentRole,
  [MissionState.Finalizing]: "finalizer" as AgentRole,
  [MissionState.Completed]: null,
  [MissionState.Failed]: null,
  [MissionState.Cancelled]: null,
};

/** Ordered states for the timeline. */
export const MISSION_STATE_ORDER: MissionState[] = [
  MissionState.Idle,
  MissionState.Preparing,
  MissionState.Planning,
  MissionState.Researching,
  MissionState.ProductStrategy,
  MissionState.TechnicalArchitecture,
  MissionState.MarketingStrategy,
  MissionState.FinancialAnalysis,
  MissionState.RiskReview,
  MissionState.Finalizing,
  MissionState.Completed,
];

export interface Workstream {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  assignedAgent: AgentRole | null;
  deliverables: string[];
  confidence?: number;
}

export interface ConflictInfo {
  id: string;
  title?: string;
  agents: string[];
  description: string;
  riskLevel?: "low" | "moderate" | "high" | "critical";
  disagreementSummary?: string;
  mediatorDecision?: string;
  finalAction?: string;
  resolution?: string;
  resolved: boolean;
}

export interface MissionReport {
  executiveSummary: string;
  missionObjective: string;
  selectedMissionConfiguration?: string;
  workstreams: string;
  roleAssignments: string;
  agentContributions: string;
  keyDisagreements: string;
  mediatorDecisions: string;
  executionRoadmap: string;
  timeline: string;
  budgetEstimate: string;
  riskAssessment: string;
  successMetrics: string;
  finalRecommendations: string;
  singleAgentComparison?: string;
}

export interface EfficiencyMetrics {
  taskCoverage: number;
  qualityScore: number;
  conflictsResolved: number;
  estimatedCompletionTime: string;
  perspectivesConsidered: number;
  revisionCount: number;
  finalConfidenceScore: number;
  /** Comparison: single-agent estimated score. */
  singleAgentBaseline: number;
}

export interface TimelineEntry {
  agent: AgentRole;
  state: MissionState;
  label: string;
  timestamp: string;
  duration?: number;
  description?: string;
  kind?: "system" | "agent" | "workstream" | "conflict" | "report" | "cancelled";
}

export interface MissionContext {
  missionId: MissionId;
  missionBrief: string;
  configuration: MissionConfiguration;
  workstreams: Workstream[];
  researchSummary: string;
  productStrategy: string;
  technicalArchitecture: string;
  marketingStrategy: string;
  financialPlan: string;
  riskReview: string;
  conflicts: ConflictInfo[];
  mediatorDecisions: string;
  finalReport: MissionReport | null;
  dialogue: AgentDialogueEntry[];
  timeline: TimelineEntry[];
  efficiencyMetrics: EfficiencyMetrics | null;
  currentAgent: AgentRole | null;
  progress: number;
  status: MissionState;
  startedAt: string | null;
  completedAt: string | null;
}
