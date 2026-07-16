import {
  AgentRole,
  DEFAULT_CONFIGURATION,
  MissionState,
  type AgentActivity,
  type AgentDialogueEntry,
  type ConflictInfo,
  type EfficiencyMetrics,
  type ExecutionTask,
  type MissionConfiguration,
  type MissionContext,
  type MissionReplayEvent,
  type MissionReport,
  type TimelineEntry,
  type Workstream,
} from "@/types";
import { generateId } from "@/utils";

export interface ReplayBookmark {
  label: string;
  time: number;
  eventId: string;
}

export interface ReplayStats {
  missionDuration: number;
  replayDuration: number;
  totalEventsProcessed: number;
  agentMessages: number;
  conflicts: number;
  resolvedConflicts: number;
  agentSwitches: number;
  parallelTaskMoments: number;
  averageConfidence: number;
  peakParallelism: number;
  totalWorkstreamsCompleted: number;
}

function emptyAgentStates() {
  return {
    [AgentRole.Planner]: "waiting",
    [AgentRole.Researcher]: "waiting",
    [AgentRole.ProductStrategist]: "waiting",
    [AgentRole.TechnicalArchitect]: "waiting",
    [AgentRole.MarketingStrategist]: "waiting",
    [AgentRole.Finance]: "waiting",
    [AgentRole.RiskCritic]: "waiting",
    [AgentRole.Mediator]: "waiting",
    [AgentRole.Finalizer]: "waiting",
  } satisfies MissionContext["agentStates"];
}

function baseContext(events: MissionReplayEvent[]): MissionContext {
  const created = events.find((event) => event.type === "MISSION_CREATED");
  const configuration = (created?.payload?.configuration ?? DEFAULT_CONFIGURATION) as MissionConfiguration;
  return {
    missionId: String(created?.payload?.missionId ?? generateId()),
    missionBrief: String(created?.payload?.missionBrief ?? "Replay mission"),
    configuration,
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
    agentStates: emptyAgentStates(),
    agentActivities: {},
    executionTasks: [],
    missionGraph: null,
    progress: 0,
    status: MissionState.Idle,
    startedAt: null,
    completedAt: null,
    replayEvents: events,
  };
}

export function normalizeReplayEvents(events: MissionReplayEvent[]): MissionReplayEvent[] {
  return [...events].sort((a, b) => a.relativeTimestamp - b.relativeTimestamp || a.timestamp.localeCompare(b.timestamp));
}

export function buildMissionStateFromEvents(events: MissionReplayEvent[], targetTime: number): MissionContext {
  const sorted = normalizeReplayEvents(events);
  const ctx = baseContext(sorted);
  const visible = sorted.filter((event) => event.relativeTimestamp <= targetTime);

  for (const event of visible) {
    applyReplayEvent(ctx, event);
  }

  ctx.replayEvents = sorted;
  ctx.progress = sorted.length === 0 ? 0 : Math.min(1, targetTime / Math.max(1, getReplayDuration(sorted)));
  return ctx;
}

function applyReplayEvent(ctx: MissionContext, event: MissionReplayEvent) {
  switch (event.type) {
    case "MISSION_CREATED":
      ctx.missionId = String(event.payload?.missionId ?? ctx.missionId);
      ctx.missionBrief = String(event.payload?.missionBrief ?? ctx.missionBrief);
      ctx.configuration = (event.payload?.configuration ?? ctx.configuration) as MissionConfiguration;
      ctx.status = MissionState.Idle;
      break;
    case "MISSION_STARTED":
      ctx.status = MissionState.Preparing;
      ctx.startedAt = event.timestamp;
      addTimeline(ctx, event);
      break;
    case "MISSION_CLASSIFIED":
      addTimeline(ctx, event);
      break;
    case "MISSION_GRAPH_CREATED":
    case "MISSION_GRAPH_UPDATED":
      ctx.missionGraph = (event.payload?.missionGraph ?? ctx.missionGraph) as MissionContext["missionGraph"];
      if (event.type === "MISSION_GRAPH_CREATED") addTimeline(ctx, event);
      break;
    case "TASK_READY":
      patchTask(ctx, String(event.payload?.task ? (event.payload.task as ExecutionTask).id : event.workstreamId), { status: "ready" });
      patchWorkstream(ctx, String(event.workstreamId), { status: "ready" });
      break;
    case "TASK_STARTED":
      patchTask(ctx, String(event.payload?.task ? (event.payload.task as ExecutionTask).id : event.workstreamId), { status: "running", startedAt: event.timestamp });
      patchWorkstream(ctx, String(event.workstreamId), { status: "in_progress", startedAt: event.timestamp });
      break;
    case "TASK_BLOCKED":
      patchTask(ctx, String(event.payload?.task ? (event.payload.task as ExecutionTask).id : event.workstreamId), { status: "blocked" });
      patchWorkstream(ctx, String(event.workstreamId), { status: "blocked" });
      addTimeline(ctx, event);
      break;
    case "TASK_REASSIGNED":
    case "PLANNER_REVISED_PLAN":
      patchTask(ctx, String(event.payload?.taskId ?? event.workstreamId), { status: "revised", revisionNote: String(event.payload?.revisionNote ?? "Planner revised this node.") });
      patchWorkstream(ctx, String(event.workstreamId), { status: "revised", nextStep: String(event.payload?.revisionNote ?? "Planner revised this workstream.") });
      addTimeline(ctx, event);
      break;
    case "PLANNER_STARTED":
      ctx.status = MissionState.Planning;
      ctx.currentAgent = AgentRole.Planner;
      ctx.agentStates[AgentRole.Planner] = "thinking";
      addTimeline(ctx, event);
      break;
    case "PLANNER_STREAM":
    case "AGENT_STREAM":
    case "FINALIZER_STREAM":
      applyStream(ctx, event);
      break;
    case "PLANNER_FINISHED":
      ctx.agentStates[AgentRole.Planner] = "complete";
      ctx.currentAgent = null;
      addTimeline(ctx, event);
      break;
    case "WORKSTREAM_CREATED":
      upsertWorkstream(ctx, (event.payload?.workstream ?? {}) as Workstream);
      addTimeline(ctx, event);
      break;
    case "WORKSTREAM_ASSIGNED":
      patchWorkstream(ctx, String(event.workstreamId), {
        assignedAgent: event.agentRole ?? null,
        owner: event.agentName,
        responsibleAgent: event.agentName,
        status: "pending",
      });
      break;
    case "AGENT_WAITING":
    case "AGENT_THINKING":
    case "AGENT_ANALYZING":
    case "AGENT_REVIEWING":
    case "AGENT_STARTED":
    case "MEDIATOR_STARTED":
    case "FINALIZER_STARTED":
      applyAgentState(ctx, event);
      break;
    case "AGENT_FINISHED":
    case "MEDIATOR_FINISHED":
    case "FINALIZER_FINISHED":
      finishAgent(ctx, event);
      break;
    case "CONFIDENCE_UPDATED":
      applyConfidenceTransition(ctx, event);
      break;
    case "DIALOGUE_CREATED":
      ctx.dialogue = [...ctx.dialogue, event.payload?.dialogue as AgentDialogueEntry].filter(Boolean);
      break;
    case "CONFLICT_DETECTED":
    case "CONFLICT_CREATED":
    case "CONFLICT_UPDATED":
      upsertConflict(ctx, event.payload?.conflict as ConflictInfo);
      addTimeline(ctx, event);
      break;
    case "MEDIATION_STARTED":
      ctx.status = MissionState.ConflictResolution;
      ctx.currentAgent = AgentRole.Mediator;
      ctx.agentStates[AgentRole.Mediator] = "thinking";
      addTimeline(ctx, event);
      break;
    case "SYNCHRONIZATION_POINT_REACHED":
      addTimeline(ctx, event);
      break;
    case "CONFLICT_RESOLVED":
      upsertConflict(ctx, { ...(event.payload?.conflict as ConflictInfo), resolved: true });
      addTimeline(ctx, event);
      break;
    case "REPORT_GENERATED":
      ctx.finalReport = event.payload?.report as MissionReport;
      ctx.efficiencyMetrics = (event.payload?.metrics ?? ctx.efficiencyMetrics) as EfficiencyMetrics | null;
      addTimeline(ctx, event);
      break;
    case "MISSION_COMPLETED":
      ctx.status = MissionState.Completed;
      ctx.currentAgent = null;
      ctx.completedAt = event.timestamp;
      ctx.workstreams = ctx.workstreams.map((workstream) => ({ ...workstream, status: "completed" }));
      ctx.executionTasks = ctx.executionTasks.map((task) => ({ ...task, status: "completed" }));
      ctx.progress = 1;
      addTimeline(ctx, event);
      break;
  }
}

function applyStream(ctx: MissionContext, event: MissionReplayEvent) {
  const chunk = String(event.payload?.chunk ?? "");
  if (!chunk) return;
  const role = event.agentRole ?? AgentRole.Planner;
  if (event.type === "FINALIZER_STREAM") {
    ctx.finalReport = partialReport(ctx, chunk);
  } else if (event.type === "PLANNER_STREAM") {
    ctx.agentStates[AgentRole.Planner] = "analyzing";
  } else {
    appendRoleOutput(ctx, role, chunk);
  }
}

function partialReport(ctx: MissionContext, chunk: string): MissionReport {
  const current = ctx.finalReport;
  return {
    executiveSummary: [current?.executiveSummary, chunk].filter(Boolean).join(""),
    missionObjective: current?.missionObjective ?? ctx.missionBrief,
    selectedMissionConfiguration: current?.selectedMissionConfiguration ?? "",
    workstreams: current?.workstreams ?? "",
    roleAssignments: current?.roleAssignments ?? "",
    agentContributions: current?.agentContributions ?? "",
    keyDisagreements: current?.keyDisagreements ?? "",
    mediatorDecisions: current?.mediatorDecisions ?? "",
    executionRoadmap: current?.executionRoadmap ?? "",
    timeline: current?.timeline ?? "",
    budgetEstimate: current?.budgetEstimate ?? "",
    riskAssessment: current?.riskAssessment ?? "",
    successMetrics: current?.successMetrics ?? "",
    finalRecommendations: current?.finalRecommendations ?? "",
    singleAgentComparison: current?.singleAgentComparison ?? "",
  };
}

function appendRoleOutput(ctx: MissionContext, role: AgentRole, chunk: string) {
  if (role === AgentRole.Researcher) ctx.researchSummary += chunk;
  if (role === AgentRole.ProductStrategist) ctx.productStrategy += chunk;
  if (role === AgentRole.TechnicalArchitect) ctx.technicalArchitecture += chunk;
  if (role === AgentRole.MarketingStrategist) ctx.marketingStrategy += chunk;
  if (role === AgentRole.Finance) ctx.financialPlan += chunk;
  if (role === AgentRole.RiskCritic) ctx.riskReview += chunk;
  if (role === AgentRole.Mediator) ctx.mediatorDecisions += chunk;
}

function applyAgentState(ctx: MissionContext, event: MissionReplayEvent) {
  const role = event.agentRole;
  if (!role) return;
  const state = event.type === "AGENT_ANALYZING" ? "analyzing" : event.type === "AGENT_REVIEWING" ? "reviewing" : event.type === "AGENT_WAITING" ? "waiting" : "thinking";
  ctx.agentStates[role] = state;
  const activity = event.payload?.activity as AgentActivity | undefined;
  ctx.agentActivities = {
    ...ctx.agentActivities,
    [role]: activity ?? {
      state,
      label: state === "analyzing" ? "Evaluating shared findings" : state === "reviewing" ? "Cross-checking assumptions" : state === "waiting" ? "Waiting for dependencies" : "Reviewing council context",
      detail: event.workstreamTitle ?? "Replay restored this agent activity.",
      updatedAt: event.timestamp,
      confidence: event.confidence,
    },
  };
  ctx.currentAgent = role;
  if (event.workstreamId) patchWorkstream(ctx, event.workstreamId, { status: state === "waiting" ? "pending" : "in_progress", confidence: event.confidence });
  if (event.type === "AGENT_STARTED" || event.type === "MEDIATOR_STARTED" || event.type === "FINALIZER_STARTED") {
    addTimeline(ctx, event);
  }
}

function finishAgent(ctx: MissionContext, event: MissionReplayEvent) {
  const role = event.agentRole;
  if (!role) return;
  ctx.agentStates[role] = "complete";
  const activity = event.payload?.activity as AgentActivity | undefined;
  ctx.agentActivities = {
    ...ctx.agentActivities,
    [role]: activity ?? {
      state: "complete",
      label: "Contribution shared with the council",
      detail: event.workstreamTitle ?? "Replay restored the completed contribution.",
      updatedAt: event.timestamp,
      confidence: event.confidence,
    },
  };
  ctx.currentAgent = null;
  if (event.workstreamId) {
    patchWorkstream(ctx, event.workstreamId, { status: "completed", output: String(event.payload?.output ?? ""), confidence: event.confidence, completedAt: event.timestamp });
    patchTask(ctx, event.workstreamId, { status: "completed", output: String(event.payload?.output ?? ""), confidence: event.confidence ?? 80, completedAt: event.timestamp });
  }
  addTimeline(ctx, event);
}

function applyConfidenceTransition(ctx: MissionContext, event: MissionReplayEvent) {
  const role = event.agentRole;
  if (!role) return;
  const activity = event.payload?.activity as AgentActivity | undefined;
  const previous = Number(event.payload?.previousConfidence ?? 0);
  const reason = String(event.payload?.reason ?? "Shared context was updated.");
  if (event.workstreamId) {
    patchWorkstream(ctx, event.workstreamId, { confidence: event.confidence });
    patchTask(ctx, event.workstreamId, { confidence: event.confidence });
  }
  ctx.agentActivities = {
    ...ctx.agentActivities,
    [role]: activity ?? {
      state: ctx.agentStates[role],
      label: "Updating confidence",
      detail: reason,
      updatedAt: event.timestamp,
      confidence: event.confidence,
      confidenceDelta: event.confidence != null && previous ? event.confidence - previous : undefined,
      confidenceReason: reason,
    },
  };
  addTimeline(ctx, event);
}

function upsertWorkstream(ctx: MissionContext, workstream: Workstream) {
  if (!workstream?.id) return;
  const existing = ctx.workstreams.some((item) => item.id === workstream.id);
  ctx.workstreams = existing ? ctx.workstreams.map((item) => item.id === workstream.id ? { ...item, ...workstream } : item) : [...ctx.workstreams, { ...workstream, status: workstream.status ?? "pending" }];
  if (workstream.assignedAgent) {
    const task: ExecutionTask = {
      id: workstream.id,
      workstreamId: workstream.id,
      title: workstream.title,
      agent: workstream.assignedAgent,
      dependencies: workstream.dependencies ?? [],
      status: "pending",
      confidence: workstream.confidence ?? 75,
    };
    patchTask(ctx, workstream.id, task);
  }
}

function patchWorkstream(ctx: MissionContext, id: string, patch: Partial<Workstream>) {
  ctx.workstreams = ctx.workstreams.map((workstream) => workstream.id === id ? { ...workstream, ...patch } : workstream);
}

function patchTask(ctx: MissionContext, workstreamId: string, patch: Partial<ExecutionTask>) {
  const existing = ctx.executionTasks.some((task) => task.workstreamId === workstreamId || task.id === workstreamId);
  if (!existing && patch.agent && patch.title) {
    ctx.executionTasks = [...ctx.executionTasks, patch as ExecutionTask];
    return;
  }
  ctx.executionTasks = ctx.executionTasks.map((task) => task.workstreamId === workstreamId || task.id === workstreamId ? { ...task, ...patch } : task);
}

function upsertConflict(ctx: MissionContext, conflict?: ConflictInfo) {
  if (!conflict?.id) return;
  ctx.conflicts = ctx.conflicts.some((item) => item.id === conflict.id)
    ? ctx.conflicts.map((item) => item.id === conflict.id ? { ...item, ...conflict } : item)
    : [...ctx.conflicts, conflict];
}

function addTimeline(ctx: MissionContext, event: MissionReplayEvent) {
  const payload = event.payload ?? {};
  const activity = payload.activity as AgentActivity | undefined;
  const task = payload.task as ExecutionTask | undefined;
  const workstream = payload.workstream as Workstream | undefined;
  const conflict = payload.conflict as ConflictInfo | undefined;
  const report = (payload.report ?? payload.finalReport) as MissionReport | undefined;
  const classification = payload.classification as { semantic?: { objective?: string }; strategy?: { planningReason?: string } } | undefined;
  const output = structuredReplayOutput(payload.output);
  const graph = payload.missionGraph as MissionContext["missionGraph"] | undefined;
  const graphSummary = graph?.taskNodes?.map((node) => node.title).filter(Boolean).join("; ") ?? "";
  const label = firstReplayText([
    output.timelineTitle,
    activity?.label,
    task?.title,
    workstream?.title,
    conflict?.title,
    event.workstreamTitle,
    humanizeReplayType(event.type),
  ]);
  const description = firstReplayText([
    output.timelineDescription,
    output.councilMessage,
    output.summary,
    activity?.detail,
    task?.revisionNote,
    workstream?.description,
    conflict?.mediatorDecision,
    conflict?.resolution,
    conflict?.disagreementSummary,
    conflict?.summary,
    conflict?.description,
    report?.executiveSummary,
    classification?.semantic?.objective,
    classification?.strategy?.planningReason,
    String(payload.reason ?? ""),
    String(payload.revisionNote ?? ""),
    graphSummary,
    event.type.startsWith("MISSION_") ? ctx.missionBrief : "",
    event.workstreamTitle,
  ]);
  const entry: TimelineEntry = {
    agent: event.agentRole ?? AgentRole.Planner,
    state: ctx.status,
    label,
    description,
    significance: output.timelineSignificance,
    timestamp: event.timestamp,
    kind: event.type.includes("CONFLICT")
      ? "conflict"
      : event.type.includes("REPORT") || event.type === "MISSION_COMPLETED"
        ? "report"
        : event.type.includes("WORKSTREAM") || event.type.includes("TASK") || event.type.includes("GRAPH") || event.type.includes("PLANNER")
          ? "workstream"
          : "agent",
  };
  ctx.timeline = ctx.timeline.some((item) => item.timestamp === entry.timestamp && item.label === entry.label) ? ctx.timeline : [...ctx.timeline, entry];
}

function structuredReplayOutput(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return {} as { summary?: string; councilMessage?: string; timelineTitle?: string; timelineDescription?: string; timelineSignificance?: string };
  try {
    const parsed = JSON.parse(value) as {
      summary?: string;
      finalAnswer?: string;
      councilMessage?: string;
      timelineMilestone?: { title?: string; description?: string; significance?: string };
    };
    return {
      summary: parsed.finalAnswer || parsed.summary,
      councilMessage: parsed.councilMessage,
      timelineTitle: parsed.timelineMilestone?.title,
      timelineDescription: parsed.timelineMilestone?.description,
      timelineSignificance: parsed.timelineMilestone?.significance,
    };
  } catch {
    return { summary: value };
  }
}

function firstReplayText(values: Array<string | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? "";
}

function humanizeReplayType(type: string) {
  return type.toLocaleLowerCase().replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

export function getReplayDuration(events: MissionReplayEvent[]) {
  return normalizeReplayEvents(events).at(-1)?.relativeTimestamp ?? 0;
}

export function createReplayBookmarks(events: MissionReplayEvent[]): ReplayBookmark[] {
  const wanted: Partial<Record<MissionReplayEvent["type"], string>> = {
    MISSION_STARTED: "Mission Started",
    PLANNER_FINISHED: "Planner Complete",
    AGENT_STARTED: "First Workstream Started",
    AGENT_FINISHED: "First Agent Complete",
    CONFLICT_DETECTED: "Conflict Detected",
    CONFLICT_RESOLVED: "Mediator Resolution",
    FINALIZER_STARTED: "Finalizer Started",
    REPORT_GENERATED: "Report Generated",
    MISSION_COMPLETED: "Mission Complete",
  };
  const seen = new Set<string>();
  return normalizeReplayEvents(events).flatMap((event) => {
    const label = wanted[event.type];
    if (!label || seen.has(label)) return [];
    seen.add(label);
    return [{ label, time: event.relativeTimestamp, eventId: event.id }];
  });
}

export function computeReplayStats(events: MissionReplayEvent[], replayDuration = getReplayDuration(events)): ReplayStats {
  const sorted = normalizeReplayEvents(events);
  const finalState = buildMissionStateFromEvents(sorted, getReplayDuration(sorted));
  const activeCounts = new Map<number, number>();
  for (const event of sorted) {
    if (event.type === "AGENT_STARTED") activeCounts.set(event.relativeTimestamp, (activeCounts.get(event.relativeTimestamp) ?? 0) + 1);
  }
  const confidences = finalState.workstreams.map((workstream) => workstream.confidence ?? 0).filter(Boolean);
  return {
    missionDuration: getReplayDuration(sorted),
    replayDuration,
    totalEventsProcessed: sorted.length,
    agentMessages: sorted.filter((event) => event.type === "DIALOGUE_CREATED").length,
    conflicts: finalState.conflicts.length,
    resolvedConflicts: finalState.conflicts.filter((conflict) => conflict.resolved).length,
    agentSwitches: sorted.filter((event) => event.type === "AGENT_STARTED" || event.type === "MEDIATOR_STARTED" || event.type === "FINALIZER_STARTED").length,
    parallelTaskMoments: Array.from(activeCounts.values()).filter((count) => count > 1).length,
    averageConfidence: confidences.length ? Math.round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length) : 0,
    peakParallelism: Math.max(1, ...Array.from(activeCounts.values())),
    totalWorkstreamsCompleted: finalState.workstreams.filter((workstream) => workstream.status === "completed").length,
  };
}
