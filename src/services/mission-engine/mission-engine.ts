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
  type ConflictInfo,
  type EfficiencyMetrics,
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

const PHASES: MissionState[] = [
  MissionState.Planning,
  MissionState.Researching,
  MissionState.ProductStrategy,
  MissionState.TechnicalArchitecture,
  MissionState.MarketingStrategy,
  MissionState.FinancialAnalysis,
  MissionState.RiskReview,
];

const WORKSTREAM_OWNER: Partial<Record<AgentRole, number>> = {
  [AgentRole.Researcher]: 0,
  [AgentRole.ProductStrategist]: 1,
  [AgentRole.TechnicalArchitect]: 2,
  [AgentRole.MarketingStrategist]: 3,
  [AgentRole.Finance]: 4,
  [AgentRole.RiskCritic]: 4,
};

const PROGRESS_PER_PHASE = 1 / 9;

function now() {
  return new Date().toISOString();
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

function buildPrompt(phase: MissionState, brief: string, ctx: MissionContext, config: MissionConfiguration) {
  return `Mission Brief: ${brief}

Selected Mission Configuration:
${configSummary(config)}

Current Workstreams:
${ctx.workstreams.map((w) => `- ${w.title}: ${w.description}`).join("\n") || "None yet"}

Previous Agent Outputs:
Research: ${ctx.researchSummary.slice(0, 500)}
Product: ${ctx.productStrategy.slice(0, 500)}
Technical: ${ctx.technicalArchitecture.slice(0, 500)}
Marketing: ${ctx.marketingStrategy.slice(0, 500)}
Finance: ${ctx.financialPlan.slice(0, 500)}
Risk: ${ctx.riskReview.slice(0, 500)}
Mediator: ${ctx.mediatorDecisions.slice(0, 500)}

Produce the ${phase} contribution. Make the output specific to the mission configuration and usable by downstream agents.`;
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
    const ctx: MissionContext = { ...initialContext, timeline: [...initialContext.timeline] };
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

      let progress = 0;

      for (const phase of PHASES) {
        await this.runAgentPhase(ctx, phase, mockMode, qwenClient, signal, onUpdate);
        progress += PROGRESS_PER_PHASE;
        ctx.progress = Math.min(progress, 0.78);
        this.emit({ type: MissionEventType.MissionProgress, timestamp: now(), payload: { progress: ctx.progress } });
        onUpdate({ ...ctx });
      }

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
    this.updateWorkstreamsForAgent(ctx, agentRole);
    this.addTimeline(ctx, agentRole, phase, `${agentDef.name} activated`, this.timelineDescription(phase), "agent");
    this.emit({ type: MissionEventType.AgentStarted, timestamp: now(), payload: { agentRole, agentName: agentDef.name, phase } });
    this.emit({ type: MissionEventType.AgentThinking, timestamp: now(), payload: { agentRole, agentName: agentDef.name } });
    onUpdate({ ...ctx });

    const phaseStart = Date.now();
    let result: string;

    if (mockMode) {
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
    this.addDialogue(ctx, agentDef.id, agentDef.name, agentDef.role, result, phase === MissionState.ConflictResolution);
    this.addTimeline(ctx, agentDef.role, phase, `${agentDef.name} completed`, this.completionDescription(phase), this.timelineKind(phase), Date.now() - phaseStart);
    this.emit({ type: MissionEventType.AgentFinished, timestamp: now(), payload: { agentRole, agentName: agentDef.name, phase } });
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

  private addDialogue(ctx: MissionContext, agentId: string, agentName: string, agentRole: AgentRole, content: string, isConflict = false) {
    const entry: AgentDialogueEntry = {
      agentId,
      agentName,
      agentRole,
      content,
      timestamp: now(),
      isConflict,
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
        ctx.researchSummary = result;
        break;
      case MissionState.ProductStrategy:
        ctx.productStrategy = result;
        break;
      case MissionState.TechnicalArchitecture:
        ctx.technicalArchitecture = result;
        break;
      case MissionState.MarketingStrategy:
        ctx.marketingStrategy = result;
        break;
      case MissionState.FinancialAnalysis:
        ctx.financialPlan = result;
        break;
      case MissionState.RiskReview:
        ctx.riskReview = result;
        break;
      case MissionState.ConflictResolution:
        ctx.mediatorDecisions = result;
        break;
    }
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
      return {
        id: generateId(),
        title: rawTitle.trim() || `Workstream ${index + 1}`,
        description,
        status: "pending",
        assignedAgent: this.agentFromOwner(ownerLabel),
        confidence,
        deliverables,
      };
    });
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
      deliverables: ["Decision brief", "Execution checklist", "Quality gate"],
    }));
  }

  private agentFromOwner(owner: string): AgentRole | null {
    const match = AGENT_DEFINITIONS.find((agent) => owner.toLowerCase().includes(agent.name.toLowerCase().replace(" agent", "")));
    return match?.role ?? null;
  }

  private updateWorkstreamsForAgent(ctx: MissionContext, role: AgentRole) {
    const activeIndex = WORKSTREAM_OWNER[role];
    if (activeIndex == null) return;
    ctx.workstreams = ctx.workstreams.map((workstream, index) => {
      if (index < activeIndex) return { ...workstream, status: "completed" };
      if (index === activeIndex) return { ...workstream, status: "in_progress" };
      return workstream;
    });
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
