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
  type MissionReport,
  type TimelineEntry,
  type Workstream,
} from "@/types";
import { AGENT_DEFINITIONS, getAgentByRole } from "@/agents";
import { createQwenClient, isMockMode } from "@/services/qwen";
import { useRuntimeSettingsStore } from "@/store/runtime-settings-store";
import { generateId } from "@/utils";
import { MockAgentRunner } from "./mock-agent-runner";
import type { EventListener } from "./types";

const PROGRESS_PER_PHASE = 1 / 9;

function now() {
  return new Date().toISOString();
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
    };
    const signal = this.abortController.signal;
    const mockMode = isMockMode();
    const qwenClient = mockMode ? null : createQwenClient();
    this.contextRef = ctx;

    try {
      ctx.status = MissionState.Preparing;
      ctx.startedAt = now();
      this.addTimeline(ctx, AgentRole.Planner, MissionState.Preparing, "Mission started", "Mission Control accepted the brief and initialized the agent sequence.", "system");
      this.emit({ type: MissionEventType.MissionStarted, timestamp: now(), payload: {} });
      onUpdate({ ...ctx });
      await this.delay(700, signal);

      await this.runAgentPhase(ctx, MissionState.Planning, mockMode, qwenClient, signal, onUpdate);
      ctx.executionTasks = this.createExecutionTasks(ctx.workstreams);
      this.addTimeline(ctx, AgentRole.Planner, MissionState.Planning, "Execution tasks created", `${ctx.executionTasks.length} tasks created from Planner output. Independent tasks will run in parallel when dependencies allow.`, "workstream");
      ctx.progress = 0.16;
      this.emit({ type: MissionEventType.MissionProgress, timestamp: now(), payload: { progress: ctx.progress } });
      onUpdate({ ...ctx });

      await this.runExecutionTasks(ctx, mockMode, qwenClient, signal, onUpdate);
      ctx.progress = 0.78;
      this.emit({ type: MissionEventType.MissionProgress, timestamp: now(), payload: { progress: ctx.progress } });
      onUpdate({ ...ctx });

      const shouldMediate = mockMode || ctx.riskReview.includes("CONFLICT_DETECTED: true");
      if (shouldMediate) {
        this.createConflict(ctx);
        this.emit({ type: MissionEventType.ConflictDetected, timestamp: now(), payload: {} });
        onUpdate({ ...ctx });
        await this.runAgentPhase(ctx, MissionState.ConflictResolution, mockMode, qwenClient, signal, onUpdate);
        ctx.conflicts = ctx.conflicts.map((conflict) => ({
          ...conflict,
          resolved: true,
          mediatorDecision: ctx.mediatorDecisions,
          resolution: ctx.mediatorDecisions,
          finalAction: "Keep the Mission Control MVP frontend-only, improve workflow credibility, and defer backend/database expansion.",
        }));
        this.emit({ type: MissionEventType.ConflictResolved, timestamp: now(), payload: {} });
        ctx.progress = 0.88;
        onUpdate({ ...ctx });
      }

      await this.runAgentPhase(ctx, MissionState.Finalizing, mockMode, qwenClient, signal, onUpdate);
      ctx.efficiencyMetrics = this.generateEfficiencyMetrics(ctx, shouldMediate);
      ctx.finalReport = this.generateReport(ctx);
      ctx.workstreams = ctx.workstreams.map((workstream) => ({ ...workstream, status: "completed" }));
      ctx.status = MissionState.Completed;
      ctx.progress = 1;
      ctx.currentAgent = null;
      ctx.completedAt = now();
      this.addTimeline(ctx, AgentRole.Finalizer, MissionState.Completed, "Mission completed", "Final report generated from configuration, workstreams, dialogue, conflict resolution, and efficiency metrics.", "report");
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
    onUpdate: (ctx: MissionContext) => void
  ) {
    if (signal.aborted) throw new DOMException("Mission cancelled", "AbortError");

    const agentRole = STATE_AGENT_MAP[phase];
    if (!agentRole) return;
    const agentDef = getAgentByRole(agentRole);
    if (!agentDef) return;

    ctx.status = phase;
    ctx.currentAgent = agentRole;
    this.setAgentState(ctx, agentRole, "thinking");
    this.addTimeline(ctx, agentRole, phase, `${agentDef.name} activated`, this.timelineDescription(phase), "agent");
    this.emit({ type: MissionEventType.AgentStarted, timestamp: now(), payload: { agentRole, agentName: agentDef.name, phase } });
    this.emit({ type: MissionEventType.AgentThinking, timestamp: now(), payload: { agentRole, agentName: agentDef.name } });
    onUpdate({ ...ctx });

    const phaseStart = Date.now();
    let result: string;

    if (mockMode) {
      await this.delay(Math.floor(this.mockRunner.getDelay(phase) * 0.35), signal);
      this.setAgentState(ctx, agentRole, "analyzing");
      onUpdate({ ...ctx });
      await this.delay(Math.floor(this.mockRunner.getDelay(phase) * 0.25), signal);
      this.setAgentState(ctx, agentRole, "reviewing");
      onUpdate({ ...ctx });
      await this.delay(this.mockRunner.getDelay(phase), signal);
      result = this.mockRunner.generate(phase, ctx);
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
        result = `## Qwen Fallback Activated\n\nQwen request failed for ${agentDef.name}, so Agent Society used the local mock runner because mock fallback is enabled in Settings.\n\n${this.mockRunner.generate(phase, ctx)}`;
      }
      if (signal.aborted) throw new DOMException("Mission cancelled", "AbortError");
    } else {
      result = "No client available.";
    }

    this.storePhaseResult(ctx, phase, result);
    this.setAgentState(ctx, agentRole, "complete");
    this.addDialogue(ctx, agentDef.id, agentDef.name, agentDef.role, result, phase === MissionState.ConflictResolution, {
      phase,
      status: "complete",
      confidence: this.averageConfidence(ctx),
    });
    this.addTimeline(ctx, agentDef.role, phase, `${agentDef.name} completed`, this.completionDescription(phase), this.timelineKind(phase), Date.now() - phaseStart);
    this.emit({ type: MissionEventType.AgentFinished, timestamp: now(), payload: { agentRole, agentName: agentDef.name, phase } });
    onUpdate({ ...ctx });
  }

  private async runExecutionTasks(
    ctx: MissionContext,
    mockMode: boolean,
    qwenClient: ReturnType<typeof createQwenClient> | null,
    signal: AbortSignal,
    onUpdate: (ctx: MissionContext) => void
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

      await Promise.all(readyTasks.map((task) => this.runExecutionTask(ctx, task, mockMode, qwenClient, signal, onUpdate)));

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
    onUpdate: (ctx: MissionContext) => void
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
    this.emit({ type: MissionEventType.AgentStarted, timestamp: now(), payload: { agentRole: task.agent, agentName: agentDef.name, phase, taskId: task.id } });
    this.emit({ type: MissionEventType.AgentThinking, timestamp: now(), payload: { agentRole: task.agent, agentName: agentDef.name, taskId: task.id } });
    onUpdate({ ...ctx });

    let result: string;
    if (mockMode) {
      const delay = this.mockRunner.getDelay(phase);
      await this.delay(Math.floor(delay * 0.35), signal);
      this.setAgentState(ctx, task.agent, "analyzing");
      onUpdate({ ...ctx });
      await this.delay(Math.floor(delay * 0.35), signal);
      this.setAgentState(ctx, task.agent, "reviewing");
      onUpdate({ ...ctx });
      await this.delay(Math.floor(delay * 0.3), signal);
      result = this.mockRunner.generate(phase, ctx, task);
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
        result = `## Qwen Fallback Activated\n\nQwen request failed for ${agentDef.name}, so Agent Society used the local mock runner because mock fallback is enabled in Settings.\n\n${this.mockRunner.generate(phase, ctx, task)}`;
      }
      this.setAgentState(ctx, task.agent, "reviewing");
      onUpdate({ ...ctx });
    } else {
      result = "No client available.";
    }

    const nextConfidence = this.evolveConfidence(task.confidence, result, ctx);
    this.storePhaseResult(ctx, phase, result);
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

  private storePhaseResult(ctx: MissionContext, phase: MissionState, result: string) {
    switch (phase) {
      case MissionState.Planning:
        ctx.workstreams = this.parseWorkstreams(result);
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

  private parseWorkstreams(text: string): Workstream[] {
    const sections = text.split(/\*\*Workstream \d+:/).slice(1);
    if (sections.length === 0) {
      return this.defaultWorkstreams();
    }

    return sections.slice(0, 5).map((section, index) => {
      const [rawTitle, ...rest] = section.split("**");
      const body = rest.join("**");
      const ownerLabel = body.match(/Owner:\s*([^\n]+)/)?.[1]?.trim() ?? "";
      const confidence = Number(body.match(/Confidence:\s*(\d+)/)?.[1] ?? 78);
      const description = body.match(/Description:\s*([^\n]+)/)?.[1]?.trim() ?? body.slice(0, 160);
      const deliverables = body.match(/Deliverables:\s*([^\n]+)/)?.[1]?.split(";").map((item) => item.trim()).filter(Boolean) ?? [];
      const dependencyIndexes = body.match(/Dependencies:\s*([^\n]+)/)?.[1]
        ?.split(/[;,]/)
        .map((item) => Number(item.match(/\d+/)?.[0]))
        .filter((item) => Number.isFinite(item) && item > 0) ?? [];
      return {
        id: generateId(),
        title: rawTitle.trim() || `Workstream ${index + 1}`,
        description,
        status: "pending" as const,
        assignedAgent: this.agentFromOwner(ownerLabel),
        confidence,
        dependencies: dependencyIndexes.map((dependencyIndex) => `workstream-${dependencyIndex}`),
        deliverables,
      };
    }).map((workstream, _index, workstreams) => ({
      ...workstream,
      dependencies: workstream.dependencies?.map((dependencyKey) => {
        const dependencyIndex = Number(dependencyKey.replace("workstream-", "")) - 1;
        return workstreams[dependencyIndex]?.id;
      }).filter((id): id is string => Boolean(id)) ?? [],
    }));
  }

  private defaultWorkstreams(): Workstream[] {
    const owners = [AgentRole.Researcher, AgentRole.ProductStrategist, AgentRole.TechnicalArchitect, AgentRole.MarketingStrategist, AgentRole.Finance];
    return owners.map((owner, index) => ({
      id: generateId(),
      title: ["Strategic Discovery", "Solution Definition", "Technical Execution", "Market Activation", "Risk & Budget Governance"][index],
      description: "Generated workstream derived from the mission brief and selected configuration.",
      status: "pending",
      assignedAgent: owner,
      confidence: 80 - index,
      dependencies: index === 0 ? [] : [],
      deliverables: ["Decision brief", "Execution checklist", "Quality gate"],
    }));
  }

  private agentFromOwner(owner: string): AgentRole | null {
    const match = AGENT_DEFINITIONS.find((agent) => owner.toLowerCase().includes(agent.name.toLowerCase().replace(" agent", "")));
    return match?.role ?? null;
  }

  private createExecutionTasks(workstreams: Workstream[]): ExecutionTask[] {
    const tasks = workstreams.map((workstream, index) => ({
      id: generateId(),
      workstreamId: workstream.id,
      title: workstream.title,
      agent: workstream.assignedAgent ?? this.agentForWorkstreamIndex(index),
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

  private createConflict(ctx: MissionContext) {
    if (ctx.conflicts.length > 0) return;
    const conflict: ConflictInfo = {
      id: generateId(),
      title: "Scope, speed, and budget tension",
      agents: ["Technical Architect", "Marketing Strategist", "Finance Agent", "Risk Critic"],
      riskLevel: "high",
      description: "Technical feasibility, launch urgency, and budget constraints are pulling the mission plan in different directions.",
      disagreementSummary: "Technical Architect says MVP timeline is too aggressive; Marketing Strategist wants a faster launch; Finance Agent says budget is constrained; Risk Critic flags quality risk.",
      mediatorDecision: "",
      finalAction: "",
      resolved: false,
    };
    ctx.conflicts = [conflict];
  }

  private generateEfficiencyMetrics(ctx: MissionContext, hadConflicts: boolean): EfficiencyMetrics {
    const depthBoost = ctx.configuration.depth === "deep-analysis" ? 8 : ctx.configuration.depth === "fast" ? -4 : 2;
    const riskBoost = ctx.configuration.riskTolerance === "conservative" ? 5 : ctx.configuration.riskTolerance === "aggressive" ? -2 : 2;
    const coverage = Math.min(98, 84 + depthBoost + (ctx.workstreams.length >= 5 ? 4 : 0));
    const confidence = Math.min(96, 74 + depthBoost + riskBoost + (hadConflicts ? 5 : 0));
    return {
      taskCoverage: coverage,
      qualityScore: Math.min(97, confidence + 3),
      conflictsResolved: ctx.conflicts.filter((conflict) => conflict.resolved).length,
      estimatedCompletionTime: ctx.configuration.depth === "deep-analysis" ? "6-8 focused hours" : ctx.configuration.depth === "fast" ? "90-120 minutes" : "3-4 focused hours",
      perspectivesConsidered: 9,
      revisionCount: hadConflicts ? 3 : 1,
      finalConfidenceScore: confidence,
      singleAgentBaseline: ctx.configuration.depth === "deep-analysis" ? 58 : 55,
    };
  }

  private generateReport(ctx: MissionContext): MissionReport {
    const metrics = ctx.efficiencyMetrics ?? this.generateEfficiencyMetrics(ctx, ctx.conflicts.length > 0);
    const workstreamLines = ctx.workstreams.map((workstream) =>
      `- ${workstream.title} (${getAgentByRole(workstream.assignedAgent ?? AgentRole.Planner)?.name ?? "Unassigned"}, ${workstream.confidence ?? 80}% confidence): ${workstream.description}`
    ).join("\n");
    const contributionLines = ctx.dialogue.map((entry) => `- ${entry.agentName}: ${entry.content.split("\n").find(Boolean)?.replace(/^#+\s*/, "") ?? "Contribution captured."}`).join("\n");
    return {
      executiveSummary: `Agent Society analyzed "${ctx.missionBrief}" as a ${MISSION_TYPE_LABELS[ctx.configuration.missionType]} mission using ${DEPTH_LABELS[ctx.configuration.depth]} depth. The agents completed ${ctx.workstreams.length} workstreams, resolved ${metrics.conflictsResolved} conflict, and produced a ${OUTPUT_FORMAT_LABELS[ctx.configuration.outputFormat]} aligned to a ${TIME_HORIZON_LABELS[ctx.configuration.timeHorizon]} horizon.`,
      missionObjective: ctx.missionBrief,
      selectedMissionConfiguration: configSummary(ctx.configuration),
      workstreams: workstreamLines,
      roleAssignments: ctx.workstreams.map((workstream) => `${workstream.title}: ${getAgentByRole(workstream.assignedAgent ?? AgentRole.Planner)?.name ?? "Unassigned"}`).join("\n"),
      agentContributions: contributionLines,
      keyDisagreements: ctx.conflicts.map((conflict) => `${conflict.title}: ${conflict.disagreementSummary}`).join("\n") || "No material disagreement was detected.",
      mediatorDecisions: ctx.mediatorDecisions || "No mediator decision was required.",
      executionRoadmap: `1. Validate assumptions and success criteria.\n2. Complete the highest-confidence workstreams first.\n3. Resolve timeline, budget, and scope tension before launch.\n4. Package the output as a ${OUTPUT_FORMAT_LABELS[ctx.configuration.outputFormat]}.\n5. Review against ${RISK_TOLERANCE_LABELS[ctx.configuration.riskTolerance]} risk tolerance before execution.`,
      timeline: ctx.timeline.map((entry) => `- ${entry.label}: ${entry.description ?? entry.state}`).join("\n"),
      budgetEstimate: `Budget posture: ${BUDGET_RANGE_LABELS[ctx.configuration.budgetRange]}. Keep spend focused on the current frontend-only Mission Control workflow until user value is validated.`,
      riskAssessment: ctx.riskReview || "Risk review was not completed.",
      successMetrics: `Task coverage: ${metrics.taskCoverage}%. Confidence score: ${metrics.finalConfidenceScore}%. Perspectives considered: ${metrics.perspectivesConsidered}.`,
      finalRecommendations: `Proceed with the existing frontend-only architecture. Use the selected ${DEPTH_LABELS[ctx.configuration.depth]} depth to guide detail, keep the ${TIME_HORIZON_LABELS[ctx.configuration.timeHorizon]} roadmap visible, and treat conflict resolution as a quality signal.`,
      singleAgentComparison: `Single-agent baseline: ${metrics.singleAgentBaseline}%. Agent Society quality score: ${metrics.qualityScore}%. The multi-agent workflow improves coverage by separating planning, research, architecture, marketing, finance, risk criticism, mediation, and final synthesis.`,
    };
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
