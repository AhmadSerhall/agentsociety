/**
 * Agent Society - Mission Engine
 *
 * Pure TypeScript orchestration layer for the multi-agent mission flow.
 */

import {
  AgentRole,
  BUDGET_RANGE_LABELS,
  DEPTH_LABELS,
  MISSION_TYPE_LABELS,
  MissionEventType,
  MissionState,
  OUTPUT_FORMAT_LABELS,
  RISK_TOLERANCE_LABELS,
  STATE_AGENT_MAP,
  TIME_HORIZON_LABELS,
  type AgentDialogueEntry,
  type AgentThinkingState,
  type ConflictInfo,
  type EfficiencyMetrics,
  type ExecutionTask,
  type MissionConfiguration,
  type MissionContext,
  type MissionEvent,
  type MissionReplayEvent,
  type MissionReplayEventType,
  type MissionReport,
  type TimelineEntry,
  type Workstream,
} from "@/types";
import { AGENT_DEFINITIONS, getAgentByRole } from "@/agents";
import { createQwenClient, isMockMode } from "@/services/qwen";
import { useRuntimeSettingsStore } from "@/store/runtime-settings-store";
import { extractActionItemsFromText, generateId, sanitizeMissionList, sanitizeMissionText } from "@/utils";
import { MockAgentRunner } from "./mock-agent-runner";
import type { EventListener } from "./types";

const PROGRESS_PER_PHASE = 1 / 9;

type MissionIntent =
  | "business_launch"
  | "technical_debugging"
  | "product_strategy"
  | "research_analysis"
  | "financial_planning"
  | "content_strategy"
  | "operational_plan"
  | "general_problem_solving";

interface MissionClassification {
  intent: MissionIntent;
  selectedAgents: AgentRole[];
  needsMarketing: boolean;
  needsFinance: boolean;
  needsProduct: boolean;
  isLaunch: boolean;
  isTechnical: boolean;
}

function now() {
  return new Date().toISOString();
}

function relativeTo(startedAt: string | null) {
  if (!startedAt) return 0;
  return Math.max(0, Date.now() - new Date(startedAt).getTime());
}

function createAgentStates(state: AgentThinkingState = "waiting"): Record<AgentRole, AgentThinkingState> {
  return {
    [AgentRole.Planner]: state,
    [AgentRole.Researcher]: state,
    [AgentRole.ProductStrategist]: state,
    [AgentRole.TechnicalArchitect]: state,
    [AgentRole.MarketingStrategist]: state,
    [AgentRole.Finance]: state,
    [AgentRole.RiskCritic]: state,
    [AgentRole.Mediator]: state,
    [AgentRole.Finalizer]: state,
  };
}

function devLog(label: string, value: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[MissionEngine] ${label}`, value);
  }
}

function configSummary(config: MissionConfiguration) {
  return [
    `Mission Type: ${MISSION_TYPE_LABELS[config.missionType]}`,
    `Depth: ${DEPTH_LABELS[config.depth]}`,
    `Time Horizon: ${TIME_HORIZON_LABELS[config.timeHorizon]}`,
    `Budget Range: ${BUDGET_RANGE_LABELS[config.budgetRange]}`,
    `Risk Tolerance: ${RISK_TOLERANCE_LABELS[config.riskTolerance]}`,
    `Output Format: ${OUTPUT_FORMAT_LABELS[config.outputFormat]}`,
  ].join("\n");
}

function buildPrompt(phase: MissionState, brief: string, ctx: MissionContext, config: MissionConfiguration, task?: ExecutionTask) {
  return `Mission Brief: ${brief}

Selected Mission Configuration:
${configSummary(config)}

Current Execution Task:
${task ? `Title: ${task.title}
Workstream: ${ctx.workstreams.find((workstream) => workstream.id === task.workstreamId)?.title ?? task.workstreamId}
Dependencies: ${task.dependencies.length ? task.dependencies.join(", ") : "None"}
Current Confidence: ${task.confidence}%` : "No specific task. Contribute to the current mission phase."}

Current Workstreams:
${ctx.workstreams.map((w) => `- ${w.title} [${w.status}, ${w.confidence ?? 70}% confidence]: ${w.description}`).join("\n") || "None yet"}

Previous Agent Outputs:
Research: ${ctx.researchSummary.slice(0, 500)}
Product: ${ctx.productStrategy.slice(0, 500)}
Technical: ${ctx.technicalArchitecture.slice(0, 500)}
Marketing: ${ctx.marketingStrategy.slice(0, 500)}
Finance: ${ctx.financialPlan.slice(0, 500)}
Risk: ${ctx.riskReview.slice(0, 500)}
Mediator: ${ctx.mediatorDecisions.slice(0, 500)}

Structured Dialogue Context:
${ctx.dialogue.slice(-6).map((entry) => `- ${entry.agentName} (${entry.status ?? "complete"}): ${entry.content.slice(0, 220).replace(/\n/g, " ")}`).join("\n") || "No prior dialogue."}

Shared Mission State:
- Agent States: ${Object.entries(ctx.agentStates).map(([role, state]) => `${role}=${state}`).join(", ")}
- Completed Tasks: ${ctx.executionTasks.filter((item) => item.status === "completed").map((item) => item.title).join("; ") || "None"}

Produce the ${phase} contribution. Make the output specific to the mission configuration, reference previous outputs where useful, and write as if communicating to the rest of the agent society.`;
}

export class MissionEngine {
  private listeners = new Map<MissionEventType, Set<EventListener>>();
  private abortController: AbortController | null = null;
  private contextRef: MissionContext | null = null;
  private mockRunner = new MockAgentRunner();

  on(type: MissionEventType, listener: EventListener): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
    return () => this.listeners.get(type)?.delete(listener);
  }

  emit(event: MissionEvent) {
    this.listeners.get(event.type)?.forEach((fn) => fn(event));
  }

  removeAllListeners() {
    this.listeners.clear();
  }

  getContext(): MissionContext | null {
    return this.contextRef;
  }

  cancelMission() {
    this.abortController?.abort();
  }

  async startMission(
    initialContext: MissionContext,
    onUpdate: (ctx: MissionContext) => void
  ): Promise<void> {
    this.abortController = new AbortController();
    const ctx: MissionContext = {
      ...initialContext,
      timeline: [...initialContext.timeline],
      agentStates: initialContext.agentStates ?? createAgentStates(),
      executionTasks: [...(initialContext.executionTasks ?? [])],
      replayEvents: [...(initialContext.replayEvents ?? [])],
    };
    const signal = this.abortController.signal;
    const mockMode = isMockMode();
    const qwenClient = mockMode ? null : createQwenClient();
    const classification = this.classifyMission(ctx.missionBrief);
    this.contextRef = ctx;
    devLog("mission classification", classification);

    try {
      this.recordReplayEvent(ctx, "MISSION_CREATED", { payload: { missionId: ctx.missionId, missionBrief: ctx.missionBrief, configuration: ctx.configuration } }, 0);
      this.recordReplayEvent(ctx, "MISSION_CONFIGURATION_SELECTED", { payload: { configuration: ctx.configuration } }, 30);
      this.recordReplayEvent(ctx, "MISSION_CLASSIFIED", { payload: { classification }, metadata: { selectedAgents: classification.selectedAgents } }, 60);
      ctx.status = MissionState.Preparing;
      ctx.startedAt = now();
      this.recordReplayEvent(ctx, "MISSION_STARTED", { payload: { missionId: ctx.missionId } }, 100);
      this.addTimeline(ctx, AgentRole.Planner, MissionState.Preparing, "Mission started", "Mission Control accepted the brief and initialized the agent sequence.", "system");
      this.emit({ type: MissionEventType.MissionStarted, timestamp: now(), payload: {} });
      onUpdate({ ...ctx });
      await this.delay(700, signal);

      await this.runAgentPhase(ctx, MissionState.Planning, mockMode, qwenClient, signal, onUpdate, classification);
      this.ensureRequiredWorkstreams(ctx, classification);
      ctx.executionTasks = this.createExecutionTasks(ctx.workstreams, classification);
      for (const workstream of ctx.workstreams) {
        const agent = getAgentByRole(workstream.assignedAgent ?? AgentRole.Planner);
        this.recordReplayEvent(ctx, "WORKSTREAM_CREATED", {
          agentId: agent?.id,
          agentName: agent?.name,
          agentRole: workstream.assignedAgent ?? AgentRole.Planner,
          workstreamId: workstream.id,
          workstreamTitle: workstream.title,
          payload: { workstream },
          confidence: workstream.confidence,
          dependencies: workstream.dependencies,
        });
        this.recordReplayEvent(ctx, "WORKSTREAM_ASSIGNED", {
          agentId: agent?.id,
          agentName: agent?.name,
          agentRole: workstream.assignedAgent ?? AgentRole.Planner,
          workstreamId: workstream.id,
          workstreamTitle: workstream.title,
          payload: { assignedAgent: workstream.assignedAgent, owner: workstream.owner },
          confidence: workstream.confidence,
          dependencies: workstream.dependencies,
        });
      }
      devLog("selected agents", Array.from(new Set(ctx.executionTasks.map((task) => task.agent))));
      devLog("dependency graph", ctx.executionTasks.map((task) => ({ title: task.title, agent: task.agent, dependencies: task.dependencies })));
      this.addTimeline(ctx, AgentRole.Planner, MissionState.Planning, "Execution tasks created", `${ctx.executionTasks.length} tasks created from Planner output. Independent tasks will run in parallel when dependencies allow.`, "workstream");
      ctx.progress = 0.16;
      this.emit({ type: MissionEventType.MissionProgress, timestamp: now(), payload: { progress: ctx.progress } });
      onUpdate({ ...ctx });

      await this.runExecutionTasks(ctx, mockMode, qwenClient, signal, onUpdate, classification);
      ctx.progress = 0.78;
      this.emit({ type: MissionEventType.MissionProgress, timestamp: now(), payload: { progress: ctx.progress } });
      onUpdate({ ...ctx });

      this.detectConflicts(ctx, classification);
      devLog("generated conflicts", ctx.conflicts);
      const shouldMediate = ctx.conflicts.length > 0;
      if (shouldMediate) {
        for (const conflict of ctx.conflicts) {
          this.recordReplayEvent(ctx, "CONFLICT_DETECTED", { payload: { conflict, conflictTitle: conflict.title }, metadata: { agents: conflict.agents } });
        }
        this.emit({ type: MissionEventType.ConflictDetected, timestamp: now(), payload: {} });
        onUpdate({ ...ctx });
        await this.runAgentPhase(ctx, MissionState.ConflictResolution, mockMode, qwenClient, signal, onUpdate, classification);
        ctx.conflicts = ctx.conflicts.map((conflict) => ({
          ...conflict,
          resolved: true,
          mediatorDecision: ctx.mediatorDecisions,
          resolution: ctx.mediatorDecisions,
          finalAction: this.resolveConflictAction(conflict, classification),
        }));
        for (const conflict of ctx.conflicts) {
          this.recordReplayEvent(ctx, "CONFLICT_RESOLVED", { payload: { conflict, conflictTitle: conflict.title }, metadata: { mediatorDecision: conflict.mediatorDecision } });
        }
        this.emit({ type: MissionEventType.ConflictResolved, timestamp: now(), payload: {} });
        ctx.progress = 0.88;
        onUpdate({ ...ctx });
      }

      await this.runAgentPhase(ctx, MissionState.Finalizing, mockMode, qwenClient, signal, onUpdate, classification);
      ctx.efficiencyMetrics = this.generateEfficiencyMetrics(ctx, shouldMediate);
      devLog("final metrics", ctx.efficiencyMetrics);
      ctx.finalReport = this.generateReport(ctx);
      this.recordReplayEvent(ctx, "REPORT_GENERATED", { agentRole: AgentRole.Finalizer, agentName: getAgentByRole(AgentRole.Finalizer)?.name, payload: { report: ctx.finalReport, metrics: ctx.efficiencyMetrics } });
      ctx.workstreams = ctx.workstreams.map((workstream) => ({ ...workstream, status: "completed" }));
      ctx.status = MissionState.Completed;
      ctx.progress = 1;
      ctx.currentAgent = null;
      ctx.completedAt = now();
      this.addTimeline(ctx, AgentRole.Finalizer, MissionState.Completed, "Mission completed", "Final report generated from configuration, workstreams, dialogue, conflict resolution, and efficiency metrics.", "report");
      this.recordReplayEvent(ctx, "MISSION_COMPLETED", { payload: { finalReport: ctx.finalReport, metrics: ctx.efficiencyMetrics } });
      this.emit({ type: MissionEventType.MissionCompleted, timestamp: now(), payload: {} });
      onUpdate({ ...ctx });
    } catch (error) {
      if (signal.aborted) {
        this.cancelContext(ctx);
        onUpdate({ ...ctx });
        this.emit({ type: MissionEventType.MissionCancelled, timestamp: now(), payload: {} });
        return;
      }
      ctx.status = MissionState.Failed;
      ctx.currentAgent = null;
      this.emit({ type: MissionEventType.MissionFailed, timestamp: now(), payload: { error: String(error) } });
      onUpdate({ ...ctx });
    }
  }

  private async runAgentPhase(
    ctx: MissionContext,
    phase: MissionState,
    mockMode: boolean,
    qwenClient: ReturnType<typeof createQwenClient> | null,
    signal: AbortSignal,
    onUpdate: (ctx: MissionContext) => void,
    classification?: MissionClassification
  ) {
    if (signal.aborted) throw new DOMException("Mission cancelled", "AbortError");

    const agentRole = STATE_AGENT_MAP[phase];
    if (!agentRole) return;
    const agentDef = getAgentByRole(agentRole);
    if (!agentDef) return;

    ctx.status = phase;
    ctx.currentAgent = agentRole;
    this.setAgentState(ctx, agentRole, "thinking");
    this.recordReplayEvent(ctx, phase === MissionState.Finalizing ? "FINALIZER_STARTED" : phase === MissionState.ConflictResolution ? "MEDIATOR_STARTED" : phase === MissionState.Planning ? "PLANNER_STARTED" : "AGENT_STARTED", {
      agentId: agentDef.id,
      agentName: agentDef.name,
      agentRole,
      payload: { phase },
    });
    this.recordReplayEvent(ctx, "AGENT_THINKING", { agentId: agentDef.id, agentName: agentDef.name, agentRole, payload: { phase } });
    this.addTimeline(ctx, agentRole, phase, `${agentDef.name} activated`, this.timelineDescription(phase), "agent");
    this.emit({ type: MissionEventType.AgentStarted, timestamp: now(), payload: { agentRole, agentName: agentDef.name, phase } });
    this.emit({ type: MissionEventType.AgentThinking, timestamp: now(), payload: { agentRole, agentName: agentDef.name } });
    onUpdate({ ...ctx });

    const phaseStart = Date.now();
    let result: string;

    if (mockMode) {
      await this.delay(Math.floor(this.mockRunner.getDelay(phase) * 0.35), signal);
      this.setAgentState(ctx, agentRole, "analyzing");
      this.recordReplayEvent(ctx, "AGENT_ANALYZING", { agentId: agentDef.id, agentName: agentDef.name, agentRole, payload: { phase } });
      onUpdate({ ...ctx });
      await this.delay(Math.floor(this.mockRunner.getDelay(phase) * 0.25), signal);
      this.setAgentState(ctx, agentRole, "reviewing");
      this.recordReplayEvent(ctx, "AGENT_REVIEWING", { agentId: agentDef.id, agentName: agentDef.name, agentRole, payload: { phase } });
      onUpdate({ ...ctx });
      await this.delay(this.mockRunner.getDelay(phase), signal);
      result = this.mockRunner.generate(phase, ctx, undefined, classification);
    } else if (qwenClient) {
      try {
        result = await qwenClient.chat([
          { role: "system", content: agentDef.systemPrompt },
          { role: "user", content: buildPrompt(phase, ctx.missionBrief, ctx, ctx.configuration) },
        ], { maxTokens: phase === MissionState.Finalizing ? 6000 : 4096, signal });
      } catch (error) {
        if (signal.aborted) throw error;
        if (!useRuntimeSettingsStore.getState().allowMockFallback) {
          throw new Error(`Qwen request failed during ${agentDef.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
        result = `## Qwen Fallback Activated\n\nQwen request failed for ${agentDef.name}, so Agent Society used the local mock runner because mock fallback is enabled in Settings.\n\n${this.mockRunner.generate(phase, ctx, undefined, classification)}`;
      }
      if (signal.aborted) throw new DOMException("Mission cancelled", "AbortError");
    } else {
      result = "No client available.";
    }

    this.recordStreamEvents(ctx, phase === MissionState.Planning ? "PLANNER_STREAM" : phase === MissionState.Finalizing ? "FINALIZER_STREAM" : "AGENT_STREAM", result, agentDef.id, agentDef.name, agentRole, phaseStart);
    this.storePhaseResult(ctx, phase, result, classification ?? this.classifyMission(ctx.missionBrief));
    this.setAgentState(ctx, agentRole, "complete");
    this.addDialogue(ctx, agentDef.id, agentDef.name, agentDef.role, result, phase === MissionState.ConflictResolution, {
      phase,
      status: "complete",
      confidence: this.averageConfidence(ctx),
    });
    this.addTimeline(ctx, agentDef.role, phase, `${agentDef.name} completed`, this.completionDescription(phase), this.timelineKind(phase), Date.now() - phaseStart);
    this.recordReplayEvent(ctx, phase === MissionState.Planning ? "PLANNER_FINISHED" : phase === MissionState.Finalizing ? "FINALIZER_FINISHED" : phase === MissionState.ConflictResolution ? "MEDIATOR_FINISHED" : "AGENT_FINISHED", {
      agentId: agentDef.id,
      agentName: agentDef.name,
      agentRole,
      payload: { phase, output: result },
      confidence: this.averageConfidence(ctx),
    });
    this.emit({ type: MissionEventType.AgentFinished, timestamp: now(), payload: { agentRole, agentName: agentDef.name, phase } });
    onUpdate({ ...ctx });
  }

  private async runExecutionTasks(
    ctx: MissionContext,
    mockMode: boolean,
    qwenClient: ReturnType<typeof createQwenClient> | null,
    signal: AbortSignal,
    onUpdate: (ctx: MissionContext) => void,
    classification: MissionClassification
  ) {
    while (ctx.executionTasks.some((task) => task.status !== "completed")) {
      if (signal.aborted) throw new DOMException("Mission cancelled", "AbortError");

      const completedTaskIds = new Set(ctx.executionTasks.filter((task) => task.status === "completed").map((task) => task.id));
      const readyTasks = ctx.executionTasks.filter((task) =>
        task.status === "pending" && task.dependencies.every((dependency) => completedTaskIds.has(dependency))
      );

      if (readyTasks.length === 0) {
        throw new Error("Mission execution deadlock: no workstreams are ready to run.");
      }

      ctx.executionTasks
        .filter((task) => task.status === "pending" && !readyTasks.some((readyTask) => readyTask.id === task.id))
        .forEach((task) => this.setAgentState(ctx, task.agent, "waiting"));

      this.addTimeline(
        ctx,
        AgentRole.Planner,
        MissionState.Planning,
        readyTasks.length > 1 ? "Parallel workstreams started" : "Workstream started",
        `${readyTasks.map((task) => task.title).join(", ")} ${readyTasks.length > 1 ? "are" : "is"} ready based on current dependencies.`,
        "workstream"
      );
      onUpdate({ ...ctx });

      await Promise.all(readyTasks.map((task) => this.runExecutionTask(ctx, task, mockMode, qwenClient, signal, onUpdate, classification)));

      const completedCount = ctx.executionTasks.filter((task) => task.status === "completed").length;
      ctx.progress = Math.min(0.78, 0.16 + (completedCount / Math.max(1, ctx.executionTasks.length)) * 0.58);
      this.emit({ type: MissionEventType.MissionProgress, timestamp: now(), payload: { progress: ctx.progress } });
      onUpdate({ ...ctx });
    }
  }

  private async runExecutionTask(
    ctx: MissionContext,
    task: ExecutionTask,
    mockMode: boolean,
    qwenClient: ReturnType<typeof createQwenClient> | null,
    signal: AbortSignal,
    onUpdate: (ctx: MissionContext) => void,
    classification: MissionClassification
  ) {
    const agentDef = getAgentByRole(task.agent);
    if (!agentDef) return;
    const phase = this.phaseForAgent(task.agent);
    const phaseStart = Date.now();

    this.updateTask(ctx, task.id, { status: "in_progress", startedAt: now() });
    this.updateWorkstream(ctx, task.workstreamId, { status: "in_progress", startedAt: now() });
    ctx.status = phase;
    ctx.currentAgent = task.agent;
    this.setAgentState(ctx, task.agent, "thinking");
    this.recordReplayEvent(ctx, "AGENT_STARTED", {
      agentId: agentDef.id,
      agentName: agentDef.name,
      agentRole: task.agent,
      workstreamId: task.workstreamId,
      workstreamTitle: task.title,
      payload: { task },
      confidence: task.confidence,
      dependencies: task.dependencies,
    });
    this.recordReplayEvent(ctx, "AGENT_THINKING", { agentId: agentDef.id, agentName: agentDef.name, agentRole: task.agent, workstreamId: task.workstreamId, workstreamTitle: task.title, confidence: task.confidence, dependencies: task.dependencies });
    this.emit({ type: MissionEventType.AgentStarted, timestamp: now(), payload: { agentRole: task.agent, agentName: agentDef.name, phase, taskId: task.id } });
    this.emit({ type: MissionEventType.AgentThinking, timestamp: now(), payload: { agentRole: task.agent, agentName: agentDef.name, taskId: task.id } });
    onUpdate({ ...ctx });

    let result: string;
    if (mockMode) {
      const delay = this.mockRunner.getDelay(phase);
      await this.delay(Math.floor(delay * 0.35), signal);
      this.setAgentState(ctx, task.agent, "analyzing");
      this.recordReplayEvent(ctx, "AGENT_ANALYZING", { agentId: agentDef.id, agentName: agentDef.name, agentRole: task.agent, workstreamId: task.workstreamId, workstreamTitle: task.title, confidence: task.confidence, dependencies: task.dependencies });
      onUpdate({ ...ctx });
      await this.delay(Math.floor(delay * 0.35), signal);
      this.setAgentState(ctx, task.agent, "reviewing");
      this.recordReplayEvent(ctx, "AGENT_REVIEWING", { agentId: agentDef.id, agentName: agentDef.name, agentRole: task.agent, workstreamId: task.workstreamId, workstreamTitle: task.title, confidence: task.confidence, dependencies: task.dependencies });
      onUpdate({ ...ctx });
      await this.delay(Math.floor(delay * 0.3), signal);
      result = this.mockRunner.generate(phase, ctx, task, classification);
    } else if (qwenClient) {
      this.setAgentState(ctx, task.agent, "analyzing");
      onUpdate({ ...ctx });
      try {
        result = await qwenClient.chat([
          { role: "system", content: agentDef.systemPrompt },
          { role: "user", content: buildPrompt(phase, ctx.missionBrief, ctx, ctx.configuration, task) },
        ], { maxTokens: 4096, signal });
      } catch (error) {
        if (signal.aborted) throw error;
        if (!useRuntimeSettingsStore.getState().allowMockFallback) {
          throw new Error(`Qwen request failed during ${agentDef.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
        result = `## Qwen Fallback Activated\n\nQwen request failed for ${agentDef.name}, so Agent Society used the local mock runner because mock fallback is enabled in Settings.\n\n${this.mockRunner.generate(phase, ctx, task, classification)}`;
      }
      this.setAgentState(ctx, task.agent, "reviewing");
      this.recordReplayEvent(ctx, "AGENT_REVIEWING", { agentId: agentDef.id, agentName: agentDef.name, agentRole: task.agent, workstreamId: task.workstreamId, workstreamTitle: task.title, confidence: task.confidence, dependencies: task.dependencies });
      onUpdate({ ...ctx });
    } else {
      result = "No client available.";
    }

    const nextConfidence = this.evolveConfidence(task.confidence, result, ctx);
    this.recordStreamEvents(ctx, "AGENT_STREAM", result, agentDef.id, agentDef.name, task.agent, phaseStart, task);
    this.storePhaseResult(ctx, phase, result, classification);
    this.updateTask(ctx, task.id, { status: "completed", output: result, completedAt: now(), confidence: nextConfidence });
    this.updateWorkstream(ctx, task.workstreamId, { status: "completed", output: result, completedAt: now(), confidence: nextConfidence });
    this.setAgentState(ctx, task.agent, "complete");
    this.addDialogue(ctx, agentDef.id, agentDef.name, agentDef.role, result, phase === MissionState.RiskReview, {
      phase,
      status: "complete",
      referencedWorkstreamIds: [task.workstreamId],
      confidence: nextConfidence,
    });
    this.addTimeline(ctx, task.agent, phase, `${agentDef.name} completed ${task.title}`, `Confidence moved from ${task.confidence}% to ${nextConfidence}% after reviewing shared context and dependencies.`, this.timelineKind(phase), Date.now() - phaseStart);
    this.recordReplayEvent(ctx, "AGENT_FINISHED", {
      agentId: agentDef.id,
      agentName: agentDef.name,
      agentRole: task.agent,
      workstreamId: task.workstreamId,
      workstreamTitle: task.title,
      payload: { task: { ...task, status: "completed", output: result, confidence: nextConfidence }, output: result },
      confidence: nextConfidence,
      dependencies: task.dependencies,
    });
    this.emit({ type: MissionEventType.AgentFinished, timestamp: now(), payload: { agentRole: task.agent, agentName: agentDef.name, phase, taskId: task.id } });
    onUpdate({ ...ctx });
  }

  private delay(ms: number, signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Mission cancelled", "AbortError"));
        return;
      }
      const timeout = window.setTimeout(resolve, ms);
      signal.addEventListener("abort", () => {
        window.clearTimeout(timeout);
        reject(new DOMException("Mission cancelled", "AbortError"));
      }, { once: true });
    });
  }

  private cancelContext(ctx: MissionContext) {
    ctx.status = MissionState.Cancelled;
    ctx.currentAgent = null;
    ctx.completedAt = now();
    this.addTimeline(ctx, AgentRole.RiskCritic, MissionState.Cancelled, "Mission cancelled", "Sequence stopped by the operator. Partial work remains visible for review.", "cancelled");
  }

  private addDialogue(
    ctx: MissionContext,
    agentId: string,
    agentName: string,
    agentRole: AgentRole,
    content: string,
    isConflict = false,
    metadata: Partial<AgentDialogueEntry> = {}
  ) {
    const entry: AgentDialogueEntry = {
      agentId,
      agentName,
      agentRole,
      content,
      timestamp: now(),
      isConflict,
      ...metadata,
    };
    ctx.dialogue = [...ctx.dialogue, entry];
    this.recordReplayEvent(ctx, "DIALOGUE_CREATED", {
      agentId,
      agentName,
      agentRole,
      workstreamId: metadata.referencedWorkstreamIds?.[0],
      payload: { dialogue: entry },
      confidence: metadata.confidence,
      dialogueReference: `${agentId}-${entry.timestamp}`,
      metadata,
    });
  }

  private recordReplayEvent(
    ctx: MissionContext,
    type: MissionReplayEventType,
    event: Partial<MissionReplayEvent> = {},
    relativeTimestamp = relativeTo(ctx.startedAt)
  ) {
    const replayEvent: MissionReplayEvent = {
      id: generateId(),
      type,
      timestamp: now(),
      relativeTimestamp,
      ...event,
      metadata: event.metadata ?? {},
    };
    ctx.replayEvents = [...ctx.replayEvents, replayEvent];
  }

  private recordStreamEvents(
    ctx: MissionContext,
    type: Extract<MissionReplayEventType, "PLANNER_STREAM" | "AGENT_STREAM" | "FINALIZER_STREAM">,
    output: string,
    agentId: string,
    agentName: string,
    agentRole: AgentRole,
    phaseStart: number,
    task?: ExecutionTask
  ) {
    const chunks = this.chunkText(output);
    const baseRelative = Math.max(0, phaseStart - (ctx.startedAt ? new Date(ctx.startedAt).getTime() : phaseStart));
    const span = Math.max(800, Date.now() - phaseStart);
    chunks.forEach((chunk, index) => {
      this.recordReplayEvent(ctx, type, {
        agentId,
        agentName,
        agentRole,
        workstreamId: task?.workstreamId,
        workstreamTitle: task?.title,
        payload: { chunk, index, totalChunks: chunks.length },
        confidence: task?.confidence,
        dependencies: task?.dependencies,
      }, baseRelative + Math.round((span * (index + 1)) / Math.max(1, chunks.length + 1)));
    });
  }

  private chunkText(text: string) {
    const words = text.split(/(\s+)/);
    const chunks: string[] = [];
    let current = "";
    for (const word of words) {
      current += word;
      if (current.length >= 90) {
        chunks.push(current);
        current = "";
      }
    }
    if (current.trim()) chunks.push(current);
    return chunks.slice(0, 80);
  }

  private addTimeline(
    ctx: MissionContext,
    agent: AgentRole,
    state: MissionState,
    label: string,
    description: string,
    kind: TimelineEntry["kind"] = "agent",
    duration?: number
  ) {
    ctx.timeline = [...ctx.timeline, { agent, state, label, description, kind, duration, timestamp: now() }];
  }

  private storePhaseResult(ctx: MissionContext, phase: MissionState, result: string, classification: MissionClassification) {
    switch (phase) {
      case MissionState.Planning:
        devLog("planner raw output", result);
        ctx.workstreams = this.parseWorkstreams(result, classification, ctx.missionBrief);
        devLog("parsed workstreams", ctx.workstreams);
        this.addTimeline(ctx, AgentRole.Planner, phase, "Workstreams created", `${ctx.workstreams.length} workstreams created and assigned to specialist agents.`, "workstream");
        break;
      case MissionState.Researching:
        ctx.researchSummary = this.appendOutput(ctx.researchSummary, result);
        break;
      case MissionState.ProductStrategy:
        ctx.productStrategy = this.appendOutput(ctx.productStrategy, result);
        break;
      case MissionState.TechnicalArchitecture:
        ctx.technicalArchitecture = this.appendOutput(ctx.technicalArchitecture, result);
        break;
      case MissionState.MarketingStrategy:
        ctx.marketingStrategy = this.appendOutput(ctx.marketingStrategy, result);
        break;
      case MissionState.FinancialAnalysis:
        ctx.financialPlan = this.appendOutput(ctx.financialPlan, result);
        break;
      case MissionState.RiskReview:
        ctx.riskReview = this.appendOutput(ctx.riskReview, result);
        break;
      case MissionState.ConflictResolution:
        ctx.mediatorDecisions = this.appendOutput(ctx.mediatorDecisions, result);
        break;
    }
  }

  private appendOutput(existing: string, next: string) {
    return existing ? `${existing}\n\n---\n\n${next}` : next;
  }

  private parseWorkstreams(text: string, classification: MissionClassification, brief: string): Workstream[] {
    const normalized = sanitizeMissionText(text);
    const headingPattern = /(?:^|\n)\s*(?:#{1,4}\s*)?(?:\*\*)?(?:(?:Workstream|Task)\s*(\d+)?|(\d+))\s*[:.)-]\s*(.+?)(?:\*\*)?\s*(?=\n|$)/gi;
    const matches = Array.from(normalized.matchAll(headingPattern));

    const workstreams = matches.map((match, index) => {
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[index + 1]?.index ?? normalized.length;
      const body = normalized.slice(start, end);
      const owner = this.extractField(body, ["Owner", "Responsible Agent", "Responsible", "Agent", "Assigned Agent"]);
      const description = this.extractField(body, ["Description", "Objective", "Summary"]) || this.firstMeaningfulLine(body);
      const deliverables = this.extractListField(body, ["Deliverables", "Outputs", "Output", "Artifacts"]);
      const dependencies = this.extractDependencyNumbers(body);
      const nextStep = this.extractField(body, ["Next Step", "Next Action"]);
      const confidence = Number(this.extractField(body, ["Confidence"])?.match(/\d+/)?.[0] ?? Math.max(68, 86 - index * 3));
      const title = sanitizeMissionText(match[3]);
      const assignedAgent = this.agentFromOwner(owner) ?? this.agentForMissionWorkstream(classification, title, index);

      return {
        id: generateId(),
        title: title || `Workstream ${index + 1}`,
        owner: sanitizeMissionText(owner) || getAgentByRole(assignedAgent)?.name,
        responsibleAgent: sanitizeMissionText(owner) || getAgentByRole(assignedAgent)?.name,
        description: sanitizeMissionText(description),
        status: "pending" as const,
        assignedAgent,
        confidence,
        dependencies: dependencies.map((dependencyIndex) => `workstream-${dependencyIndex}`),
        nextStep: sanitizeMissionText(nextStep),
        deliverables: sanitizeMissionList(deliverables),
      };
    }).filter((workstream) => workstream.title && workstream.description);

    if (workstreams.length === 0) {
      console.warn("[MissionEngine] Planner parsing failed; using mission-specific fallback workstreams.", { classification, text });
      devLog("fallback used", true);
      return this.fallbackWorkstreams(classification, brief);
    }

    devLog("fallback used", false);
    return workstreams.map((workstream, _index, list) => ({
      ...workstream,
      dependencies: workstream.dependencies?.map((dependencyKey) => {
        const dependencyIndex = Number(dependencyKey.replace("workstream-", "")) - 1;
        return list[dependencyIndex]?.id;
      }).filter((id): id is string => Boolean(id)) ?? [],
      deliverables: workstream.deliverables.length > 0 ? workstream.deliverables : extractActionItemsFromText(workstream.description, 3),
    }));
  }

  private extractField(body: string, labels: string[]) {
    for (const label of labels) {
      const match = body.match(new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?${label}\\s*:\\s*([^\\n]+)`, "i"));
      if (match?.[1]) return sanitizeMissionText(match[1]);
    }
    return "";
  }

  private extractListField(body: string, labels: string[]) {
    const field = this.extractField(body, labels);
    if (!field) return [];
    return field.split(/[;|]/).flatMap((item) => item.split(/,(?=\s*[A-Z])/));
  }

  private extractDependencyNumbers(body: string) {
    const dependencies = this.extractField(body, ["Dependencies", "Depends On", "Blocked By"]);
    if (!dependencies || /none/i.test(dependencies)) return [];
    return dependencies.split(/[;,]/).map((item) => Number(item.match(/\d+/)?.[0])).filter((item) => Number.isFinite(item) && item > 0);
  }

  private firstMeaningfulLine(body: string) {
    return sanitizeMissionText(body).split("\n").find((line) => !/^(Owner|Responsible|Confidence|Deliverables|Dependencies|Next Step):/i.test(line.trim())) ?? "";
  }

  private fallbackWorkstreams(classification: MissionClassification, brief: string): Workstream[] {
    const focus = brief.replace(/\s+/g, " ").trim();
    const templates: Record<MissionIntent, Array<{ title: string; agent: AgentRole; description: string; deliverables: string[]; dependencies?: number[] }>> = {
      technical_debugging: [
        { title: "Performance Profiling & Baseline Measurement", agent: AgentRole.TechnicalArchitect, description: `Measure current performance symptoms, reproduction paths, bottlenecks, and user-visible latency for: ${focus}.`, deliverables: ["Performance baseline", "Reproduction checklist", "Measurement plan"] },
        { title: "Render & Re-render Analysis", agent: AgentRole.TechnicalArchitect, description: "Audit component render frequency, expensive calculations, memoization gaps, and state updates.", deliverables: ["Render trace findings", "Component hot spot list", "Memoization candidates"], dependencies: [1] },
        { title: "Network/API/Data Fetching Audit", agent: AgentRole.RiskCritic, description: "Separate frontend render cost from API latency, data waterfalls, cache misses, and request duplication.", deliverables: ["Request waterfall map", "Latency split", "Data fetching fixes"], dependencies: [1] },
        { title: "Bundle/Asset Optimization", agent: AgentRole.TechnicalArchitect, description: "Inspect bundle size, dynamic import opportunities, asset weight, and third-party script cost.", deliverables: ["Bundle report", "Code splitting plan", "Asset optimization list"], dependencies: [1] },
        { title: "Prioritized Optimization Roadmap", agent: AgentRole.Finalizer, description: "Sequence fixes by impact, risk, and regression cost.", deliverables: ["Priority roadmap", "Regression checklist", "Monitoring plan"], dependencies: [2, 3, 4] },
      ],
      business_launch: [
        { title: "Market & Customer Validation", agent: AgentRole.Researcher, description: `Validate target users, competitors, demand signals, and adoption barriers for: ${focus}.`, deliverables: ["Customer assumptions", "Competitor map", "Validation script"] },
        { title: "Product Offer & Positioning", agent: AgentRole.ProductStrategist, description: "Define offer, packaging, core benefits, pricing logic, and launch promise.", deliverables: ["Offer brief", "Positioning map", "Success criteria"], dependencies: [1] },
        { title: "Go-To-Market Campaign Plan", agent: AgentRole.MarketingStrategist, description: "Build channels, messaging, launch calendar, and acquisition experiments.", deliverables: ["Campaign calendar", "Channel plan", "Message map"], dependencies: [2] },
        { title: "Budget & Resource Model", agent: AgentRole.Finance, description: "Estimate launch budget, runway, team needs, and tradeoffs.", deliverables: ["Budget model", "Resource plan", "Runway estimate"], dependencies: [2] },
        { title: "Launch Risk Review", agent: AgentRole.RiskCritic, description: "Challenge timeline, positioning, spend, and operational readiness.", deliverables: ["Risk register", "Mitigation plan", "Go/no-go checklist"], dependencies: [3, 4] },
      ],
      product_strategy: [
        { title: "User & Problem Definition", agent: AgentRole.Researcher, description: `Clarify users, jobs-to-be-done, constraints, and decision criteria for: ${focus}.`, deliverables: ["User map", "Problem statement", "Evidence gaps"] },
        { title: "Option & Scope Design", agent: AgentRole.ProductStrategist, description: "Compare solution options, define scope, and map tradeoffs.", deliverables: ["Option matrix", "Scope proposal", "Success metrics"], dependencies: [1] },
        { title: "Architecture Feasibility Review", agent: AgentRole.TechnicalArchitect, description: "Assess technical implications and implementation complexity.", deliverables: ["Feasibility notes", "Dependency map", "Build risk list"], dependencies: [2] },
        { title: "Cost, Risk & Decision Mediation", agent: AgentRole.RiskCritic, description: "Identify conflicting priorities and decision risks.", deliverables: ["Tradeoff summary", "Decision risks", "Recommendation guardrails"], dependencies: [2, 3] },
      ],
      research_analysis: [
        { title: "Research Frame & Sources", agent: AgentRole.Researcher, description: `Define research questions, source quality, and evidence standards for: ${focus}.`, deliverables: ["Research questions", "Source plan", "Evidence rubric"] },
        { title: "Evidence Synthesis", agent: AgentRole.Researcher, description: "Cluster findings, contradictions, and confidence levels.", deliverables: ["Finding clusters", "Contradiction map", "Confidence notes"], dependencies: [1] },
        { title: "Implication & Risk Review", agent: AgentRole.RiskCritic, description: "Stress-test conclusions and flag uncertainty.", deliverables: ["Risk notes", "Assumption checks", "Open questions"], dependencies: [2] },
        { title: "Decision Brief", agent: AgentRole.Finalizer, description: "Package findings into an actionable recommendation.", deliverables: ["Executive brief", "Action options", "Next steps"], dependencies: [2, 3] },
      ],
      financial_planning: [
        { title: "Financial Baseline", agent: AgentRole.Finance, description: `Map current costs, revenue assumptions, and constraints for: ${focus}.`, deliverables: ["Baseline model", "Assumption list", "Constraint map"] },
        { title: "Scenario Modeling", agent: AgentRole.Finance, description: "Compare conservative, expected, and aggressive scenarios.", deliverables: ["Scenario table", "Sensitivity analysis", "Breakpoints"], dependencies: [1] },
        { title: "Risk & Governance Review", agent: AgentRole.RiskCritic, description: "Identify downside risk and controls.", deliverables: ["Risk register", "Controls", "Decision thresholds"], dependencies: [2] },
      ],
      content_strategy: [
        { title: "Audience & Message Research", agent: AgentRole.Researcher, description: `Clarify audience intent, channels, and message fit for: ${focus}.`, deliverables: ["Audience segments", "Message pillars", "Channel assumptions"] },
        { title: "Content System Design", agent: AgentRole.MarketingStrategist, description: "Design themes, formats, cadence, and distribution loop.", deliverables: ["Content calendar", "Format matrix", "Distribution plan"], dependencies: [1] },
        { title: "Performance & Risk Review", agent: AgentRole.RiskCritic, description: "Define quality controls, measurement, and brand risks.", deliverables: ["Measurement plan", "Risk notes", "Review checklist"], dependencies: [2] },
      ],
      operational_plan: [
        { title: "Operating Baseline", agent: AgentRole.Researcher, description: `Map current process, constraints, handoffs, and failure points for: ${focus}.`, deliverables: ["Process map", "Constraint list", "Stakeholder map"] },
        { title: "Execution System Design", agent: AgentRole.ProductStrategist, description: "Create workflow, ownership, cadence, and decision rules.", deliverables: ["Operating model", "Ownership map", "Cadence plan"], dependencies: [1] },
        { title: "Risk & Resource Review", agent: AgentRole.RiskCritic, description: "Stress-test capacity, quality, and change-management risk.", deliverables: ["Risk register", "Resource plan", "Control points"], dependencies: [2] },
      ],
      general_problem_solving: [
        { title: "Problem Framing", agent: AgentRole.Researcher, description: `Clarify root problem, constraints, stakeholders, and decision criteria for: ${focus}.`, deliverables: ["Problem frame", "Assumption list", "Decision criteria"] },
        { title: "Option Design", agent: AgentRole.ProductStrategist, description: "Generate options and evaluate tradeoffs.", deliverables: ["Option matrix", "Tradeoff notes", "Preferred path"], dependencies: [1] },
        { title: "Risk Review", agent: AgentRole.RiskCritic, description: "Challenge assumptions and define safeguards.", deliverables: ["Risk register", "Mitigation plan", "Decision guardrails"], dependencies: [2] },
      ],
    };

    return templates[classification.intent].map((template, index, list) => ({
      id: generateId(),
      title: template.title,
      owner: getAgentByRole(template.agent)?.name,
      responsibleAgent: getAgentByRole(template.agent)?.name,
      description: template.description,
      status: "pending" as const,
      assignedAgent: template.agent,
      confidence: Math.max(68, 86 - index * 3),
      dependencies: template.dependencies?.map((dependency) => list[dependency - 1]?.title).filter(Boolean) ?? [],
      deliverables: template.deliverables,
    })).map((workstream, _index, list) => ({
      ...workstream,
      dependencies: workstream.dependencies?.map((title) => list.find((candidate) => candidate.title === title)?.id).filter((id): id is string => Boolean(id)) ?? [],
    }));
  }

  private agentFromOwner(owner: string): AgentRole | null {
    const cleanedOwner = owner.toLowerCase();
    const match = AGENT_DEFINITIONS.find((agent) =>
      cleanedOwner.includes(agent.name.toLowerCase()) ||
      cleanedOwner.includes(agent.role.replace(/-/g, " ")) ||
      agent.capabilities.some((capability) => cleanedOwner.includes(capability.toLowerCase()))
    );
    return match?.role ?? null;
  }

  private classifyMission(brief: string): MissionClassification {
    const text = brief.toLowerCase();
    const has = (...terms: string[]) => terms.some((term) => text.includes(term));
    let intent: MissionIntent = "general_problem_solving";

    if (has("slow", "performance", "render", "re-render", "rerender", "latency", "bundle", "memory", "react app", "debug", "optimiz")) {
      intent = "technical_debugging";
    } else if (has("launch", "go-to-market", "gtm", "startup", "customers", "sales", "school", "schools", "market")) {
      intent = "business_launch";
    } else if (has("rebuild", "next.js", "nextjs", "react spa", "architecture", "technical", "stack", "migrate")) {
      intent = "product_strategy";
    } else if (has("research", "analyze", "study", "compare", "report")) {
      intent = "research_analysis";
    } else if (has("budget", "financial", "pricing", "runway", "cost", "revenue")) {
      intent = "financial_planning";
    } else if (has("content", "newsletter", "social", "campaign", "brand")) {
      intent = "content_strategy";
    } else if (has("operations", "process", "workflow", "team", "hiring", "execution plan")) {
      intent = "operational_plan";
    }

    const isLaunch = intent === "business_launch";
    const isTechnical = intent === "technical_debugging" || has("api", "backend", "frontend", "database", "code", "component");
    const needsMarketing = isLaunch || intent === "content_strategy" || has("marketing", "campaign", "positioning", "sales");
    const needsFinance = isLaunch || intent === "financial_planning" || has("budget", "cost", "pricing", "runway");
    const needsProduct = isLaunch || intent === "product_strategy" || has("product", "mvp", "feature", "user experience", "ux");

    const agents = new Set<AgentRole>([AgentRole.Planner]);
    if (intent === "technical_debugging") {
      agents.add(AgentRole.TechnicalArchitect);
      if (has("api", "backend", "data fetching", "network")) agents.add(AgentRole.RiskCritic);
      if (has("user", "ux", "interface", "experience")) agents.add(AgentRole.ProductStrategist);
    } else {
      agents.add(AgentRole.Researcher);
      if (needsProduct) agents.add(AgentRole.ProductStrategist);
      if (isTechnical) agents.add(AgentRole.TechnicalArchitect);
      if (needsMarketing) agents.add(AgentRole.MarketingStrategist);
      if (needsFinance) agents.add(AgentRole.Finance);
    }
    agents.add(AgentRole.RiskCritic);
    agents.add(AgentRole.Finalizer);

    return {
      intent,
      selectedAgents: Array.from(agents),
      needsMarketing,
      needsFinance,
      needsProduct,
      isLaunch,
      isTechnical,
    };
  }

  private agentForMissionWorkstream(classification: MissionClassification, title: string, index: number): AgentRole {
    const text = title.toLowerCase();
    if (classification.intent === "technical_debugging") {
      if (/(risk|regression|monitor|security|api|network|audit)/.test(text)) return AgentRole.RiskCritic;
      if (/(roadmap|priorit|final|plan)/.test(text)) return AgentRole.Finalizer;
      if (/(ux|user|experience)/.test(text)) return AgentRole.ProductStrategist;
      return AgentRole.TechnicalArchitect;
    }
    if (/(market|campaign|content|position|launch|gtm|sales)/.test(text)) return AgentRole.MarketingStrategist;
    if (/(budget|finance|cost|pricing|runway|resource)/.test(text)) return AgentRole.Finance;
    if (/(technical|architecture|api|backend|frontend|code|implementation)/.test(text)) return AgentRole.TechnicalArchitect;
    if (/(risk|governance|security|compliance|tradeoff)/.test(text)) return AgentRole.RiskCritic;
    if (/(product|scope|mvp|feature|user|experience|option)/.test(text)) return AgentRole.ProductStrategist;
    if (/(research|validation|evidence|analysis|baseline|discovery)/.test(text)) return AgentRole.Researcher;
    return classification.selectedAgents.filter((agent) => agent !== AgentRole.Planner && agent !== AgentRole.Finalizer)[index % Math.max(1, classification.selectedAgents.length - 2)] ?? AgentRole.Researcher;
  }

  private ensureRequiredWorkstreams(ctx: MissionContext, classification: MissionClassification) {
    const hasRisk = ctx.workstreams.some((workstream) => workstream.assignedAgent === AgentRole.RiskCritic);
    if (classification.selectedAgents.includes(AgentRole.RiskCritic) && !hasRisk) {
      ctx.workstreams = [...ctx.workstreams, {
        id: generateId(),
        title: classification.intent === "technical_debugging" ? "Regression, Risk & Monitoring Review" : "Risk Critic Review",
        owner: getAgentByRole(AgentRole.RiskCritic)?.name,
        responsibleAgent: getAgentByRole(AgentRole.RiskCritic)?.name,
        description: classification.intent === "technical_debugging"
          ? "Challenge the optimization plan for regressions, measurement blind spots, dependency risk, and premature refactors."
          : "Challenge the plan for tradeoffs, hidden assumptions, quality risks, and execution failure points.",
        status: "pending",
        assignedAgent: AgentRole.RiskCritic,
        deliverables: ["Risk register", "Tradeoff objections", "Mitigation checklist"],
        confidence: 76,
        dependencies: ctx.workstreams.map((workstream) => workstream.id),
      }];
    }
  }

  private createExecutionTasks(workstreams: Workstream[], classification: MissionClassification): ExecutionTask[] {
    const tasks = workstreams.map((workstream, index) => ({
      id: generateId(),
      workstreamId: workstream.id,
      title: workstream.title,
      agent: workstream.assignedAgent ?? this.agentForMissionWorkstream(classification, workstream.title, index),
      dependencies: [] as string[],
      status: "pending" as const,
      confidence: workstream.confidence ?? Math.max(68, 86 - index * 3),
    }));

    return tasks.map((task, index) => {
      const workstream = workstreams.find((item) => item.id === task.workstreamId);
      const explicitDependencies = workstream?.dependencies
        ?.map((dependencyId) => tasks.find((candidate) => candidate.workstreamId === dependencyId)?.id)
        .filter((dependencyId): dependencyId is string => Boolean(dependencyId)) ?? [];

      if (explicitDependencies.length) return { ...task, dependencies: explicitDependencies };
      if (task.agent === AgentRole.Researcher || index === 0) return task;

      const researchTask = tasks.find((candidate) => candidate.agent === AgentRole.Researcher);
      const productTask = tasks.find((candidate) => candidate.agent === AgentRole.ProductStrategist);

      if (task.agent === AgentRole.ProductStrategist) {
        return { ...task, dependencies: researchTask ? [researchTask.id] : [] };
      }
      if (task.agent === AgentRole.TechnicalArchitect || task.agent === AgentRole.MarketingStrategist) {
        return { ...task, dependencies: productTask ? [productTask.id] : researchTask ? [researchTask.id] : [] };
      }
      if (task.agent === AgentRole.RiskCritic) {
        return { ...task, dependencies: tasks.filter((candidate) => candidate.id !== task.id).map((candidate) => candidate.id) };
      }
      return { ...task, dependencies: researchTask ? [researchTask.id] : [] };
    });
  }

  private agentForWorkstreamIndex(index: number): AgentRole {
    return [AgentRole.Researcher, AgentRole.ProductStrategist, AgentRole.TechnicalArchitect, AgentRole.MarketingStrategist, AgentRole.Finance][index] ?? AgentRole.RiskCritic;
  }

  private phaseForAgent(agent: AgentRole): MissionState {
    const mapping: Record<AgentRole, MissionState> = {
      [AgentRole.Planner]: MissionState.Planning,
      [AgentRole.Researcher]: MissionState.Researching,
      [AgentRole.ProductStrategist]: MissionState.ProductStrategy,
      [AgentRole.TechnicalArchitect]: MissionState.TechnicalArchitecture,
      [AgentRole.MarketingStrategist]: MissionState.MarketingStrategy,
      [AgentRole.Finance]: MissionState.FinancialAnalysis,
      [AgentRole.RiskCritic]: MissionState.RiskReview,
      [AgentRole.Mediator]: MissionState.ConflictResolution,
      [AgentRole.Finalizer]: MissionState.Finalizing,
    };
    return mapping[agent];
  }

  private setAgentState(ctx: MissionContext, role: AgentRole, state: AgentThinkingState) {
    ctx.agentStates = { ...ctx.agentStates, [role]: state };
  }

  private updateTask(ctx: MissionContext, taskId: string, patch: Partial<ExecutionTask>) {
    ctx.executionTasks = ctx.executionTasks.map((task) => task.id === taskId ? { ...task, ...patch } : task);
  }

  private updateWorkstream(ctx: MissionContext, workstreamId: string, patch: Partial<Workstream>) {
    ctx.workstreams = ctx.workstreams.map((workstream) => workstream.id === workstreamId ? { ...workstream, ...patch } : workstream);
  }

  private averageConfidence(ctx: MissionContext) {
    const confidenceValues = ctx.workstreams.map((workstream) => workstream.confidence ?? 75);
    if (confidenceValues.length === 0) return 75;
    return Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length);
  }

  private evolveConfidence(current: number, output: string, ctx: MissionContext) {
    const depthBoost = ctx.configuration.depth === "deep-analysis" ? 4 : ctx.configuration.depth === "fast" ? -1 : 2;
    const evidenceBoost = Math.min(5, Math.floor(output.length / 900));
    const conflictPenalty = output.includes("CONFLICT_DETECTED") ? -4 : 0;
    return Math.max(50, Math.min(97, current + depthBoost + evidenceBoost + conflictPenalty));
  }

  private detectConflicts(ctx: MissionContext, classification: MissionClassification) {
    const conflicts: ConflictInfo[] = [];
    const allOutput = sanitizeMissionText([
      ctx.researchSummary,
      ctx.productStrategy,
      ctx.technicalArchitecture,
      ctx.marketingStrategy,
      ctx.financialPlan,
      ctx.riskReview,
    ].join("\n\n")).toLowerCase();

    if (classification.intent === "technical_debugging") {
      conflicts.push({
        id: generateId(),
        title: "Quick fixes vs deeper architecture correction",
        agents: this.agentNamesFromRoles([AgentRole.TechnicalArchitect, AgentRole.RiskCritic]),
        riskLevel: "high",
        description: "The optimization plan must choose between fast memoization-level fixes and deeper render/data-flow architecture work.",
        disagreementSummary: "Technical analysis favors deeper profiling and architecture review, while delivery pressure favors quick local optimizations.",
        resolved: false,
      });
      if (/api|network|latency|data fetching|backend/.test(ctx.missionBrief.toLowerCase() + allOutput)) {
        conflicts.push({
          id: generateId(),
          title: "Frontend-only optimization vs API latency investigation",
          agents: this.agentNamesFromRoles([AgentRole.TechnicalArchitect, AgentRole.RiskCritic]),
          riskLevel: "moderate",
          description: "The team must avoid blaming React rendering before separating frontend, network, and API latency.",
          disagreementSummary: "One path focuses on component rendering; the risk review requires network/API measurement before prioritizing fixes.",
          resolved: false,
        });
      }
    } else if (classification.isLaunch) {
      conflicts.push({
        id: generateId(),
        title: "Launch speed vs validated positioning",
        agents: this.agentNamesFromRoles([AgentRole.MarketingStrategist, AgentRole.ProductStrategist, AgentRole.Finance, AgentRole.RiskCritic]),
        riskLevel: "high",
        description: "The launch plan must balance fast market entry with validated customer, budget, and product assumptions.",
        disagreementSummary: "Marketing pressure favors speed, while product/finance/risk outputs require validation gates before scaling spend.",
        resolved: false,
      });
    } else if (/rebuild|migrate|next\.?js|architecture|keep react spa/.test(ctx.missionBrief.toLowerCase())) {
      conflicts.push({
        id: generateId(),
        title: "Rebuild complexity vs incremental improvement",
        agents: this.agentNamesFromRoles([AgentRole.TechnicalArchitect, AgentRole.ProductStrategist, AgentRole.RiskCritic]),
        riskLevel: "high",
        description: "The decision requires balancing technical debt reduction against migration cost, user disruption, and delivery speed.",
        disagreementSummary: "Architecture may favor Next.js capabilities, while product/risk concerns may favor preserving the SPA and improving selectively.",
        resolved: false,
      });
    }

    const confidenceValues = ctx.workstreams.map((workstream) => workstream.confidence ?? 70);
    if (confidenceValues.length > 1 && Math.max(...confidenceValues) - Math.min(...confidenceValues) >= 16) {
      conflicts.push({
        id: generateId(),
        title: "Confidence disagreement across workstreams",
        agents: Array.from(new Set(ctx.workstreams.map((workstream) => getAgentByRole(workstream.assignedAgent ?? AgentRole.Planner)?.name ?? "Unknown Agent"))),
        riskLevel: "moderate",
        description: "Some workstreams are materially less certain than others and should not be treated as equally ready.",
        disagreementSummary: "Higher-confidence outputs can proceed, while lower-confidence outputs need validation or narrower scope.",
        resolved: false,
      });
    }

    if (/CONFLICT_DETECTED:\s*true/i.test(ctx.riskReview) && conflicts.length === 0) {
      conflicts.push({
        id: generateId(),
        title: "Risk Critic objection",
        agents: this.agentNamesFromRoles([AgentRole.RiskCritic]),
        riskLevel: "moderate",
        description: "Risk Critic flagged a material objection that requires mediation.",
        disagreementSummary: sanitizeMissionText(ctx.riskReview).slice(0, 500),
        resolved: false,
      });
    }

    ctx.conflicts = conflicts;
  }

  private resolveConflictAction(conflict: ConflictInfo, classification: MissionClassification) {
    if (classification.intent === "technical_debugging") {
      return conflict.title?.includes("API")
        ? "Measure frontend render time and network/API latency separately before prioritizing fixes."
        : "Start with profiling-backed quick wins, then schedule architecture refactors only for proven hot paths.";
    }
    if (classification.isLaunch) {
      return "Use validation gates before scaling launch spend; sequence positioning, budget, and risk checks before campaign expansion.";
    }
    if (classification.intent === "product_strategy") {
      return "Compare options with a decision matrix, then choose the path with the best risk-adjusted delivery outcome.";
    }
    return "Proceed with the highest-confidence path while adding validation checks for lower-confidence assumptions.";
  }

  private agentNamesFromRoles(roles: AgentRole[]) {
    return roles.map((role) => getAgentByRole(role)?.name ?? role);
  }

  private generateEfficiencyMetrics(ctx: MissionContext, hadConflicts: boolean): EfficiencyMetrics {
    const totalWorkstreams = Math.max(1, ctx.workstreams.length);
    const completedWorkstreams = ctx.workstreams.filter((workstream) => workstream.status === "completed").length;
    const taskCoverage = Math.round((completedWorkstreams / totalWorkstreams) * 100);
    const participatingAgents = new Set(ctx.dialogue.map((entry) => entry.agentRole));
    const confidenceValues = ctx.workstreams.map((workstream) => workstream.confidence ?? 70);
    const confidence = Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / Math.max(1, confidenceValues.length));
    const resolved = ctx.conflicts.filter((conflict) => conflict.resolved).length;
    const conflictResolutionScore = ctx.conflicts.length === 0 ? 100 : Math.round((resolved / ctx.conflicts.length) * 100);
    const outputCompleteness = Math.min(100, Math.round((ctx.dialogue.reduce((sum, entry) => sum + sanitizeMissionText(entry.content).length, 0) / Math.max(1, totalWorkstreams)) / 20));
    const qualityScore = Math.round((taskCoverage * 0.32) + (confidence * 0.34) + (conflictResolutionScore * 0.18) + (outputCompleteness * 0.16));
    return {
      taskCoverage,
      qualityScore: Math.max(45, Math.min(98, qualityScore)),
      conflictsResolved: resolved,
      estimatedCompletionTime: ctx.configuration.depth === "deep-analysis" ? "6-8 focused hours" : ctx.configuration.depth === "fast" ? "90-120 minutes" : "3-4 focused hours",
      perspectivesConsidered: participatingAgents.size,
      revisionCount: ctx.conflicts.length + ctx.executionTasks.filter((task) => task.confidence < 75).length + (hadConflicts ? 1 : 0),
      finalConfidenceScore: confidence,
      singleAgentBaseline: Math.max(42, Math.min(72, confidence - 18 + Math.round(participatingAgents.size / 2))),
    };
  }

  private generateReport(ctx: MissionContext): MissionReport {
    const classification = this.classifyMission(ctx.missionBrief);
    const metrics = ctx.efficiencyMetrics ?? this.generateEfficiencyMetrics(ctx, ctx.conflicts.length > 0);
    const workstreamLines = ctx.workstreams.map((workstream) =>
      `- ${sanitizeMissionText(workstream.title)} (${getAgentByRole(workstream.assignedAgent ?? AgentRole.Planner)?.name ?? workstream.owner ?? "Owner pending"}, ${workstream.confidence ?? 80}% confidence): ${sanitizeMissionText(workstream.description)}`
    ).join("\n");
    const contributionLines = ctx.dialogue.map((entry) => `- ${entry.agentName}: ${sanitizeMissionText(entry.content).split("\n").find(Boolean)?.replace(/^#+\s*/, "") ?? "Contribution captured."}`).join("\n");
    return {
      executiveSummary: `Agent Society analyzed "${ctx.missionBrief}" as a ${MISSION_TYPE_LABELS[ctx.configuration.missionType]} mission using ${DEPTH_LABELS[ctx.configuration.depth]} depth. The agents completed ${ctx.workstreams.length} workstreams, resolved ${metrics.conflictsResolved} conflict, and produced a ${OUTPUT_FORMAT_LABELS[ctx.configuration.outputFormat]} aligned to a ${TIME_HORIZON_LABELS[ctx.configuration.timeHorizon]} horizon.`,
      missionObjective: ctx.missionBrief,
      selectedMissionConfiguration: configSummary(ctx.configuration),
      workstreams: workstreamLines,
      roleAssignments: ctx.workstreams.map((workstream) => `${workstream.title}: ${getAgentByRole(workstream.assignedAgent ?? AgentRole.Planner)?.name ?? "Unassigned"}`).join("\n"),
      agentContributions: contributionLines,
      keyDisagreements: ctx.conflicts.map((conflict) => `${conflict.title}: ${conflict.disagreementSummary}`).join("\n") || "No material disagreement was detected.",
      mediatorDecisions: ctx.mediatorDecisions || "No mediator decision was required.",
      executionRoadmap: this.generateExecutionRoadmap(ctx, classification),
      timeline: ctx.timeline.map((entry) => `- ${entry.label}: ${entry.description ?? entry.state}`).join("\n"),
      budgetEstimate: this.generateResourceEstimate(ctx, classification),
      riskAssessment: ctx.riskReview || "Risk review was not completed.",
      successMetrics: `Task coverage: ${metrics.taskCoverage}%. Confidence score: ${metrics.finalConfidenceScore}%. Perspectives considered: ${metrics.perspectivesConsidered}.`,
      finalRecommendations: this.generateFinalRecommendations(ctx, classification),
      singleAgentComparison: `Single-agent baseline: ${metrics.singleAgentBaseline}%. Agent Society quality score: ${metrics.qualityScore}%. The multi-agent workflow improves coverage by separating planning, research, architecture, marketing, finance, risk criticism, mediation, and final synthesis.`,
    };
  }

  private generateExecutionRoadmap(ctx: MissionContext, classification: MissionClassification) {
    const lines = ctx.workstreams.map((workstream, index) => `${index + 1}. ${sanitizeMissionText(workstream.nextStep || workstream.title)} - ${sanitizeMissionText(workstream.deliverables[0] ?? workstream.description)}`);
    if (classification.intent === "technical_debugging") {
      return [
        "1. Establish performance baselines before changing code.",
        ...ctx.workstreams.map((workstream, index) => `${index + 2}. ${sanitizeMissionText(workstream.title)}: ${sanitizeMissionText(workstream.nextStep || workstream.description)}`),
        `${ctx.workstreams.length + 2}. Validate improvements with regression tests and monitoring.`,
      ].join("\n");
    }
    return lines.join("\n");
  }

  private generateResourceEstimate(ctx: MissionContext, classification: MissionClassification) {
    if (classification.intent === "technical_debugging") {
      return `Resource posture: ${BUDGET_RANGE_LABELS[ctx.configuration.budgetRange]}. Prioritize profiling, render tracing, network timing, and regression validation before broad refactors.`;
    }
    if (classification.isLaunch || classification.needsFinance) {
      return `Budget posture: ${BUDGET_RANGE_LABELS[ctx.configuration.budgetRange]}. Finance-related workstreams should govern spend, staffing, and timeline tradeoffs.`;
    }
    return `Resource posture: ${BUDGET_RANGE_LABELS[ctx.configuration.budgetRange]}. Allocate effort according to workstream confidence and unresolved risks.`;
  }

  private generateFinalRecommendations(ctx: MissionContext, classification: MissionClassification) {
    const topWorkstreams = ctx.workstreams.slice(0, 3).map((workstream) => sanitizeMissionText(workstream.title)).join(", ");
    if (classification.intent === "technical_debugging") {
      return `Start with measurement, then fix the highest-impact bottlenecks found in ${topWorkstreams}. Avoid cosmetic memoization until profiling proves it matters. Validate every optimization with before/after metrics and regression monitoring.`;
    }
    if (classification.isLaunch) {
      return `Proceed through validation, positioning, campaign execution, and risk gates. Use ${topWorkstreams} as the launch backbone and do not scale spend until the validation workstream is complete.`;
    }
    if (classification.intent === "product_strategy") {
      return `Use the workstream outputs to compare options against user impact, implementation cost, and risk. Make the decision only after the mediator resolves the highest-impact tradeoff.`;
    }
    return `Proceed with the highest-confidence workstreams first: ${topWorkstreams}. Revisit lower-confidence areas before committing irreversible resources.`;
  }

  private timelineDescription(phase: MissionState) {
    const descriptions: Partial<Record<MissionState, string>> = {
      [MissionState.Planning]: "Planner decomposes the brief into owned workstreams.",
      [MissionState.Researching]: "Research Agent validates assumptions and gathers strategic context.",
      [MissionState.ProductStrategy]: "Product Strategist turns research into scope and success metrics.",
      [MissionState.TechnicalArchitecture]: "Technical Architect maps implementation constraints and delivery sequence.",
      [MissionState.MarketingStrategy]: "Marketing Strategist shapes launch positioning and activation channels.",
      [MissionState.FinancialAnalysis]: "Finance Agent checks budget, runway, and resource constraints.",
      [MissionState.RiskReview]: "Risk Critic challenges assumptions and flags disagreement.",
      [MissionState.ConflictResolution]: "Mediator arbitrates the disagreement and sets a final action.",
      [MissionState.Finalizing]: "Finalizer synthesizes the complete report.",
    };
    return descriptions[phase] ?? "Agent phase started.";
  }

  private completionDescription(phase: MissionState) {
    const descriptions: Partial<Record<MissionState, string>> = {
      [MissionState.Planning]: "Mission decomposed into workstreams and owners.",
      [MissionState.Researching]: "Research context added to the mission state.",
      [MissionState.ProductStrategy]: "Product strategy and success metrics captured.",
      [MissionState.TechnicalArchitecture]: "Technical plan and constraints documented.",
      [MissionState.MarketingStrategy]: "Go-to-market direction captured.",
      [MissionState.FinancialAnalysis]: "Budget and resource posture captured.",
      [MissionState.RiskReview]: "Risk review completed and conflict flagged.",
      [MissionState.ConflictResolution]: "Mediator resolved the core disagreement.",
      [MissionState.Finalizing]: "Final synthesis prepared for report generation.",
    };
    return descriptions[phase] ?? "Agent phase completed.";
  }

  private timelineKind(phase: MissionState): TimelineEntry["kind"] {
    if (phase === MissionState.ConflictResolution || phase === MissionState.RiskReview) return "conflict";
    if (phase === MissionState.Finalizing) return "report";
    if (phase === MissionState.Planning) return "workstream";
    return "agent";
  }
}
