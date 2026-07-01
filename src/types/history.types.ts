/**
 * Agent Society — Mission History Types (LocalStorage)
 */

import type { MissionConfiguration } from "./config.types";
import type { Workstream, ConflictInfo, MissionReport, EfficiencyMetrics, MissionReplayEvent } from "./mission.types";

export interface MissionHistoryEntry {
  id: string;
  missionBrief: string;
  configuration: MissionConfiguration;
  timestamp: string;
  workstreams: Workstream[];
  dialogue: { agentName: string; content: string }[];
  conflicts: { description: string; resolution?: string }[];
  finalReport: MissionReport | null;
  efficiencyMetrics: EfficiencyMetrics | null;
  replayEvents?: MissionReplayEvent[];
}
