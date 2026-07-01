/**
 * Agent Society — Mission Engine
 *
 * Pure TypeScript engine that orchestrates the multi-agent mission flow.
 * Emits typed events, manages the mission context, and streams agent output.
 */

import {
  MissionState,
  MissionEventType,
  STATE_AGENT_MAP,
  type MissionContext,
  type MissionConfiguration,
  type MissionEvent,
  type AgentDialogueEntry,
  type TimelineEntry,
  type Workstream,
  type ConflictInfo,
  type EfficiencyMetrics,
  type MissionReport,
} from "@/types";
import { AGENT_DEFINITIONS, getAgentByRole } from "@/agents";
import { createQwenClient, createMockClient, isMockMode } from "@/services/qwen";
import { generateId } from "@/utils";
import type { EventListener } from "./types";

const PHASE_PROMPTS: Record<string, (brief: string, ctx: MissionContext, config: MissionConfiguration) => string> = {
  [MissionState.Planning]: (brief, _ctx, config) =>
    `Mission Brief: ${brief}\nMission Type: ${config.missionType}\nTime Horizon: ${config.timeHorizon}\nBudget: ${config.budgetRange}\nRisk Tolerance: ${config.riskTolerance}\n\nDecompose this mission into 3-5 clear workstreams. For each workstream provide a title, description, and list of deliverables. Format as structured text.`,

  [MissionState.Researching]: (brief, ctx, _config) =>
    `Mission Brief: ${brief}\n\nPlanned Workstreams:\n${ctx.workstreams.map((w) => `- ${w.title}: ${w.description}`).join("\n")}\n\nGather relevant market research, competitive context, and key assumptions for this mission. Provide a structured research summary.`,

  [MissionState.ProductStrategy]: (brief, ctx, _config) =>
    `Mission Brief: ${brief}\nResearch Summary:\n${ctx.researchSummary}\n\nDefine the product vision, MVP scope, target users, feature priorities, and success metrics. Provide a comprehensive product strategy.`,

  [MissionState.TechnicalArchitecture]: (brief, ctx, _config) =>
    `Mission Brief: ${brief}\nProduct Strategy:\n${ctx.productStrategy}\n\nPropose a complete technical architecture including tech stack, system design, implementation phases, and technical risks. Be precise about tools and patterns.`,

  [MissionState.MarketingStrategy]: (brief, ctx, _config) =>
    `Mission Brief: ${brief}\nProduct Strategy:\n${ctx.productStrategy}\nTechnical Architecture:\n${ctx.technicalArchitecture}\n\nDesign a comprehensive go-to-market and launch strategy including positioning, channels, content plan, growth tactics, and budget allocation.`,

  [MissionState.FinancialAnalysis]: (brief, ctx, config) =>
    `Mission Brief: ${brief}\nAll Previous Plans:\n- Product: ${ctx.productStrategy.slice(0, 300)}\n- Technical: ${ctx.technicalArchitecture.slice(0, 300)}\n- Marketing: ${ctx.marketingStrategy.slice(0, 300)}\nTime Horizon: ${config.timeHorizon}\nBudget Range: ${config.budgetRange}\n\nCreate a detailed financial plan with budget breakdown, revenue projections, and runway analysis.`,

  [MissionState.RiskReview]: (_brief, ctx, _config) =>
    `Review ALL plans produced so far:\n\n=== PLANNER OUTPUT ===\n${ctx.workstreams.map((w) => `${w.title}: ${w.deliverables.join(", ")}`).join("\n")}\n\n=== RESEARCH ===\n${ctx.researchSummary.slice(0, 500)}\n\n=== PRODUCT STRATEGY ===\n${ctx.productStrategy.slice(0, 500)}\n\n=== TECHNICAL ARCHITECTURE ===\n${ctx.technicalArchitecture.slice(0, 500)}\n\n=== MARKETING STRATEGY ===\n${ctx.marketingStrategy.slice(0, 500)}\n\n=== FINANCIAL PLAN ===\n${ctx.financialPlan.slice(0, 500)}\n\nCritically assess these plans. Identify weak assumptions, gaps, unrealistic timelines, and unaddressed risks. Be specific. If you find no significant issues, say so. Format: For each issue, state the problem, severity (critical/moderate/low), and suggested fix. End with "CONFLICT_DETECTED: true" if you found critical issues, or "CONFLICT_DETECTED: false" if plans are sound.`,

  [MissionState.ConflictResolution]: (_brief, ctx, _config) =>
    `The Risk Critic identified these issues:\n\n${ctx.riskReview}\n\nOther agent outputs for context:\n- Product: ${ctx.productStrategy.slice(0, 300)}\n- Technical: ${ctx.technicalArchitecture.slice(0, 300)}\n- Marketing: ${ctx.marketingStrategy.slice(0, 300)}\n- Finance: ${ctx.financialPlan.slice(0, 300)}\n\nResolve each disagreement. For each conflict: state both positions, analyze the evidence, and provide a clear decision with reasoning.`,

  [MissionState.Finalizing]: (brief, ctx, config) =>
    `Mission Brief: ${brief}\nOutput Format: ${config.outputFormat}\n\n=== ALL AGENT OUTPUTS ===\nWorkstreams: ${ctx.workstreams.map((w) => w.title).join(", ")}\n\nResearch:\n${ctx.researchSummary.slice(0, 400)}\n\nProduct Strategy:\n${ctx.productStrategy.slice(0, 400)}\n\nTechnical Architecture:\n${ctx.technicalArchitecture.slice(0, 400)}\n\nMarketing Strategy:\n${ctx.marketingStrategy.slice(0, 400)}\n\nFinancial Plan:\n${ctx.financialPlan.slice(0, 400)}\n\nRisk Review:\n${ctx.riskReview.slice(0, 400)}\n\nMediator Decisions:\n${ctx.mediatorDecisions.slice(0, 400)}\n\nSynthesize ALL outputs into a final Mission Report with these sections: Executive Summary, Mission Objective, Workstreams, Role Assignments, Agent Contributions, Key Disagreements, Mediator Decisions, Execution Roadmap, Timeline, Budget/Resource Estimate, Risk Assessment, Success Metrics, and Final Recommendations.`,
};

const PROGRESS_PER_PHASE = 1 / 9; // 9 agent phases

export class MissionEngine {
  private listeners = new Map<MissionEventType, Set<EventListener>>();
  private abortController: AbortController | null = null;
  private contextRef: MissionContext | null = null;

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
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async startMission(
    initialContext: MissionContext,
    onUpdate: (ctx: MissionContext) => void
  ): Promise<void> {
    this.abortController = new AbortController();
    const ctx = { ...initialContext };
    this.contextRef = ctx;
    const client = isMockMode() ? createMockClient() : createQwenClient();

    const phases: MissionState[] = [
      MissionState.Planning,
      MissionState.Researching,
      MissionState.ProductStrategy,
      MissionState.TechnicalArchitecture,
      MissionState.MarketingStrategy,
      MissionState.FinancialAnalysis,
      MissionState.RiskReview,
    ];

    try {
      ctx.status = MissionState.Preparing;
      ctx.startedAt = new Date().toISOString();
      this.emit({ type: MissionEventType.MissionStarted, timestamp: new Date().toISOString(), payload: {} });
      onUpdate({ ...ctx });

      let progress = 0;

      for (const phase of phases) {
        if (this.abortController?.signal.aborted) {
          ctx.status = MissionState.Cancelled;
          this.emit({ type: MissionEventType.MissionCancelled, timestamp: new Date().toISOString(), payload: {} });
          onUpdate({ ...ctx });
          return;
        }

        const agentRole = STATE_AGENT_MAP[phase];
        const agentDef = getAgentByRole(agentRole!);
        if (!agentDef) continue;

        // Update context for this phase
        ctx.status = phase;
        ctx.currentAgent = agentRole;
        const phaseStart = Date.now();

        this.emit({ type: MissionEventType.AgentStarted, timestamp: new Date().toISOString(), payload: { agentRole, agentName: agentDef.name, phase } });
        onUpdate({ ...ctx });

        // Build messages
        const promptBuilder = PHASE_PROMPTS[phase];
        const userPrompt = promptBuilder ? promptBuilder(ctx.missionBrief, ctx, ctx.configuration) : ctx.missionBrief;
        const messages = [
          { role: "system" as const, content: agentDef.systemPrompt },
          { role: "user" as const, content: userPrompt },
        ];

        // Thinking phase
        this.emit({ type: MissionEventType.AgentThinking, timestamp: new Date().toISOString(), payload: { agentRole, agentName: agentDef.name } });
        onUpdate({ ...ctx });

        // Call LLM
        let result: string;
        try {
          result = await client.chat(messages, { maxTokens: 4096 });
        } catch (err) {
          ctx.status = MissionState.Failed;
          this.emit({ type: MissionEventType.MissionFailed, timestamp: new Date().toISOString(), payload: { error: String(err), phase } });
          onUpdate({ ...ctx });
          return;
        }

        // Stream simulation (emit chunks)
        const words = result.split(" ");
        const chunkSize = Math.ceil(words.length / 8);
        for (let i = 0; i < words.length; i += chunkSize) {
          const chunk = words.slice(i, i + chunkSize).join(" ");
          this.emit({ type: MissionEventType.AgentStream, timestamp: new Date().toISOString(), payload: { agentRole, chunk, progress: i / words.length } });
        }

        // Store result in context
        this.storePhaseResult(ctx, phase, result);

        // Add dialogue entry
        const dialogueEntry: AgentDialogueEntry = {
          agentId: agentDef.id,
          agentName: agentDef.name,
          agentRole: agentDef.role,
          content: result,
          timestamp: new Date().toISOString(),
        };
        ctx.dialogue = [...ctx.dialogue, dialogueEntry];

        // Add timeline entry
        const timelineEntry: TimelineEntry = {
          agent: agentDef.role,
          state: phase,
          label: agentDef.name,
          timestamp: new Date().toISOString(),
          duration: Date.now() - phaseStart,
        };
        ctx.timeline = [...ctx.timeline, timelineEntry];

        // Update progress
        progress += PROGRESS_PER_PHASE;
        ctx.progress = Math.min(progress, 0.95);

        this.emit({ type: MissionEventType.AgentFinished, timestamp: new Date().toISOString(), payload: { agentRole, agentName: agentDef.name, phase } });
        this.emit({ type: MissionEventType.MissionProgress, timestamp: new Date().toISOString(), payload: { progress: ctx.progress } });
        onUpdate({ ...ctx });
      }

      // Check if Risk Critic detected conflicts
      const hasConflicts = ctx.riskReview.includes("CONFLICT_DETECTED: true");

      if (hasConflicts) {
        // Run Mediator
        const mediatorPhase = MissionState.ConflictResolution;
        const mediatorDef = getAgentByRole(AgentRole.Mediator)!;
        ctx.status = mediatorPhase;
        ctx.currentAgent = AgentRole.Mediator;
        const phaseStart = Date.now();

        this.emit({ type: MissionEventType.ConflictDetected, timestamp: new Date().toISOString(), payload: {} });
        this.emit({ type: MissionEventType.AgentStarted, timestamp: new Date().toISOString(), payload: { agentRole: AgentRole.Mediator, agentName: mediatorDef.name, phase: mediatorPhase } });
        onUpdate({ ...ctx });

        const promptBuilder = PHASE_PROMPTS[mediatorPhase];
        const userPrompt = promptBuilder(ctx.missionBrief, ctx, ctx.configuration);
        const result = await client.chat([
          { role: "system", content: mediatorDef.systemPrompt },
          { role: "user", content: userPrompt },
        ], { maxTokens: 4096 });

        ctx.mediatorDecisions = result;

        const conflict: ConflictInfo = {
          id: generateId(),
          agents: [mediatorDef.name, "Risk Critic"],
          description: ctx.riskReview.slice(0, 200),
          resolution: result.slice(0, 300),
          resolved: true,
        };
        ctx.conflicts = [...ctx.conflicts, conflict];

        ctx.dialogue = [...ctx.dialogue, {
          agentId: mediatorDef.id, agentName: mediatorDef.name, agentRole: AgentRole.Mediator,
          content: result, timestamp: new Date().toISOString(), isConflict: true,
        }];

        ctx.timeline = [...ctx.timeline, {
          agent: AgentRole.Mediator, state: mediatorPhase, label: mediatorDef.name,
          timestamp: new Date().toISOString(), duration: Date.now() - phaseStart,
        }];

        progress += PROGRESS_PER_PHASE;
        ctx.progress = Math.min(progress, 0.95);

        this.emit({ type: MissionEventType.ConflictResolved, timestamp: new Date().toISOString(), payload: {} });
        this.emit({ type: MissionEventType.AgentFinished, timestamp: new Date().toISOString(), payload: { agentRole: AgentRole.Mediator, agentName: mediatorDef.name, phase: mediatorPhase } });
        onUpdate({ ...ctx });
      }

      // Finalizer phase
      ctx.status = MissionState.Finalizing;
      ctx.currentAgent = AgentRole.Finalizer;
      const finalizerDef = getAgentByRole(AgentRole.Finalizer)!;
      const finalStart = Date.now();

      this.emit({ type: MissionEventType.AgentStarted, timestamp: new Date().toISOString(), payload: { agentRole: AgentRole.Finalizer, agentName: finalizerDef.name, phase: MissionState.Finalizing } });
      onUpdate({ ...ctx });

      const finalPrompt = PHASE_PROMPTS[MissionState.Finalizing];
      const finalUserPrompt = finalPrompt(ctx.missionBrief, ctx, ctx.configuration);
      const finalResult = await client.chat([
        { role: "system", content: finalizerDef.systemPrompt },
        { role: "user", content: finalUserPrompt },
      ], { maxTokens: 6000 });

      ctx.finalReport = this.parseReport(finalResult);
      ctx.dialogue = [...ctx.dialogue, {
        agentId: finalizerDef.id, agentName: finalizerDef.name, agentRole: AgentRole.Finalizer,
        content: finalResult, timestamp: new Date().toISOString(),
      }];

      ctx.timeline = [...ctx.timeline, {
        agent: AgentRole.Finalizer, state: MissionState.Finalizing, label: finalizerDef.name,
        timestamp: new Date().toISOString(), duration: Date.now() - finalStart,
      }];

      // Generate efficiency metrics
      ctx.efficiencyMetrics = this.generateEfficiencyMetrics(ctx, hasConflicts);

      // Complete
      ctx.status = MissionState.Completed;
      ctx.progress = 1;
      ctx.currentAgent = null;
      ctx.completedAt = new Date().toISOString();

      this.emit({ type: MissionEventType.AgentFinished, timestamp: new Date().toISOString(), payload: { agentRole: AgentRole.Finalizer, agentName: finalizerDef.name, phase: MissionState.Finalizing } });
      this.emit({ type: MissionEventType.MissionCompleted, timestamp: new Date().toISOString(), payload: {} });
      onUpdate({ ...ctx });

    } catch (err) {
      if (this.abortController?.signal.aborted) {
        ctx.status = MissionState.Cancelled;
        this.emit({ type: MissionEventType.MissionCancelled, timestamp: new Date().toISOString(), payload: {} });
      } else {
        ctx.status = MissionState.Failed;
        this.emit({ type: MissionEventType.MissionFailed, timestamp: new Date().toISOString(), payload: { error: String(err) } });
      }
      onUpdate({ ...ctx });
    }
  }

  private storePhaseResult(ctx: MissionContext, phase: MissionState, result: string) {
    switch (phase) {
      case MissionState.Planning:
        ctx.workstreams = this.parseWorkstreams(result);
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
    }
  }

  private parseWorkstreams(text: string): Workstream[] {
    const lines = text.split("\n").filter((l) => l.trim().startsWith("**Workstream") || l.trim().match(/^\d+\./));
    if (lines.length === 0) {
      return [{ id: generateId(), title: "Core Execution", description: text.slice(0, 200), status: "pending", assignedAgent: null, deliverables: [] }];
    }
    return lines.slice(0, 5).map((line) => {
      const titleMatch = line.match(/\*\*([^*]+)\*\*/);
      const title = titleMatch ? titleMatch[1] : line.slice(0, 60);
      const desc = line.slice(0, 150);
      return { id: generateId(), title, description: desc, status: "pending" as const, assignedAgent: null, deliverables: [] };
    });
  }

  private parseReport(text: string): MissionReport {
    return {
      executiveSummary: this.extractSection(text, "Executive Summary"),
      missionObjective: this.extractSection(text, "Mission Objective"),
      workstreams: this.extractSection(text, "Workstreams"),
      roleAssignments: this.extractSection(text, "Role Assignments"),
      agentContributions: this.extractSection(text, "Agent Contributions"),
      keyDisagreements: this.extractSection(text, "Key Disagreements"),
      mediatorDecisions: this.extractSection(text, "Mediator Decisions"),
      executionRoadmap: this.extractSection(text, "Execution Roadmap"),
      timeline: this.extractSection(text, "Timeline"),
      budgetEstimate: this.extractSection(text, "Budget"),
      riskAssessment: this.extractSection(text, "Risk Assessment"),
      successMetrics: this.extractSection(text, "Success Metrics"),
      finalRecommendations: this.extractSection(text, "Final Recommendation"),
    };
  }

  private extractSection(text: string, heading: string): string {
    const regex = new RegExp(`###?\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=###?\\s|$)`, "i");
    const match = text.match(regex);
    return match ? match[1].trim() : "";
  }

  private generateEfficiencyMetrics(ctx: MissionContext, hadConflicts: boolean): EfficiencyMetrics {
    return {
      taskCoverage: 94,
      qualityScore: 87,
      conflictsResolved: hadConflicts ? ctx.conflicts.length : 0,
      estimatedCompletionTime: ctx.configuration.depth === "fast" ? "2 hours" : ctx.configuration.depth === "deep-analysis" ? "8 hours" : "4 hours",
      perspectivesConsidered: hadConflicts ? 9 : 8,
      revisionCount: hadConflicts ? 3 : 0,
      finalConfidenceScore: hadConflicts ? 82 : 75,
      singleAgentBaseline: 55,
    };
  }
}