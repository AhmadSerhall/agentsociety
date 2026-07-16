/**
 * Agent Council — Mission History Types (LocalStorage)
 */

import type { MissionConfiguration } from "./config.types";
import type { AgentDialogueEntry } from "./agent.types";
import type { TimelineEntry, Workstream, ConflictInfo, MissionReport, EfficiencyMetrics, MissionReplayEvent, DrilldownSource } from "./mission.types";

export interface MissionHistoryEntry {
  id: string;
  missionBrief: string;
  configuration: MissionConfiguration;
  timestamp: string;
  savedAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  workstreams: Workstream[];
  dialogue: Array<{ agentName: string; content: string } | AgentDialogueEntry>;
  timeline?: TimelineEntry[];
  conflicts: { description: string; resolution?: string }[];
  finalReport: MissionReport | null;
  efficiencyMetrics: EfficiencyMetrics | null;
  replayEvents?: MissionReplayEvent[];
  parentMissionId?: string;
  sourceCardId?: string;
  sourceCardText?: string;
  sourceAgentId?: string;
  sourceWorkstreamId?: string;
  missionBacklog?: DrilldownSource[];
}
