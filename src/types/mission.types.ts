/**
 * Agent Society — Mission Type Definitions
 */

import type { AgentDialogueEntry, AgentThinkingState } from "./agent.types";
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
  owner?: string;
  responsibleAgent?: string;
  displayRole?: string;
  description: string;
  status: "pending" | "ready" | "in_progress" | "blocked" | "completed" | "revised" | "cancelled";
  assignedAgent: AgentRole | null;
  supportingAgentIds?: AgentRole[];
  deliverables: string[];
  acceptanceCriteria?: string[];
  expectedOutputs?: string[];
  confidence?: number;
  dependencies?: string[];
  nextStep?: string;
  output?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ExecutionTask {
  id: string;
  workstreamId: string;
  title: string;
  description?: string;
  agent: AgentRole;
  displayRole?: string;
  supportingAgents?: AgentRole[];
  acceptanceCriteria?: string[];
  expectedOutputs?: string[];
  dependencies: string[];
  status: "pending" | "ready" | "running" | "blocked" | "completed" | "revised" | "cancelled";
  confidence: number;
  output?: string;
  blockedReason?: string;
  revisionNote?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ConflictInfo {
  id: string;
  title?: string;
  agents: string[];
  agentsInvolved?: string[];
  affectedTaskIds?: string[];
  description: string;
  summary?: string;
  riskLevel?: "low" | "moderate" | "high" | "critical";
  severity?: "low" | "moderate" | "high" | "critical";
  disagreementSummary?: string;
  proposedSolutions?: string[];
  mediatorDecision?: string;
  resolvedAction?: string;
  finalAction?: string;
  resolution?: string;
  status?: "open" | "resolving" | "resolved";
  resolved: boolean;
  createdAt?: string;
  resolvedAt?: string;
}

export interface MissionGraph {
  missionId: string;
  workstreams: string[];
  agents: AgentRole[];
  taskNodes: ExecutionTask[];
  parallelGroups: Array<{ id: string; title: string; description: string; taskIds: string[] }>;
  conflictZones: Array<{ title: string; agentsInvolved: AgentRole[]; reason: string }>;
  synthesisReadinessCriteria: string[];
  dependencies: Array<{ from: string; to: string }>;
  assignments: Array<{ taskId: string; assignedAgentId: AgentRole; supportingAgentIds: AgentRole[] }>;
  statuses: Record<string, ExecutionTask["status"]>;
  outputs: Record<string, string>;
  conflicts: ConflictInfo[];
  synchronizationPoints: Array<{ id: string; title: string; requiredTaskIds: string[]; reached: boolean; reachedAt?: string }>;
  finalizationReadiness: {
    requiredTasksCompleted: boolean;
    criticalConflictsResolved: boolean;
    confidenceThresholdMet: boolean;
    status: "not_ready" | "waiting" | "ready_for_synthesis";
  };
}

export interface MissionReport {
  deliverableMode?: DeliverableMode;
  finalAnswer?: string;
  reviewNote?: string;
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
  executionDurationMs?: number;
  tokensConsumed?: number;
  averageLatencyMs?: number;
  retryCount?: number;
  failureCount?: number;
  parallelismPercent?: number;
  consensusPercent?: number;
  agentUtilizationPercent?: number;
  /** Comparison: single-agent estimated score. */
  singleAgentBaseline: number;
  singleAgentCoverageBaseline?: number;
  singleAgentConfidenceBaseline?: number;
  singleAgentPerspectiveBaseline?: number;
}

export interface DrilldownSource {
  id: string;
  parentMissionId: string;
  sourceType: "recommendation" | "workstream" | "practical_step" | "decision" | "risk" | "timeline";
  sourceText: string;
  sourceAgentId?: string;
  sourceWorkstreamId?: string;
  createdAt: string;
}

export type MissionKind =
  | "translation"
  | "summarization"
  | "question_answering"
  | "research"
  | "creative_writing"
  | "programming"
  | "debugging"
  | "software_architecture"
  | "business_planning"
  | "startup_launch"
  | "erp_design"
  | "financial_analysis"
  | "education"
  | "brainstorming"
  | "multi_step_execution"
  | "general_problem_solving"
  | "file_analysis"
  | "code_review"
  | "document_generation"
  | "conversation"
  | "math_logical_reasoning";

export type DeliverableMode = "direct_answer" | "artifact" | "mission_report";

export interface MissionExecutionStrategy {
  missionType: MissionKind;
  deliverableMode: DeliverableMode;
  complexity: number;
  estimatedWorkstreams: number;
  estimatedDuration: string;
  recommendedAgents: AgentRole[];
  requiresPlanning: boolean;
  requiresResearch: boolean;
  requiresConflictResolution: boolean;
  requiresParallelism: boolean;
  selectedStrategy: "direct" | "specialist_pair" | "focused_sequence" | "mission_graph";
  planningReason: string;
  classificationConfidence: number;
  validationNotes: string[];
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

export type MissionReplayEventType =
  | "MISSION_CREATED"
  | "MISSION_STARTED"
  | "MISSION_GRAPH_CREATED"
  | "MISSION_GRAPH_UPDATED"
  | "TASK_READY"
  | "TASK_STARTED"
  | "TASK_BLOCKED"
  | "TASK_REASSIGNED"
  | "MISSION_CONFIGURATION_SELECTED"
  | "MISSION_CLASSIFIED"
  | "PLANNER_STARTED"
  | "PLANNER_STREAM"
  | "PLANNER_FINISHED"
  | "PLANNER_REVIEW_REQUESTED"
  | "PLANNER_REVISED_PLAN"
  | "WORKSTREAM_CREATED"
  | "WORKSTREAM_ASSIGNED"
  | "AGENT_STARTED"
  | "AGENT_REQUESTED_INPUT"
  | "AGENT_CHALLENGED_ASSUMPTION"
  | "AGENT_WAITING"
  | "AGENT_THINKING"
  | "AGENT_ANALYZING"
  | "AGENT_REVIEWING"
  | "AGENT_STREAM"
  | "AGENT_FINISHED"
  | "DIALOGUE_CREATED"
  | "CONFLICT_DETECTED"
  | "CONFLICT_CREATED"
  | "CONFLICT_UPDATED"
  | "CONFLICT_RESOLVED"
  | "MEDIATOR_STARTED"
  | "MEDIATION_STARTED"
  | "MEDIATOR_FINISHED"
  | "SYNCHRONIZATION_POINT_REACHED"
  | "FINALIZER_STARTED"
  | "FINALIZER_STREAM"
  | "FINALIZER_FINISHED"
  | "REPORT_GENERATED"
  | "MISSION_COMPLETED";

export interface MissionReplayEvent {
  id: string;
  type: MissionReplayEventType;
  timestamp: string;
  relativeTimestamp: number;
  agentId?: string;
  agentName?: string;
  agentRole?: AgentRole;
  workstreamId?: string;
  workstreamTitle?: string;
  payload?: Record<string, unknown>;
  confidence?: number;
  dependencies?: string[];
  dialogueReference?: string;
  metadata?: Record<string, unknown>;
}

export interface MissionContext {
  missionId: MissionId;
  missionBrief: string;
  configuration: MissionConfiguration;
  missionClassification?: MissionExecutionStrategy;
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
  agentStates: Record<AgentRole, AgentThinkingState>;
  executionTasks: ExecutionTask[];
  missionGraph: MissionGraph | null;
  progress: number;
  status: MissionState;
  startedAt: string | null;
  completedAt: string | null;
  replayEvents: MissionReplayEvent[];
  parentMissionId?: string;
  sourceCardId?: string;
  sourceCardText?: string;
  sourceAgentId?: string;
  sourceWorkstreamId?: string;
  missionBacklog?: DrilldownSource[];
}
