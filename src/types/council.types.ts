import type { MissionConfiguration } from "./config.types";

export type CouncilSuggestionIconKind =
  | "continue"
  | "implement"
  | "optimize"
  | "validate"
  | "reduce-risk"
  | "estimate-cost"
  | "expand"
  | "research";

export interface CouncilHiddenContext {
  parentMissionId: string;
  sourceMissionBrief: string;
  missionStatus: "completed" | "cancelled";
  suggestionKind: CouncilSuggestionIconKind;
  councilRationale: string;
  checkpointSummary?: string;
  recommendationExcerpt?: string;
  roadmapExcerpt?: string;
  riskExcerpt?: string;
  agentMemoryExcerpt?: string;
  replayAvailable: boolean;
  completedWorkstreams?: number;
  totalWorkstreams?: number;
}

export interface CouncilSuggestionChip {
  id: string;
  label: string;
  visibleBrief: string;
  why: string;
  iconKind: CouncilSuggestionIconKind;
  config: Partial<MissionConfiguration>;
  hidden: CouncilHiddenContext;
}
