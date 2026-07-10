/**
 * Agent Society — Core Type Definitions
 */

export enum AgentRole {
  Planner = "planner",
  Researcher = "researcher",
  ProductStrategist = "product-strategist",
  TechnicalArchitect = "technical-architect",
  MarketingStrategist = "marketing-strategist",
  Finance = "finance",
  RiskCritic = "risk-critic",
  Mediator = "mediator",
  Finalizer = "finalizer",
}

export enum AgentStatus {
  Idle = "idle",
  Thinking = "thinking",
  Streaming = "streaming",
  Finished = "finished",
  Error = "error",
}

export type AgentThinkingState = "waiting" | "thinking" | "analyzing" | "reviewing" | "complete";

export interface AgentActivity {
  state: AgentThinkingState;
  label: string;
  detail: string;
  updatedAt: string;
  confidence?: number;
  confidenceDelta?: number;
  confidenceReason?: string;
}

export interface AgentDefinition {
  id: string;
  name: string;
  role: AgentRole;
  icon: string;
  color: string;
  capabilities: string[];
  systemPrompt: string;
  status: AgentStatus;
}

export interface AgentDialogueEntry {
  agentId: string;
  agentName: string;
  displayRole?: string;
  agentRole: AgentRole;
  content: string;
  timestamp: string;
  isConflict?: boolean;
  phase?: string;
  status?: AgentThinkingState;
  targetAgentRole?: AgentRole;
  referencedWorkstreamIds?: string[];
  confidence?: number;
}
