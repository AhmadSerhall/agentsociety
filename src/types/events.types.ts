/**
 * Agent Society — Event System Types
 */

export enum MissionEventType {
  MissionStarted = "MISSION_STARTED",
  MissionProgress = "MISSION_PROGRESS",
  AgentStarted = "AGENT_STARTED",
  AgentThinking = "AGENT_THINKING",
  AgentStream = "AGENT_STREAM",
  AgentFinished = "AGENT_FINISHED",
  WorkstreamCreated = "WORKSTREAM_CREATED",
  ConflictDetected = "CONFLICT_DETECTED",
  ConflictResolved = "CONFLICT_RESOLVED",
  MissionCompleted = "MISSION_COMPLETED",
  MissionFailed = "MISSION_FAILED",
  MissionCancelled = "MISSION_CANCELLED",
}

export interface MissionEvent {
  type: MissionEventType;
  timestamp: string;
  payload: Record<string, unknown>;
}