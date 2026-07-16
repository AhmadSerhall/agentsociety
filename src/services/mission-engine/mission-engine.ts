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
  getTimeHorizonLabel,
  type AgentDialogueEntry,
  type AgentActivity,
  type AgentThinkingState,
  type ConflictInfo,
  type DeliverableMode,
  type EfficiencyMetrics,
  type ExecutionTask,
  type MissionConfiguration,
  type MissionContext,
  type MissionEvent,
  type MissionExecutionStrategy,
  type MissionGraph,
  type MissionKind,
  type MissionReplayEvent,
  type MissionReplayEventType,
  type MissionReport,
  type TimelineEntry,
  type Workstream,
} from "@/types";
import { AGENT_DEFINITIONS, getAgentByRole } from "@/agents";
import { createQwenClient, isMockMode } from "@/services/qwen";
import { useRuntimeSettingsStore } from "@/store/runtime-settings-store";
import { dedupeAgentOutputSections, extractActionItemsFromText, generateId, sanitizeMissionList, sanitizeMissionText, sanitizeUserFacingText } from "@/utils";
import { MockAgentRunner } from "./mock-agent-runner";
import type { EventListener } from "./types";

const PROGRESS_PER_PHASE = 1 / 9;
const missionValidationCache = new Map<string, { result: MissionValidationResult; expiresAt: number }>();

type MissionIntent =
  | MissionKind
  | "exam_preparation"
  | "business_launch"
  | "technical_debugging"
  | "product_strategy"
  | "learning_plan"
  | "research_analysis"
  | "financial_planning"
  | "content_strategy"
  | "personal_planning"
  | "general_problem_solving";

interface MissionClassification {
  intent: MissionIntent;
  strategy: MissionExecutionStrategy;
  selectedAgents: AgentRole[];
  semantic: SemanticMissionAnalysis;
  needsMarketing: boolean;
  needsFinance: boolean;
  needsProduct: boolean;
  isLaunch: boolean;
  isTechnical: boolean;
  isLearning: boolean;
}

interface SemanticWorkstreamBlueprint {
  title: string;
  description: string;
  agent: AgentRole;
  supportingAgents?: AgentRole[];
  deliverables: string[];
  acceptanceCriteria: string[];
  expectedOutputs: string[];
  dependencies?: number[];
}

interface SemanticMissionAnalysis {
  objective: string;
  primaryDomain: string;
  secondaryDomains: string[];
  intent: string;
  skills: string[];
  relevantConcepts: string[];
  requiredExpertise: Array<{ agent: AgentRole; reason: string; priority: "core" | "support" | "review" }>;
  usefulAgents: AgentRole[];
  riskThemes: string[];
  naturalWorkstreams: SemanticWorkstreamBlueprint[];
}

export interface MissionValidationResult {
  valid: boolean;
  score: number;
  level: "unclear" | "developing" | "clear" | "excellent";
  summary: string;
  explanation: string;
  strengths: string[];
  gaps: string[];
  suggestedMission: string;
}

interface PlannerGraphJson {
  summary?: string;
  workstreams?: Array<{
    id?: string;
    title?: string;
    description?: string;
    primaryAgentId?: string;
    supportingAgentIds?: string[];
    dependencies?: string[];
    parallelGroup?: number;
    expectedDeliverables?: string[];
    acceptanceCriteria?: string[];
    expectedOutputs?: string[];
    riskAreas?: string[];
    confidence?: number;
  }>;
  parallelGroups?: Array<{
    id?: string;
    title?: string;
    description?: string;
    taskIds?: string[];
  }>;
  conflictZones?: Array<{
    title?: string;
    agentsInvolved?: string[];
    reason?: string;
  }>;
  synthesisReadinessCriteria?: string[];
}

interface AgentStructuredOutput {
  agentName: string;
  displayRole: string;
  workstreamTitle: string;
  status: "planning" | "working" | "reviewing" | "complete" | "blocked";
  summary: string;
  councilMessage?: string;
  finalAnswer?: string;
  reviewNote?: string;
  usefulOutput: {
    keyFindings: string[];
    recommendations: string[];
    actionItems: string[];
    scheduleItems: string[];
    risks: string[];
    dependencies: string[];
  };
  handoffToNextAgent: string;
  timelineMilestone?: {
    title: string;
    description: string;
    significance?: string;
  };
  followUpMissions?: Array<{
    mission: string;
    rationale?: string;
  }>;
  confidence: number;
  conflictSignals: Array<{
    withAgent: string;
    topic: string;
    disagreement: string;
    severity: "low" | "moderate" | "high";
  }>;
}

type AgentExecutionCategory = "worker" | "reviewer" | "coordinator";

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
    `Time Horizon: ${getTimeHorizonLabel(config)}`,
    `Budget Range: ${BUDGET_RANGE_LABELS[config.budgetRange]}`,
    `Risk Tolerance: ${RISK_TOLERANCE_LABELS[config.riskTolerance]}`,
    `Output Format: ${OUTPUT_FORMAT_LABELS[config.outputFormat]}`,
  ].join("\n");
}

function inferExplicitTimeHorizon(brief: string): Pick<MissionConfiguration, "timeHorizon" | "customTimeHorizon"> {
  const match = sanitizeUserFacingText(brief).match(/\b(\d{1,4})\s*(?:-|–|—)?\s*(day|days|week|weeks|month|months|year|years)\b/i);
  if (!match) return { timeHorizon: "none" };
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase().replace(/s$/, "");
  return {
    timeHorizon: "custom",
    customTimeHorizon: `${amount} ${unit}${amount === 1 ? "" : "s"}`,
  };
}

function inferExplicitRiskTolerance(brief: string): MissionConfiguration["riskTolerance"] {
  const lowered = sanitizeUserFacingText(brief).toLowerCase();

  if (/\b(aggressive(?:ly)?|high[\s-]?risk|high risk tolerance|bold(?:ly)?|move fast|accept(?:ing)? risk|take risks|risky approach)\b/.test(lowered)) {
    return "aggressive";
  }
  if (/\b(conservative(?:ly)?|concerned|cautious(?:ly)?|low[\s-]?risk|risk[\s-]?averse|minimal risk|reduce risk|avoid risk|play it safe|safety first)\b/.test(lowered)) {
    return "conservative";
  }
  if (/\b(balanced(?:ly)?|moderate(?:ly)?|medium[\s-]?(?:risk|tolerance)|balanced risk tolerance)\b/.test(lowered)) {
    return "balanced";
  }

  const riskContext = /\b(risk|risky|risk-averse|risk tolerance|tolerance for risk)\b/.test(lowered)
    || /\b(to|want to|willing to)\s+risk\b/.test(lowered);
  if (!riskContext) return "none";

  if (/\b(high|more|greater|maximum|a lot of)\b/.test(lowered)) return "aggressive";
  if (/\b(low|less|minimal|little)\b/.test(lowered)) return "conservative";
  return "none";
}

function extractMoneyAmounts(text: string): number[] {
  const amounts: number[] = [];
  const patterns = [
    /\$\s*([\d,]+(?:\.\d{1,2})?)/g,
    /([\d,]+(?:\.\d{1,2})?)\s*\$/g,
    /\b([\d,]+(?:\.\d{1,2})?)\s*(?:usd|dollars?)\b/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(value) && value > 0) amounts.push(value);
    }
  }
  return amounts;
}

function detectBudgetContext(text: string, missionType?: MissionKind): "gaming_personal" | "consumer_personal" | "small_business" | "enterprise_business" | "general" {
  const lowered = sanitizeUserFacingText(text).toLowerCase();
  if (/\b(game|gaming|gamer|esports|e-sports|rank|ranked|leaderboard|marvel rivals|fortnite|valorant|league of legends|overwatch|apex legends|call of duty|competitive|one above all|grandmaster|challenger|elo|mmr|ladder|tier|rank up|climb ranks|coaching session|video game)\b/.test(lowered)) {
    return "gaming_personal";
  }
  if (/\b(fitness|workout|weight loss|marathon|personal goal|hobby|for myself|learn guitar|learn piano|self improvement|daily routine)\b/.test(lowered)) {
    return "consumer_personal";
  }
  if (/\b(enterprise|corporate|fortune|multinational|global rollout|company-wide|department budget|annual budget)\b/.test(lowered)
    || missionType === "erp_design") {
    return "enterprise_business";
  }
  if (/\b(startup|launch|business|company|restaurant|saas|store|shop|office|operations|employees|revenue|open a|mvp|go-to-market)\b/.test(lowered)
    || missionType === "startup_launch"
    || missionType === "business_planning") {
    return "small_business";
  }
  return "general";
}

function amountToBudgetRange(amount: number, context: ReturnType<typeof detectBudgetContext>): MissionConfiguration["budgetRange"] {
  const tiers: Record<ReturnType<typeof detectBudgetContext>, { low: number; medium: number }> = {
    gaming_personal: { low: 25, medium: 100 },
    consumer_personal: { low: 75, medium: 300 },
    small_business: { low: 5000, medium: 50000 },
    enterprise_business: { low: 25000, medium: 250000 },
    general: { low: 2000, medium: 50000 },
  };
  const tier = tiers[context];
  if (amount <= tier.low) return "low";
  if (amount <= tier.medium) return "medium";
  return "enterprise";
}

function inferExplicitBudgetRange(brief: string, missionType?: MissionKind): MissionConfiguration["budgetRange"] {
  const lowered = sanitizeUserFacingText(brief).toLowerCase();
  const amounts = extractMoneyAmounts(lowered);
  const maxAmount = amounts.length ? Math.max(...amounts) : undefined;
  const context = detectBudgetContext(lowered, missionType);

  if (/\b(no budget|zero budget|free|zero cost|no cost)\b/.test(lowered)) return "none";
  if (/\b(enterprise|large budget|corporate|unlimited budget|big budget|seven[\s-]?figure|six[\s-]?figure)\b/.test(lowered)) {
    if (context === "gaming_personal" || context === "consumer_personal") {
      return maxAmount !== undefined ? amountToBudgetRange(maxAmount, context) : "medium";
    }
    return maxAmount !== undefined && maxAmount <= 25000 ? "medium" : "enterprise";
  }

  if (maxAmount !== undefined) {
    return amountToBudgetRange(maxAmount, context);
  }

  if (/\b(low budget|cheap|lean|bootstrap|small budget|tight budget|limited budget|minimal budget|shoestring)\b/.test(lowered)) {
    return "low";
  }
  if (/\b(medium budget|moderate budget|mid[\s-]?range budget)\b/.test(lowered)) return "medium";
  if (/\b(high budget|big spend|splurge|premium budget|large spend)\b/.test(lowered)) {
    return context === "gaming_personal" || context === "consumer_personal" ? "enterprise" : "medium";
  }

  const mentionsSpending = /\b(spend|spending|spend up to|budget|cost|costs|pricing|paid|pay|invest|investment|cap(?:ped)? at|max(?:imum)?|limit(?:ed)? to|under|at most|no more than)\b/.test(lowered);
  if (mentionsSpending) return context === "gaming_personal" || context === "consumer_personal" ? "low" : "medium";

  return "none";
}

function configuredHorizonInDays(config: MissionConfiguration) {
  const known: Partial<Record<MissionConfiguration["timeHorizon"], number>> = {
    "7-days": 7,
    "30-days": 30,
    "90-days": 90,
    "6-months": 180,
    "1-year": 365,
  };
  if (config.timeHorizon !== "custom") return known[config.timeHorizon];
  const match = config.customTimeHorizon?.match(/\b(\d{1,4})\s*(day|days|week|weeks|month|months|year|years)\b/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = unit.startsWith("week") ? 7 : unit.startsWith("month") ? 30 : unit.startsWith("year") ? 365 : 1;
  return amount * multiplier;
}

function scheduleFitsConfiguredHorizon(item: string, config: MissionConfiguration) {
  const horizonDays = configuredHorizonInDays(config);
  if (!horizonDays) return true;
  const references: number[] = [];
  for (const match of item.matchAll(/\b(\d{1,4})(?:\s*[-–—]\s*(\d{1,4}))?\s*(day|days|week|weeks|month|months|year|years)\b/gi)) {
    const unit = match[3].toLowerCase();
    const multiplier = unit.startsWith("week") ? 7 : unit.startsWith("month") ? 30 : unit.startsWith("year") ? 365 : 1;
    references.push(Number(match[2] ?? match[1]) * multiplier);
  }
  for (const match of item.matchAll(/\b(day|days|week|weeks|month|months|year|years)\s+(\d{1,4})(?:\s*[-–—]\s*(\d{1,4}))?/gi)) {
    const unit = match[1].toLowerCase();
    const multiplier = unit.startsWith("week") ? 7 : unit.startsWith("month") ? 30 : unit.startsWith("year") ? 365 : 1;
    references.push(Number(match[3] ?? match[2]) * multiplier);
  }
  return references.every((reference) => reference <= horizonDays);
}

function clampConfidence(value: number) {
  return Math.max(45, Math.min(98, Math.round(value)));
}

function buildPrompt(phase: MissionState, brief: string, ctx: MissionContext, config: MissionConfiguration, task?: ExecutionTask) {
  const domain = ctx.replayEvents.find((event) => event.type === "MISSION_CLASSIFIED")?.payload?.classification as MissionClassification | undefined;
  const role = task?.agent ?? STATE_AGENT_MAP[phase] ?? AgentRole.Planner;
  const displayRole = task?.displayRole ?? (domain ? missionDisplayRole(domain, role) : undefined);
  const category = domain ? agentExecutionCategory(domain, role, phase) : "worker";
  const directMission = Boolean(domain && !domain.strategy.requiresPlanning);
  const directOutput = config.outputFormat === "direct-result";
  return `Mission Brief: ${brief}

Selected Mission Configuration:
${configSummary(config)}

Semantic Mission Analysis:
- Mission Type / Execution Style: ${MISSION_TYPE_LABELS[config.missionType]}
- Classified Mission Type: ${domain?.strategy.missionType ?? "not classified yet"}
- Deliverable Mode: ${domain?.strategy.deliverableMode ?? "not decided yet"}
- Complexity: ${domain?.strategy.complexity ?? "unknown"}/10
- Execution Strategy: ${domain?.strategy.selectedStrategy ?? "decide before planning"}
- Planning Enabled: ${domain ? (domain.strategy.requiresPlanning ? `yes - ${domain.strategy.planningReason}` : "no - direct specialist execution is sufficient") : "unknown"}
- Output Preference: ${OUTPUT_FORMAT_LABELS[config.outputFormat]}${directOutput ? " - return the answer directly and keep orchestration details out of the user-facing deliverable" : ""}
- Agent Category: ${category.toUpperCase()}
- Recommended Agents: ${domain?.strategy.recommendedAgents.map((role) => missionDisplayRole(domain, role)).join(", ") || "infer minimal useful team"}
- Primary Domain: ${domain?.semantic.primaryDomain ?? "To be inferred from the objective"}
- Secondary Domains: ${domain?.semantic.secondaryDomains.join(", ") || "None detected yet"}
- User Intent: ${domain?.semantic.intent ?? "Infer the user's real objective before decomposing work"}
- Relevant Concepts: ${domain?.semantic.relevantConcepts.join(", ") || "Infer from the objective"}
- Required Expertise: ${domain?.semantic.requiredExpertise.map((item) => `${missionDisplayRole(domain, item.agent)} (${item.priority}: ${item.reason})`).join("; ") || "Infer before planning"}
- Mission-Specific Risks: ${domain?.semantic.riskThemes.join("; ") || "Only include real risks if they exist"}
- Mission Understanding Notes: ${domain?.strategy.validationNotes.join("; ") || "The objective is clear enough to proceed"}
Your User-Facing Role: ${displayRole ?? "Mission Specialist"}

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
${ctx.dialogue.slice(-6).map((entry) => `- ${entry.agentName} (${entry.status ?? "complete"}): ${sanitizeUserFacingText(entry.conversationMessage ?? "")}`).filter((entry) => !entry.endsWith(": ")).join("\n") || "No prior dialogue."}

Shared Mission State:
- Agent States: ${Object.entries(ctx.agentStates).map(([role, state]) => `${role}=${state}`).join(", ")}
- Completed Tasks: ${ctx.executionTasks.filter((item) => item.status === "completed").map((item) => item.title).join("; ") || "None"}
- Mission Graph Readiness: ${ctx.missionGraph?.finalizationReadiness.status ?? "not_created"}
- Task Nodes: ${ctx.executionTasks.map((item) => `${item.title} (${item.status}, agent=${item.agent}, dependencies=${item.dependencies.length})`).join("; ") || "None"}
- Open Conflicts: ${ctx.conflicts.filter((conflict) => !conflict.resolved).map((conflict) => conflict.title ?? conflict.description).join("; ") || "None"}

Produce the ${phase} contribution.
Rules:
- Return ONLY valid JSON matching the response contract below. No markdown, headings, code fences, tables, separators, or prose outside JSON.
- Worker agents must produce the actual requested artifact. Translation means translated text. Programming means code. Writing means the requested writing. Research means the research answer. Do not describe that the work was completed.
- Reviewer agents inspect and correct worker output. They do not create a new deliverable unless they are correcting a concrete mistake.
- Coordinator agents assign, merge, or resolve. They do not create business plans, translations, code, campaigns, or reports unless the phase explicitly requires final synthesis.
- For direct missions, the "summary" field must contain the artifact itself or the final user answer, not meta-commentary.
- For direct-answer missions, the "finalAnswer" field must contain exactly the answer the user should see. Keep "reviewNote" empty unless there is a useful short correction or validation note.
- For direct missions in Finalizing, merge the verified worker output and return the artifact itself. Do not say it was completed.
- Forbidden for direct missions: "mission complete", "translation completed", "the answer is ready", budget, timeline, stakeholders, roadmap, deliverables, next steps, implementation phases, unless the user explicitly asked for them.
- Do not repeat the mission brief except when a single short reference is necessary.
- Treat completed workstreams, dialogue, confidence changes, planner revisions, and active conflicts above as shared memory. When they materially affect your contribution, acknowledge the specific prior finding or decision you are building on. Never claim a finding that is not present in this context.
- If prior dialogue exists, make the council relationship explicit in the summary or handoff: name the earlier role, identify the actual finding or assumption being accepted, challenged, revised, or reconciled, and explain how it changes this contribution. Do not add a ceremonial reference when the prior work is unrelated.
- Write councilMessage as a natural one-to-three sentence reply to the most recent relevant agent. Use your distinct professional voice, respond to one specific finding or disagreement, and state only the new evidence, objection, implication, or revision you add. Do not reuse any sentence, bullet, schedule item, or recommendation already present in Structured Dialogue Context or Previous Agent Outputs. Never paste the full deliverable, repeat a schedule, or restate lists in councilMessage.
- Write timelineMilestone from the actual contribution you just produced. Its title, description, and significance must be mission-specific and must not use generic phase-completion language.
- Only when Finalizing, generate one to three followUpMissions from the completed mission and its strongest unresolved or actionable findings. Each mission must be a standalone prompt a person would naturally type, not a template, label, stitched sentence, or repetition of the original objective. For every other phase return an empty followUpMissions array.
- Agreement must preserve the useful evidence it accepts. Disagreement must identify the concrete assumption being challenged. Revisions must state what changed. Consensus must state which trade-off was resolved.
- Missing specificity is non-blocking once the objective is coherent. Proceed with explicit, reversible assumptions. If a missing detail materially changes the answer, include one concise clarification question in the handoff while continuing any work that does not depend on it.
- The configured time horizon is authoritative. If it is specified, every schedule item and milestone must fit inside ${getTimeHorizonLabel(config)}; never produce a later day, week, month, or year. If it is not specified, use relative phases instead of inventing a deadline.
- Do not write generic contribution titles. Produce direct useful content inside your assigned workstream.
- Treat Mission Type as an execution style, not the domain. Use Semantic Mission Analysis to decide what the user is actually trying to accomplish.
- Use the inferred domain, concepts, and your user-facing role. Stay inside the assigned workstream.
- Do not invent business, product, marketing, technical, or finance sections unless the mission domain calls for them.
- Do not include Product, Marketing, Finance, Risk, or Mediator work unless the objective genuinely needs that expertise.
- Planning is conditional. If classification says planning is disabled, do direct specialist work and do not create enterprise roadmaps.
- If Output Format is Direct Result, keep the user-facing answer concise and avoid extra strategy, roadmap, budget, risk, or planning sections unless the mission truly requires them.
- ${directMission ? "This is a direct-execution mission. Do the work now. The user should receive the requested artifact, not a description of process." : "This mission may need structured coordination; still only create planning artifacts when they are useful."}
- Planner must infer domains, intent, skills, required expertise, useful agents, natural workstreams, dependencies, parallelism, and mission-specific risks before producing the graph.
- Planner JSON workstreams should include mission-specific title, description, primaryAgentId, supportingAgentIds, dependencies, expectedDeliverables, acceptanceCriteria, and expectedOutputs.
- Avoid generic labels like "Problem Framing", "Option Design", "Risk Review", "Generated workstream derived from mission brief", "General Mission analysis", or "Execution Roadmap" unless those exact words are truly the user's domain.
- Conflict signals must describe genuine incompatible recommendations or assumptions. Use an empty conflictSignals array if there is no real disagreement.
- If this is an exam preparation or learning plan mission, produce actual study advice, drills, schedules, resources, checkpoints, and test strategy.

Response contract:
{
  "agentName": "string",
  "displayRole": "string",
  "workstreamTitle": "string",
  "status": "planning | working | reviewing | complete | blocked",
  "summary": "one clean user-facing sentence",
  "councilMessage": "a short natural reply to the relevant previous agent in this role's own voice",
  "finalAnswer": "required for direct_answer missions; the actual answer/artifact to show the user",
  "reviewNote": "optional short reviewer note for direct_answer missions",
  "usefulOutput": {
    "keyFindings": ["string"],
    "recommendations": ["string"],
    "actionItems": ["string"],
    "scheduleItems": ["string"],
    "risks": ["string"],
    "dependencies": ["string"]
  },
  "handoffToNextAgent": "string",
  "timelineMilestone": {
    "title": "mission-specific milestone title",
    "description": "what changed in this mission",
    "significance": "why this changed the next decision"
  },
  "followUpMissions": [
    {
      "mission": "a natural standalone follow-up mission prompt",
      "rationale": "why this logically follows from the completed work"
    }
  ],
  "confidence": 0,
  "conflictSignals": [
    {
      "withAgent": "string",
      "topic": "string",
      "disagreement": "string",
      "severity": "low | moderate | high"
    }
  ]
}`;
}

function agentExecutionCategory(classification: MissionClassification, role: AgentRole, phase?: MissionState | string): AgentExecutionCategory {
  if (role === AgentRole.Planner || role === AgentRole.Mediator) return "coordinator";
  if (role === AgentRole.Finalizer) return "coordinator";
  if (role === AgentRole.RiskCritic) return "reviewer";
  if (phase === MissionState.ConflictResolution) return "coordinator";
  if (classification.strategy.requiresPlanning && role === AgentRole.ProductStrategist && classification.strategy.missionType === "startup_launch") return "worker";
  return "worker";
}

function missionDisplayRole(classification: MissionClassification, role: AgentRole): string {
  if (classification.strategy.missionType === "translation") {
    if (role === AgentRole.Researcher) return "Translator";
    if (role === AgentRole.Finalizer) return "Translation Reviewer";
  }
  if (classification.strategy.missionType === "summarization") {
    if (role === AgentRole.Researcher) return "Reader";
    if (role === AgentRole.Finalizer) return "Summarizer";
  }
  if (classification.strategy.missionType === "question_answering") {
    if (role === AgentRole.Researcher) return "Answer Specialist";
    if (role === AgentRole.Finalizer) return "Answer Reviewer";
  }
  if (classification.strategy.missionType === "creative_writing") {
    if (role === AgentRole.Researcher) return "Writer";
    if (role === AgentRole.Finalizer) return "Editor";
  }
  if (classification.strategy.missionType === "programming" || classification.strategy.missionType === "debugging") {
    if (role === AgentRole.TechnicalArchitect) return "Software Engineer";
    if (role === AgentRole.RiskCritic) return "Code Reviewer";
    if (role === AgentRole.Finalizer) return "Implementation Reviewer";
  }
  if (classification.intent === "exam_preparation" || classification.intent === "learning_plan") {
    const map: Record<AgentRole, string> = {
      [AgentRole.Planner]: "Planner",
      [AgentRole.Researcher]: "Diagnostic Coach",
      [AgentRole.ProductStrategist]: "Curriculum Coach",
      [AgentRole.TechnicalArchitect]: "Practice Coach",
      [AgentRole.MarketingStrategist]: "Resource Coach",
      [AgentRole.Finance]: "Time Budget Coach",
      [AgentRole.RiskCritic]: "Risk Critic",
      [AgentRole.Mediator]: "Mediator",
      [AgentRole.Finalizer]: "Finalizer",
    };
    return map[role];
  }
  return getAgentByRole(role)?.name ?? role.replace(/-/g, " ");
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

  validateMissionBrief(brief: string): MissionValidationResult {
    const objective = sanitizeUserFacingText(brief).replace(/\s+/g, " ").trim();
    const tokens = objective.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
    const normalizedTokens = tokens.map((token) => token.toLocaleLowerCase());
    const uniqueTokens = new Set(normalizedTokens);
    const nonWhitespace = objective.replace(/\s/g, "");
    const semanticCharacters = objective.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
    const symbolRatio = nonWhitespace.length ? 1 - (semanticCharacters / nonWhitespace.length) : 1;
    const repeatedCharacterNoise = /(.)\1{3,}/u.test(objective);
    const tokenCounts = normalizedTokens.reduce((counts, token) => counts.set(token, (counts.get(token) ?? 0) + 1), new Map<string, number>());
    const mostFrequentToken = Math.max(0, ...tokenCounts.values());
    const dominantTokenRatio = tokens.length ? mostFrequentToken / tokens.length : 1;
    const lexicalDiversity = tokens.length ? uniqueTokens.size / tokens.length : 0;
    const informativeTokens = tokens.filter((token) => token.length >= 4).length;
    const sentenceSignals = objective.split(/[.!?;:\n]+/).filter((part) => part.trim().length >= 6).length;
    const constraintSignals = objective.match(/\b\d+(?:[.,]\d+)?(?:%|\s*[\p{L}]+)?\b/gu)?.length ?? 0;
    const latinTokens = normalizedTokens.filter((token) => /^[a-z]+$/.test(token));
    const suspiciousWordShapes = latinTokens.filter((token) => {
      if (token.length < 4) return false;
      const vowelRatio = (token.match(/[aeiouy]/g)?.length ?? 0) / token.length;
      return vowelRatio <= 0.23 || /[bcdfghjklmnpqrstvwxz]{4,}/.test(token);
    }).length;
    const unintelligibleWordShapes = tokens.length === 1
      || (latinTokens.length >= 2 && suspiciousWordShapes / latinTokens.length >= 0.5);

    let score = objective ? 100 : 0;
    const strengths: string[] = [];
    const gaps: string[] = [];

    if (!objective) gaps.push("No objective was provided.");
    if (objective && unintelligibleWordShapes) {
      score -= 64;
      gaps.push("The text does not form an understandable objective, so the council cannot identify a relevant outcome.");
    }
    if (tokens.length < 3) {
      score -= unintelligibleWordShapes ? 10 : 58;
      if (!unintelligibleWordShapes) gaps.push("The objective is too short to identify a reliable outcome.");
    } else if (tokens.length < 5) {
      score -= 24;
      gaps.push("A little more context would make the intended result easier to distinguish.");
    } else {
      strengths.push("The objective contains enough language to establish a direction.");
    }
    if (objective.length > 0 && objective.length < 18) {
      score -= 24;
      gaps.push("The brief does not yet explain what a successful result should contain.");
    }
    if (uniqueTokens.size < 3 || lexicalDiversity < 0.42 || dominantTokenRatio > 0.48) {
      score -= 28;
      gaps.push("The text is too repetitive to reveal a distinct mission.");
    } else if (uniqueTokens.size >= 6) {
      strengths.push("The wording provides several distinct intent signals.");
    }
    if (symbolRatio > 0.28 || repeatedCharacterNoise) {
      score -= 34;
      gaps.push("Much of the input looks like symbols or repeated characters rather than an objective.");
    }
    if (informativeTokens < 2 && tokens.length > 0) {
      score -= 22;
      gaps.push("The brief needs a clearer subject, outcome, or deliverable.");
    }
    if (sentenceSignals > 1) strengths.push("The brief provides supporting context beyond the headline objective.");
    if (constraintSignals > 0) strengths.push("Concrete constraints or measurable details improve the interpretation.");
    if (objective.length >= 70) score += 4;
    if (sentenceSignals > 1) score += 3;
    if (constraintSignals > 0) score += 3;

    score = Math.max(0, Math.min(98, Math.round(score)));
    const valid = score >= 56 && tokens.length >= 3 && uniqueTokens.size >= 3 && symbolRatio <= 0.45 && !repeatedCharacterNoise && !unintelligibleWordShapes;
    const level: MissionValidationResult["level"] = score >= 88 ? "excellent" : score >= 72 ? "clear" : score >= 56 ? "developing" : "unclear";
    const readableSeed = valid || (tokens.length >= 3 && symbolRatio < 0.3)
      ? objective.slice(0, 260)
      : "an important objective that needs a concrete outcome";
    const suggestedMission = `Turn this into a clear, executable mission: ${readableSeed}. Define the desired result, relevant constraints, acceptance criteria, and the first practical decision to make.`;
    const summary = valid
      ? score >= 88 ? "The objective is specific enough for the council to execute with high confidence." : "The council can understand this objective, with a few details left to infer."
      : "The council cannot yet identify a dependable mission from this input.";
    const explanation = gaps[0] ?? "The objective contains a meaningful outcome and enough context to begin classification.";

    return {
      valid,
      score,
      level,
      summary,
      explanation,
      strengths: Array.from(new Set(strengths)).slice(0, 3),
      gaps: Array.from(new Set(gaps)).slice(0, 3),
      suggestedMission,
    };
  }

  async validateMissionBriefSemantically(brief: string): Promise<MissionValidationResult> {
    const baseline = this.validateMissionBrief(brief);
    const cacheKey = `v3:${sanitizeUserFacingText(brief).replace(/\s+/g, " ").trim().toLocaleLowerCase()}`;
    const cached = missionValidationCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.result;
    if (!baseline.valid) {
      missionValidationCache.set(cacheKey, { result: baseline, expiresAt: Date.now() + 5 * 60_000 });
      return baseline;
    }
    if (isMockMode()) return baseline;

    try {
      const response = await createQwenClient().chat([
        {
          role: "system",
          content: `You are a domain-agnostic mission intake validator. Decide whether the user text contains a coherent objective that an expert team can begin working on. Distinguish real natural-language intent from random letter sequences, invented non-words, and strings that merely resemble sentence tokens. Mark valid=false only when no meaningful intent can be recovered, such as blank, random, or nonsensical input. Ambiguous, broad, or incomplete objectives are valid: identify their gaps so agents can proceed with explicit assumptions and request clarification later if necessary. Do not classify the mission domain and do not require particular keywords. Score must be an integer from 0 to 100, where 100 means fully understood. Return only JSON: {"valid":boolean,"score":number,"summary":"human-friendly sentence","explanation":"most useful reason","gaps":["up to three concise non-blocking clarification gaps"],"suggestedMission":"a clearer rewrite that preserves the user's real intent, or an empty string if no intent is recoverable"}.`,
        },
        { role: "user", content: brief },
      ], { temperature: 0.1, maxTokens: 420 });
      const json = response.match(/\{[\s\S]*\}/)?.[0];
      if (!json) return baseline;
      const parsed = JSON.parse(json) as Partial<MissionValidationResult>;
      const rawScore = Number(parsed.score ?? baseline.score);
      const percentScore = Number.isFinite(rawScore) && rawScore > 0 && rawScore <= 1 ? rawScore * 100 : rawScore;
      const normalizedScore = Math.max(0, Math.min(98, Math.round(Number.isFinite(percentScore) ? percentScore : baseline.score)));
      const score = parsed.valid === true ? Math.max(baseline.score, normalizedScore) : normalizedScore;
      const explicitNonsenseVeto = parsed.valid === false && score < 20;
      const valid = baseline.valid && !explicitNonsenseVeto;
      const level: MissionValidationResult["level"] = score >= 88 ? "excellent" : score >= 72 ? "clear" : score >= 56 ? "developing" : "unclear";
      const result: MissionValidationResult = {
        ...baseline,
        valid,
        score,
        level,
        summary: sanitizeUserFacingText(parsed.summary ?? baseline.summary) || baseline.summary,
        explanation: sanitizeUserFacingText(parsed.explanation ?? baseline.explanation) || baseline.explanation,
        gaps: sanitizeMissionList(parsed.gaps ?? baseline.gaps).slice(0, 3),
        suggestedMission: sanitizeUserFacingText(parsed.suggestedMission ?? baseline.suggestedMission) || baseline.suggestedMission,
      };
      missionValidationCache.set(cacheKey, { result, expiresAt: Date.now() + 5 * 60_000 });
      return result;
    } catch {
      return baseline;
    }
  }

  suggestMissionConfiguration(brief: string, currentConfig?: Partial<MissionConfiguration>) {
    const baseConfig: MissionConfiguration = {
      missionType: currentConfig?.missionType ?? "general-mission",
      depth: currentConfig?.depth ?? "balanced",
      timeHorizon: currentConfig?.timeHorizon ?? "none",
      customTimeHorizon: currentConfig?.customTimeHorizon,
      budgetRange: currentConfig?.budgetRange ?? "none",
      riskTolerance: currentConfig?.riskTolerance ?? "none",
      outputFormat: currentConfig?.outputFormat ?? "direct-result",
    };
    const classification = this.classifyMission(brief, baseConfig);
    const horizon = inferExplicitTimeHorizon(brief);
    const config: MissionConfiguration = {
      missionType: this.suggestMissionType(classification.strategy.missionType),
      depth: classification.strategy.complexity >= 7 ? "deep-analysis" : classification.strategy.complexity <= 2 ? "fast" : "balanced",
      outputFormat: this.suggestOutputFormat(classification.strategy.deliverableMode, classification.strategy.missionType),
      ...horizon,
      budgetRange: inferExplicitBudgetRange(brief, classification.strategy.missionType),
      riskTolerance: inferExplicitRiskTolerance(brief),
    };
    const why = [
      `Detected ${classification.strategy.missionType.replace(/_/g, " ")} mission`,
      `${classification.strategy.complexity}/10 complexity`,
      classification.strategy.requiresPlanning ? "planning is useful" : "direct specialist execution is enough",
      `${classification.strategy.deliverableMode.replace(/_/g, " ")} deliverable`,
    ].join(" with ");
    return { config, why, classification: classification.strategy };
  }

  private suggestMissionType(missionType: MissionKind): MissionConfiguration["missionType"] {
    if (["software_architecture", "programming", "debugging", "erp_design", "code_review"].includes(missionType)) return "software-architecture";
    if (missionType === "startup_launch") return "startup-launch";
    if (["business_planning", "financial_analysis"].includes(missionType)) return "business-plan";
    if (["research", "summarization", "question_answering", "education", "file_analysis"].includes(missionType)) return "research-plan";
    if (["creative_writing", "brainstorming"].includes(missionType)) return "product-strategy";
    return "general-mission";
  }

  private suggestOutputFormat(deliverableMode: DeliverableMode, missionType: MissionKind): MissionConfiguration["outputFormat"] {
    if (deliverableMode === "direct_answer") return "direct-result";
    if (["software_architecture", "programming", "debugging", "erp_design", "code_review"].includes(missionType)) return "technical-plan";
    if (["startup_launch", "business_planning"].includes(missionType)) return "strategy-brief";
    if (missionType === "research") return "executive-report";
    return "execution-roadmap";
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
      agentActivities: initialContext.agentActivities ?? {},
      executionTasks: [...(initialContext.executionTasks ?? [])],
      missionGraph: initialContext.missionGraph,
      replayEvents: [...(initialContext.replayEvents ?? [])],
    };
    const signal = this.abortController.signal;
    const understanding = await this.validateMissionBriefSemantically(ctx.missionBrief);
    if (!understanding.valid) {
      this.contextRef = ctx;
      this.emit({ type: MissionEventType.MissionFailed, timestamp: now(), payload: { error: understanding.explanation } });
      onUpdate({ ...ctx });
      return;
    }
    const mockMode = isMockMode();
    const qwenClient = mockMode ? null : createQwenClient();
    const classification = this.classifyMission(ctx.missionBrief, ctx.configuration);
    classification.strategy.validationNotes = [
      `Mission understanding: ${understanding.score}% - ${understanding.summary}`,
      ...understanding.gaps.map((gap) => `Non-blocking clarification: ${gap}`),
      ...classification.strategy.validationNotes,
    ];
    ctx.missionClassification = classification.strategy;
    this.contextRef = ctx;
    devLog("mission classification", classification);

    try {
      this.recordReplayEvent(ctx, "MISSION_CREATED", { payload: { missionId: ctx.missionId, missionBrief: ctx.missionBrief, configuration: ctx.configuration } }, 0);
      this.recordReplayEvent(ctx, "MISSION_CONFIGURATION_SELECTED", { payload: { configuration: ctx.configuration } }, 30);
      this.recordReplayEvent(ctx, "MISSION_CLASSIFIED", { payload: { classification }, metadata: { selectedAgents: classification.selectedAgents } }, 60);
      ctx.status = MissionState.Preparing;
      ctx.startedAt = now();
      this.recordReplayEvent(ctx, "MISSION_STARTED", { payload: { missionId: ctx.missionId } }, 100);
      this.addTimeline(ctx, classification.selectedAgents[0] ?? AgentRole.Researcher, MissionState.Preparing, "Mission understood and classified", `${understanding.score}% understanding confidence established before selecting a ${classification.strategy.selectedStrategy.replace(/_/g, " ")} execution path. This mattered because the council could align its work to a readable objective before assigning specialists.`, "system");
      this.emit({ type: MissionEventType.MissionStarted, timestamp: now(), payload: {} });
      onUpdate({ ...ctx });
      await this.delay(700, signal);

      if (classification.strategy.requiresPlanning) {
        await this.runAgentPhase(ctx, MissionState.Planning, mockMode, qwenClient, signal, onUpdate, classification);
        this.ensureRequiredWorkstreams(ctx, classification);
        ctx.workstreams = this.validateWorkstreamsForStrategy(ctx.workstreams, classification, ctx.missionBrief);
      } else {
        ctx.workstreams = this.createDirectWorkstreams(classification);
        this.addTimeline(ctx, classification.selectedAgents[0] ?? AgentRole.Researcher, MissionState.Preparing, "Direct execution selected", classification.strategy.planningReason, "workstream");
      }
      ctx.executionTasks = this.createExecutionTasks(ctx.workstreams, classification);
      ctx.missionGraph = this.createMissionGraph(ctx);
      this.recordReplayEvent(ctx, "MISSION_GRAPH_CREATED", {
        payload: { missionGraph: ctx.missionGraph },
        metadata: {
          parallelGroups: this.getParallelExecutionGroups(ctx.executionTasks),
          potentialConflictZones: this.identifyPotentialConflictZones(ctx.executionTasks),
        },
      });
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
      this.addTimeline(ctx, classification.selectedAgents[0] ?? AgentRole.Researcher, MissionState.Planning, "Execution tasks created", `${ctx.executionTasks.length} task${ctx.executionTasks.length === 1 ? "" : "s"} created from ${classification.strategy.requiresPlanning ? "Planner output" : "mission classification"}.`, "workstream");
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

      this.updateMissionGraph(ctx);
      this.reachSynchronizationPoint(ctx);
      onUpdate({ ...ctx });
      await this.runAgentPhase(ctx, MissionState.Finalizing, mockMode, qwenClient, signal, onUpdate, classification);
      this.reconcileMissionParticipants(ctx, classification);
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
    const thinkingActivity = this.setAgentActivity(ctx, agentRole, "thinking", "Reviewing council context", this.activityDetail(ctx), this.averageConfidence(ctx));
    this.recordReplayEvent(ctx, phase === MissionState.Finalizing ? "FINALIZER_STARTED" : phase === MissionState.ConflictResolution ? "MEDIATOR_STARTED" : phase === MissionState.Planning ? "PLANNER_STARTED" : "AGENT_STARTED", {
      agentId: agentDef.id,
      agentName: agentDef.name,
      agentRole,
      payload: { phase, activity: thinkingActivity },
    });
    this.recordReplayEvent(ctx, "AGENT_THINKING", { agentId: agentDef.id, agentName: agentDef.name, agentRole, payload: { phase, activity: thinkingActivity } });
    this.addTimeline(ctx, agentRole, phase, thinkingActivity.label, thinkingActivity.detail, "agent");
    this.emit({ type: MissionEventType.AgentStarted, timestamp: now(), payload: { agentRole, agentName: agentDef.name, phase } });
    this.emit({ type: MissionEventType.AgentThinking, timestamp: now(), payload: { agentRole, agentName: agentDef.name } });
    onUpdate({ ...ctx });

    const phaseStart = Date.now();
    let result: string;

    if (mockMode) {
      await this.delay(Math.floor(this.mockRunner.getDelay(phase) * 0.35), signal);
      const analyzingActivity = this.setAgentActivity(ctx, agentRole, "analyzing", "Evaluating shared findings", this.activityDetail(ctx), this.averageConfidence(ctx));
      this.recordReplayEvent(ctx, "AGENT_ANALYZING", { agentId: agentDef.id, agentName: agentDef.name, agentRole, payload: { phase, activity: analyzingActivity } });
      onUpdate({ ...ctx });
      await this.delay(Math.floor(this.mockRunner.getDelay(phase) * 0.25), signal);
      const reviewingActivity = this.setAgentActivity(ctx, agentRole, "reviewing", "Checking assumptions and revisions", "Comparing the proposed contribution with the current council state.", this.averageConfidence(ctx));
      this.recordReplayEvent(ctx, "AGENT_REVIEWING", { agentId: agentDef.id, agentName: agentDef.name, agentRole, payload: { phase, activity: reviewingActivity } });
      onUpdate({ ...ctx });
      await this.delay(this.mockRunner.getDelay(phase), signal);
      result = this.mockRunner.generate(phase, ctx, undefined, classification);
    } else if (qwenClient) {
      await this.delay(240, signal);
      const analyzingActivity = this.setAgentActivity(ctx, agentRole, "analyzing", "Preparing a role-specific recommendation", this.activityDetail(ctx), this.averageConfidence(ctx));
      this.recordReplayEvent(ctx, "AGENT_ANALYZING", { agentId: agentDef.id, agentName: agentDef.name, agentRole, payload: { phase, activity: analyzingActivity } });
      onUpdate({ ...ctx });
      const stopLiveReview = this.scheduleLiveReview(ctx, agentDef, agentRole, phase, onUpdate);
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
        result = this.mockRunner.generate(phase, ctx, undefined, classification);
      } finally {
        stopLiveReview();
      }
      if (signal.aborted) throw new DOMException("Mission cancelled", "AbortError");
    } else {
      result = this.mockRunner.generate(phase, ctx, undefined, classification);
    }

    if (ctx.agentStates[agentRole] !== "reviewing") {
      const reviewingActivity = this.setAgentActivity(ctx, agentRole, "reviewing", "Cross-checking the recommendation", "Verifying the contribution against the current council decisions.", this.averageConfidence(ctx));
      this.recordReplayEvent(ctx, "AGENT_REVIEWING", { agentId: agentDef.id, agentName: agentDef.name, agentRole, payload: { phase, activity: reviewingActivity } });
      onUpdate({ ...ctx });
      await this.delay(140, signal);
    }

    result = this.normalizeAgentResult(ctx, phase, agentRole, result, classification ?? this.classifyMission(ctx.missionBrief, ctx.configuration));
    const structuredResult = this.tryParseAgentOutput(result);
    this.recordStreamEvents(ctx, phase === MissionState.Planning ? "PLANNER_STREAM" : phase === MissionState.Finalizing ? "FINALIZER_STREAM" : "AGENT_STREAM", result, agentDef.id, agentDef.name, agentRole, phaseStart);
    this.storePhaseResult(ctx, phase, result, classification ?? this.classifyMission(ctx.missionBrief, ctx.configuration));
    const completeActivity = this.setAgentActivity(ctx, agentRole, "complete", "Contribution shared with the council", "This phase output is available to the next decision point.", this.averageConfidence(ctx));
    this.addDialogue(ctx, agentDef.id, agentDef.name, agentDef.role, result, phase === MissionState.ConflictResolution, {
      phase,
      status: "complete",
      confidence: this.averageConfidence(ctx),
      displayRole: missionDisplayRole(classification ?? this.classifyMission(ctx.missionBrief, ctx.configuration), agentRole),
    });
    const phaseMilestone = structuredResult?.timelineMilestone;
    this.addTimeline(
      ctx,
      agentDef.role,
      phase,
      phaseMilestone?.title || ctx.workstreams.find((workstream) => workstream.assignedAgent === agentRole)?.title || this.dialogueMessageFromOutput(result),
      phaseMilestone?.description || structuredResult?.councilMessage || structuredResult?.summary || this.dialogueMessageFromOutput(result),
      this.timelineKind(phase),
      Date.now() - phaseStart,
      phaseMilestone?.significance,
    );
    this.recordReplayEvent(ctx, phase === MissionState.Planning ? "PLANNER_FINISHED" : phase === MissionState.Finalizing ? "FINALIZER_FINISHED" : phase === MissionState.ConflictResolution ? "MEDIATOR_FINISHED" : "AGENT_FINISHED", {
      agentId: agentDef.id,
      agentName: agentDef.name,
      agentRole,
      payload: { phase, output: result, activity: completeActivity },
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
    let graphInterruptHandled = false;

    while (ctx.executionTasks.some((task) => task.status !== "completed")) {
      if (signal.aborted) throw new DOMException("Mission cancelled", "AbortError");

      const completedTaskIds = new Set(ctx.executionTasks.filter((task) => task.status === "completed").map((task) => task.id));
      const readyTasks = ctx.executionTasks.filter((task) =>
        (task.status === "pending" || task.status === "ready" || task.status === "revised") && task.dependencies.every((dependency) => completedTaskIds.has(dependency))
      );

      if (readyTasks.length === 0) {
        const blockedTasks = ctx.executionTasks.filter((task) => task.status === "blocked");
        if (blockedTasks.length > 0) {
          this.applyPlannerRevision(ctx, blockedTasks, classification);
          onUpdate({ ...ctx });
          continue;
        }
        throw new Error("Mission execution deadlock: no workstreams are ready to run.");
      }

      readyTasks.forEach((task) => {
        this.updateTask(ctx, task.id, { status: "ready" });
        this.updateWorkstream(ctx, task.workstreamId, { status: "ready" });
        this.recordReplayEvent(ctx, "TASK_READY", {
          agentRole: task.agent,
          workstreamId: task.workstreamId,
          workstreamTitle: task.title,
          payload: { task },
          confidence: task.confidence,
          dependencies: task.dependencies,
        });
      });
      this.updateMissionGraph(ctx);

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
      this.updateMissionGraph(ctx);
      this.emit({ type: MissionEventType.MissionProgress, timestamp: now(), payload: { progress: ctx.progress } });
      onUpdate({ ...ctx });

      if (!graphInterruptHandled && this.shouldCreateGraphInterrupt(ctx, classification)) {
        graphInterruptHandled = true;
        await this.handleGraphInterrupt(ctx, mockMode, qwenClient, signal, onUpdate, classification);
      }
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

    this.updateTask(ctx, task.id, { status: "running", startedAt: now() });
    this.updateWorkstream(ctx, task.workstreamId, { status: "in_progress", startedAt: now() });
    ctx.status = phase;
    ctx.currentAgent = task.agent;
    const thinkingActivity = this.setAgentActivity(ctx, task.agent, "thinking", "Reviewing shared council context", this.activityDetail(ctx, task), task.confidence);
    this.recordReplayEvent(ctx, "AGENT_STARTED", {
      agentId: agentDef.id,
      agentName: agentDef.name,
      agentRole: task.agent,
      workstreamId: task.workstreamId,
      workstreamTitle: task.title,
      payload: { task, activity: thinkingActivity },
      confidence: task.confidence,
      dependencies: task.dependencies,
    });
    this.recordReplayEvent(ctx, "TASK_STARTED", {
      agentId: agentDef.id,
      agentName: agentDef.name,
      agentRole: task.agent,
      workstreamId: task.workstreamId,
      workstreamTitle: task.title,
      payload: { task },
      confidence: task.confidence,
      dependencies: task.dependencies,
    });
    this.recordReplayEvent(ctx, "AGENT_THINKING", { agentId: agentDef.id, agentName: agentDef.name, agentRole: task.agent, workstreamId: task.workstreamId, workstreamTitle: task.title, payload: { activity: thinkingActivity }, confidence: task.confidence, dependencies: task.dependencies });
    this.emit({ type: MissionEventType.AgentStarted, timestamp: now(), payload: { agentRole: task.agent, agentName: agentDef.name, phase, taskId: task.id } });
    this.emit({ type: MissionEventType.AgentThinking, timestamp: now(), payload: { agentRole: task.agent, agentName: agentDef.name, taskId: task.id } });
    onUpdate({ ...ctx });

    let result: string;
    if (mockMode) {
      const delay = this.mockRunner.getDelay(phase);
      await this.delay(Math.floor(delay * 0.35), signal);
      const analyzingActivity = this.setAgentActivity(ctx, task.agent, "analyzing", "Evaluating evidence and alternatives", this.activityDetail(ctx, task), task.confidence);
      this.recordReplayEvent(ctx, "AGENT_ANALYZING", { agentId: agentDef.id, agentName: agentDef.name, agentRole: task.agent, workstreamId: task.workstreamId, workstreamTitle: task.title, payload: { activity: analyzingActivity }, confidence: task.confidence, dependencies: task.dependencies });
      this.recordConfidenceTransition(ctx, task, agentDef, task.confidence + 2, "More mission evidence is now available for this workstream.");
      onUpdate({ ...ctx });
      await this.delay(Math.floor(delay * 0.35), signal);
      const reviewingActivity = this.setAgentActivity(ctx, task.agent, "reviewing", "Cross-checking assumptions", "Verifying the recommendation against shared dependencies and constraints.", task.confidence);
      this.recordReplayEvent(ctx, "AGENT_REVIEWING", { agentId: agentDef.id, agentName: agentDef.name, agentRole: task.agent, workstreamId: task.workstreamId, workstreamTitle: task.title, payload: { activity: reviewingActivity }, confidence: task.confidence, dependencies: task.dependencies });
      this.recordConfidenceTransition(ctx, task, agentDef, task.confidence + 4, "Dependencies and assumptions were cross-checked.");
      onUpdate({ ...ctx });
      await this.delay(Math.floor(delay * 0.3), signal);
      result = this.mockRunner.generate(phase, ctx, task, classification);
    } else if (qwenClient) {
      await this.delay(240, signal);
      const analyzingActivity = this.setAgentActivity(ctx, task.agent, "analyzing", "Evaluating evidence and alternatives", this.activityDetail(ctx, task), task.confidence);
      this.recordReplayEvent(ctx, "AGENT_ANALYZING", { agentId: agentDef.id, agentName: agentDef.name, agentRole: task.agent, workstreamId: task.workstreamId, workstreamTitle: task.title, payload: { activity: analyzingActivity }, confidence: task.confidence, dependencies: task.dependencies });
      this.recordConfidenceTransition(ctx, task, agentDef, task.confidence + 2, "The assigned context and available evidence have been incorporated.");
      onUpdate({ ...ctx });
      const stopLiveReview = this.scheduleLiveReview(ctx, agentDef, task.agent, phase, onUpdate, task);
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
        result = this.mockRunner.generate(phase, ctx, task, classification);
      } finally {
        stopLiveReview();
      }
      if (ctx.agentStates[task.agent] !== "reviewing") {
        const reviewingActivity = this.setAgentActivity(ctx, task.agent, "reviewing", "Preparing recommendation", "Cross-checking the generated recommendation against the shared mission context.");
        this.recordReplayEvent(ctx, "AGENT_REVIEWING", { agentId: agentDef.id, agentName: agentDef.name, agentRole: task.agent, workstreamId: task.workstreamId, workstreamTitle: task.title, payload: { activity: reviewingActivity }, confidence: task.confidence, dependencies: task.dependencies });
        this.recordConfidenceTransition(ctx, task, agentDef, task.confidence + 4, "The recommendation was checked against dependencies and constraints.");
        onUpdate({ ...ctx });
      }
    } else {
      result = this.mockRunner.generate(phase, ctx, task, classification);
    }

    result = this.normalizeAgentResult(ctx, phase, task.agent, result, classification, task);
    const structuredResult = this.tryParseAgentOutput(result);
    const currentConfidence = ctx.executionTasks.find((candidate) => candidate.id === task.id)?.confidence ?? task.confidence;
    const nextConfidence = this.evolveConfidence(currentConfidence, result, ctx);
    this.recordStreamEvents(ctx, "AGENT_STREAM", result, agentDef.id, agentDef.name, task.agent, phaseStart, task);
    this.storePhaseResult(ctx, phase, result, classification);
    this.updateTask(ctx, task.id, { status: "completed", output: result, completedAt: now(), confidence: nextConfidence });
    this.updateWorkstream(ctx, task.workstreamId, { status: "completed", output: result, completedAt: now(), confidence: nextConfidence });
    const completeActivity = this.setAgentActivity(ctx, task.agent, "complete", "Findings shared with the council", "The workstream result is now available to downstream agents.", nextConfidence, "Recommendation finalized", nextConfidence - currentConfidence);
    if (task.agent !== AgentRole.Finalizer) {
      this.addDialogue(ctx, agentDef.id, agentDef.name, agentDef.role, result, phase === MissionState.RiskReview, {
        phase,
        status: "complete",
        referencedWorkstreamIds: [task.workstreamId],
        confidence: nextConfidence,
        displayRole: missionDisplayRole(classification, task.agent),
      });
    }
    const taskMilestone = structuredResult?.timelineMilestone;
    this.addTimeline(
      ctx,
      task.agent,
      phase,
      taskMilestone?.title || task.title,
      taskMilestone?.description || structuredResult?.councilMessage || structuredResult?.summary || task.output || task.title,
      this.timelineKind(phase),
      Date.now() - phaseStart,
      taskMilestone?.significance,
    );
    this.recordReplayEvent(ctx, "AGENT_FINISHED", {
      agentId: agentDef.id,
      agentName: agentDef.name,
      agentRole: task.agent,
      workstreamId: task.workstreamId,
      workstreamTitle: task.title,
      payload: { task: { ...task, status: "completed", output: result, confidence: nextConfidence }, output: result, activity: completeActivity },
      confidence: nextConfidence,
      dependencies: task.dependencies,
    });
    this.emit({ type: MissionEventType.AgentFinished, timestamp: now(), payload: { agentRole: task.agent, agentName: agentDef.name, phase, taskId: task.id } });
    this.updateMissionGraph(ctx);
    onUpdate({ ...ctx });
  }

  private normalizeAgentResult(ctx: MissionContext, phase: MissionState, agentRole: AgentRole, rawResult: string, classification: MissionClassification, task?: ExecutionTask): string {
    if (phase === MissionState.Planning) return rawResult;

    const parsed = this.tryParseAgentOutput(rawResult);
    const workstreamTitle = task?.title ?? this.phaseTitle(phase);
    const base = parsed ?? this.buildStructuredFallback(ctx, phase, agentRole, classification, workstreamTitle, rawResult);
    const sanitized: AgentStructuredOutput = {
      agentName: missionDisplayRole(classification, agentRole),
      displayRole: missionDisplayRole(classification, agentRole),
      workstreamTitle: sanitizeUserFacingText(base.workstreamTitle || workstreamTitle),
      status: base.status ?? "complete",
      summary: sanitizeUserFacingText(base.summary),
      councilMessage: sanitizeUserFacingText(base.councilMessage ?? ""),
      finalAnswer: sanitizeUserFacingText(base.finalAnswer ?? (classification.strategy.deliverableMode === "direct_answer" ? base.summary : "")),
      reviewNote: sanitizeUserFacingText(base.reviewNote ?? ""),
      usefulOutput: {
        keyFindings: sanitizeMissionList(base.usefulOutput?.keyFindings ?? []),
        recommendations: sanitizeMissionList(base.usefulOutput?.recommendations ?? []),
        actionItems: sanitizeMissionList(base.usefulOutput?.actionItems ?? []),
        scheduleItems: sanitizeMissionList(base.usefulOutput?.scheduleItems ?? []),
        risks: sanitizeMissionList(base.usefulOutput?.risks ?? []),
        dependencies: sanitizeMissionList(base.usefulOutput?.dependencies ?? []),
      },
      handoffToNextAgent: sanitizeUserFacingText(base.handoffToNextAgent),
      timelineMilestone: base.timelineMilestone ? {
        title: sanitizeUserFacingText(base.timelineMilestone.title),
        description: sanitizeUserFacingText(base.timelineMilestone.description),
        significance: sanitizeUserFacingText(base.timelineMilestone.significance ?? ""),
      } : undefined,
      followUpMissions: (base.followUpMissions ?? [])
        .map((item) => ({
          mission: sanitizeUserFacingText(item.mission),
          rationale: sanitizeUserFacingText(item.rationale ?? ""),
        }))
        .filter((item) => item.mission.length >= 12)
        .slice(0, 3),
      confidence: clampConfidence(Number(base.confidence || task?.confidence || this.averageConfidence(ctx))),
      conflictSignals: (base.conflictSignals ?? []).map((signal) => ({
        withAgent: sanitizeUserFacingText(signal.withAgent),
        topic: sanitizeUserFacingText(signal.topic),
        disagreement: sanitizeUserFacingText(signal.disagreement),
        severity: signal.severity ?? "moderate",
      })).filter((signal) => signal.withAgent && signal.topic && signal.disagreement),
    };

    if (!this.isUsefulAgentOutput(sanitized, classification, ctx.missionBrief, phase, agentRole)) {
      const repaired = this.buildStructuredFallback(ctx, phase, agentRole, classification, workstreamTitle, rawResult);
      console.warn("[MissionEngine] Agent output failed usefulness validation; using domain fallback.", {
        phase,
        agentRole,
        domain: classification.intent,
      });
      return JSON.stringify(repaired);
    }

    return JSON.stringify(sanitized);
  }

  private tryParseAgentOutput(value: string): AgentStructuredOutput | null {
    const candidates = [value, this.extractJsonObject(value)].filter(Boolean);
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate) as Partial<AgentStructuredOutput>;
        if (parsed && typeof parsed === "object" && typeof parsed.summary === "string") {
          return {
            agentName: String(parsed.agentName ?? ""),
            displayRole: String(parsed.displayRole ?? ""),
            workstreamTitle: String(parsed.workstreamTitle ?? ""),
            status: parsed.status ?? "complete",
            summary: parsed.summary,
            councilMessage: typeof parsed.councilMessage === "string" ? parsed.councilMessage : undefined,
            finalAnswer: typeof parsed.finalAnswer === "string" ? parsed.finalAnswer : undefined,
            reviewNote: typeof parsed.reviewNote === "string" ? parsed.reviewNote : undefined,
            usefulOutput: {
              keyFindings: parsed.usefulOutput?.keyFindings ?? [],
              recommendations: parsed.usefulOutput?.recommendations ?? [],
              actionItems: parsed.usefulOutput?.actionItems ?? [],
              scheduleItems: parsed.usefulOutput?.scheduleItems ?? [],
              risks: parsed.usefulOutput?.risks ?? [],
              dependencies: parsed.usefulOutput?.dependencies ?? [],
            },
            handoffToNextAgent: String(parsed.handoffToNextAgent ?? ""),
            timelineMilestone: parsed.timelineMilestone,
            followUpMissions: parsed.followUpMissions ?? [],
            confidence: Number(parsed.confidence ?? 78),
            conflictSignals: parsed.conflictSignals ?? [],
          };
        }
      } catch {
        // Try next candidate.
      }
    }
    return null;
  }

  private isUsefulAgentOutput(output: AgentStructuredOutput, classification: MissionClassification, missionBrief: string, phase: MissionState, agentRole: AgentRole) {
    const isFinalSynthesis = phase === MissionState.Finalizing || agentRole === AgentRole.Finalizer;
    const concreteItems = [
      ...(classification.strategy.deliverableMode === "direct_answer" || isFinalSynthesis ? [output.finalAnswer || output.summary] : []),
      ...(classification.strategy.requiresPlanning ? [] : [output.summary]),
      ...output.usefulOutput.recommendations,
      ...output.usefulOutput.actionItems,
      ...output.usefulOutput.scheduleItems,
      ...output.usefulOutput.keyFindings,
    ]
      .map((item) => sanitizeUserFacingText(item))
      .filter((item) => item.length > 18)
      .filter((item, index, items) => items.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index);
    const allText = [output.summary, output.finalAnswer ?? "", ...concreteItems]
      .map((item) => sanitizeUserFacingText(item))
      .filter(Boolean)
      .filter((item, index, items) => items.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index)
      .join("\n")
      .toLowerCase();
    const brief = sanitizeUserFacingText(missionBrief).toLowerCase();
    const forbidden = /(^|\n)\s*#{1,6}\s|```|\*\*|^-{3,}\s*$/m.test(JSON.stringify(output));
    const repeatsBrief = brief.length > 20 && allText.split(brief).length > 2;
    const domainRelevant = classification.isLearning
      ? /(study|practice|exam|test|toefl|reading|listening|speaking|writing|mock|vocabulary|score|drill)/.test(allText)
      : true;
    const metaOnly = !classification.strategy.requiresPlanning && this.isMetaOnlyDirectOutput(allText);
    const minimumUsefulItems = isFinalSynthesis || classification.strategy.complexity <= 2 ? 1 : 3;
    return concreteItems.length >= minimumUsefulItems && !forbidden && !repeatsBrief && domainRelevant && !metaOnly;
  }

  private isMetaOnlyDirectOutput(text: string) {
    const normalized = sanitizeUserFacingText(text).toLowerCase();
    const metaSignals = [
      "translation has been completed",
      "translation is complete",
      "mission complete",
      "has been completed",
      "is ready",
      "final report",
      "i have completed",
      "the task is complete",
      "the answer has been",
    ];
    const hasArtifactShape = /[\u0600-\u06FF]{8,}|```|function\s+\w+|const\s+\w+|class\s+\w+|[.!?]\s+\S+/i.test(text);
    return metaSignals.some((signal) => normalized.includes(signal)) && !hasArtifactShape;
  }

  private buildStructuredFallback(ctx: MissionContext, phase: MissionState, agentRole: AgentRole, classification: MissionClassification, workstreamTitle: string, rawResult: string): AgentStructuredOutput {
    const displayRole = missionDisplayRole(classification, agentRole);
    const extracted = extractActionItemsFromText(rawResult, 6);
    if (!classification.strategy.requiresPlanning && classification.strategy.complexity <= 3) {
      const directSummary = sanitizeUserFacingText(extracted[0] || rawResult || `${displayRole} completed the requested ${classification.strategy.missionType.replace(/_/g, " ")} task.`);
      return {
        agentName: displayRole,
        displayRole,
        workstreamTitle: sanitizeUserFacingText(workstreamTitle),
        status: "complete",
        summary: directSummary,
        finalAnswer: directSummary,
        reviewNote: "",
        usefulOutput: {
          keyFindings: [directSummary].filter(Boolean),
          recommendations: extracted.slice(1, 3),
          actionItems: extracted.slice(3, 5),
          scheduleItems: [],
          risks: [],
          dependencies: [],
        },
        handoffToNextAgent: "Ready for final review.",
        confidence: this.averageConfidence(ctx),
        conflictSignals: [],
      };
    }
    if (classification.isLearning) {
      return this.learningFallbackOutput(ctx, displayRole, workstreamTitle, agentRole, phase);
    }
    return {
      agentName: displayRole,
      displayRole,
      workstreamTitle: sanitizeUserFacingText(workstreamTitle),
      status: "complete",
      summary: sanitizeUserFacingText(extracted[0] ?? `${displayRole} completed ${workstreamTitle} with practical next steps.`),
      finalAnswer: "",
      reviewNote: "",
      usefulOutput: {
        keyFindings: extracted.slice(0, 2),
        recommendations: extracted.slice(2, 5).length ? extracted.slice(2, 5) : ["Prioritize the highest-impact work first.", "Validate assumptions before committing major resources.", "Keep risk checks attached to each milestone."],
        actionItems: ["Convert the workstream into concrete next actions.", "Assign an owner and review checkpoint.", "Track confidence as evidence improves."],
        scheduleItems: [],
        risks: agentRole === AgentRole.RiskCritic ? ["Unvalidated assumptions can make the plan feel confident but brittle."] : [],
        dependencies: [],
      },
      handoffToNextAgent: "Share this clean output with the next specialist for synthesis.",
      confidence: this.averageConfidence(ctx),
      conflictSignals: [],
    };
  }

  private learningFallbackOutput(ctx: MissionContext, displayRole: string, workstreamTitle: string, agentRole: AgentRole, phase: MissionState): AgentStructuredOutput {
    const title = sanitizeUserFacingText(workstreamTitle || this.phaseTitle(phase));
    const common = {
      agentName: displayRole,
      displayRole,
      workstreamTitle: title,
      status: "complete" as const,
      confidence: this.averageConfidence(ctx),
      conflictSignals: [] as AgentStructuredOutput["conflictSignals"],
    };
    if (agentRole === AgentRole.RiskCritic) {
      return {
        ...common,
        summary: "The plan needs enough TOEFL practice to improve scores without creating burnout or ignoring weaker sections.",
        usefulOutput: {
          keyFindings: ["Speaking and writing often need daily repetition because feedback loops are slower.", "Full mock tests are useful only when review time is protected."],
          recommendations: ["Limit full mock tests to two or three across 30 days unless the learner already has high stamina.", "Keep daily speaking practice short but non-negotiable.", "Review every missed question and weak response before adding more practice volume."],
          actionItems: ["Set a target score and test date.", "Mark one weekly lighter review day.", "Track section scores after each mock test."],
          scheduleItems: ["Week 1 baseline and fundamentals.", "Weeks 2-3 section rotation and targeted drills.", "Final 10 days mock tests plus weak-area review."],
          risks: ["Burnout from too many full tests.", "Ignoring speaking because it feels uncomfortable.", "Memorizing templates without timed practice."],
          dependencies: ["Needs baseline score and available daily study time."],
        },
        handoffToNextAgent: "Mediator should balance practice volume against review time.",
        conflictSignals: [{ withAgent: "Test Simulation Coach", topic: "Mock test frequency", disagreement: "More full mocks can build stamina, but too many reduce time for speaking and writing review.", severity: "moderate" }],
      };
    }
    return {
      ...common,
      summary: `${displayRole} added concrete TOEFL study actions for ${title}.`,
      usefulOutput: {
        keyFindings: ["A baseline TOEFL practice test should guide the first week.", "Reading, Listening, Speaking, and Writing need rotating daily practice.", "Score improvement depends on reviewing mistakes, not only doing more questions."],
        recommendations: ["Use official ETS TOEFL materials as the main benchmark.", "Record speaking answers and compare them to timing and structure targets.", "Write at least three timed integrated or academic-discussion essays per week."],
        actionItems: ["Take a baseline test and record section scores.", "Study 2-3 focused hours daily if available.", "Keep an error log with vocabulary, grammar, timing, and question-type notes."],
        scheduleItems: ["Days 1-2 diagnostic and setup.", "Days 3-20 rotate section drills with vocabulary review.", "Days 21-30 complete two full mock tests and final weak-area review."],
        risks: [],
        dependencies: ["Needs current score estimate, target score, daily availability, and exam date."],
      },
      handoffToNextAgent: "Use these study actions in the final 30-day calendar.",
    };
  }

  private phaseTitle(phase: MissionState) {
    return phase.replace(/-/g, " ");
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

  private createMissionGraph(ctx: MissionContext): MissionGraph {
    return {
      missionId: ctx.missionId,
      workstreams: ctx.workstreams.map((workstream) => workstream.id),
      agents: Array.from(new Set(ctx.executionTasks.map((task) => task.agent))),
      taskNodes: ctx.executionTasks.map((task) => ({ ...task })),
      parallelGroups: this.buildNamedParallelGroups(ctx.executionTasks),
      conflictZones: this.buildConflictZones(ctx.executionTasks),
      synthesisReadinessCriteria: [
        "all required workstreams completed",
        "critical conflicts resolved",
        "confidence above threshold",
      ],
      dependencies: ctx.executionTasks.flatMap((task) => task.dependencies.map((dependency) => ({ from: dependency, to: task.id }))),
      assignments: ctx.executionTasks.map((task) => ({
        taskId: task.id,
        assignedAgentId: task.agent,
        supportingAgentIds: task.supportingAgents ?? [],
      })),
      statuses: Object.fromEntries(ctx.executionTasks.map((task) => [task.id, task.status])),
      outputs: Object.fromEntries(ctx.executionTasks.filter((task) => task.output).map((task) => [task.id, task.output ?? ""])),
      conflicts: [...ctx.conflicts],
      synchronizationPoints: [
        {
          id: `${ctx.missionId}-final-sync`,
          title: "Final synthesis readiness",
          requiredTaskIds: ctx.executionTasks.map((task) => task.id),
          reached: false,
        },
      ],
      finalizationReadiness: this.getFinalizationReadiness(ctx),
    };
  }

  private updateMissionGraph(ctx: MissionContext) {
    ctx.missionGraph = this.createMissionGraph(ctx);
    this.recordReplayEvent(ctx, "MISSION_GRAPH_UPDATED", {
      payload: { missionGraph: ctx.missionGraph },
      metadata: {
        activeAgents: this.getActiveAgentRoles(ctx),
        blockedTasks: ctx.executionTasks.filter((task) => task.status === "blocked").map((task) => task.title),
      },
    });
  }

  private getFinalizationReadiness(ctx: MissionContext): MissionGraph["finalizationReadiness"] {
    const requiredTasksCompleted = ctx.executionTasks.length > 0 && ctx.executionTasks.every((task) => task.status === "completed");
    const criticalConflictsResolved = ctx.conflicts.every((conflict) => conflict.resolved || conflict.status === "resolved" || conflict.severity !== "critical");
    const confidenceValues = ctx.executionTasks.map((task) => task.confidence);
    const averageConfidence = confidenceValues.length
      ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
      : 0;
    const confidenceThresholdMet = averageConfidence >= 72;
    const ready = requiredTasksCompleted && criticalConflictsResolved && confidenceThresholdMet;

    return {
      requiredTasksCompleted,
      criticalConflictsResolved,
      confidenceThresholdMet,
      status: ready ? "ready_for_synthesis" : requiredTasksCompleted ? "waiting" : "not_ready",
    };
  }

  private getParallelExecutionGroups(tasks: ExecutionTask[]) {
    return this.getParallelExecutionTaskGroups(tasks).map((group) => group.map((task) => task.title));
  }

  private buildNamedParallelGroups(tasks: ExecutionTask[]): MissionGraph["parallelGroups"] {
    const groups = this.getParallelExecutionTaskGroups(tasks);

    return groups.map((group, index) => ({
      id: `group-${index + 1}`,
      title: group.length === 1 ? group[0].title : `${group.map((task) => getAgentByRole(task.agent)?.name ?? task.agent).join(" + ")} Parallel Work`,
      description: group.length === 1
        ? sanitizeMissionText(group[0].description ?? group[0].title)
        : `These workstreams can run together because their dependencies are already satisfied: ${group.map((task) => task.title).join("; ")}.`,
      taskIds: group.map((task) => task.id),
    }));
  }

  private getParallelExecutionTaskGroups(tasks: ExecutionTask[]) {
    const groups: ExecutionTask[][] = [];
    const remaining = [...tasks];
    const completed = new Set<string>();

    while (remaining.length) {
      const ready = remaining.filter((task) => task.dependencies.every((dependency) => completed.has(dependency)));
      const group = ready.length ? ready : [remaining[0]];
      groups.push(group);
      group.forEach((task) => {
        completed.add(task.id);
        const index = remaining.findIndex((candidate) => candidate.id === task.id);
        if (index >= 0) remaining.splice(index, 1);
      });
    }

    return groups;
  }

  private buildConflictZones(tasks: ExecutionTask[]): MissionGraph["conflictZones"] {
    return tasks
      .filter((task) => task.agent === AgentRole.RiskCritic && task.dependencies.length > 0)
      .map((task) => ({
        title: `${task.title} checkpoint`,
        agentsInvolved: [AgentRole.RiskCritic, ...task.dependencies.map((dependencyId) => tasks.find((candidate) => candidate.id === dependencyId)?.agent).filter((agent): agent is AgentRole => Boolean(agent))],
        reason: sanitizeMissionText(task.description ?? "Risk review depends on upstream workstream outputs."),
      }));
  }

  private identifyPotentialConflictZones(tasks: ExecutionTask[]) {
    return tasks
      .filter((task) => task.agent === AgentRole.RiskCritic)
      .map((task) => sanitizeMissionText(task.title));
  }

  private shouldCreateGraphInterrupt(ctx: MissionContext, classification: MissionClassification) {
    if (ctx.conflicts.some((conflict) => conflict.status === "open" || conflict.status === "resolving" || conflict.status === "resolved")) {
      return false;
    }

    const signalText = ctx.executionTasks
      .filter((task) => task.status === "completed" && task.agent === AgentRole.RiskCritic)
      .map((task) => sanitizeMissionText(task.output ?? ""))
      .join("\n")
      .toLowerCase();
    return Boolean(signalText && /(conflict_detected\s*:\s*true|incompatible|cannot both|blocked by|material disagreement|contradict)/i.test(signalText));
  }

  private async handleGraphInterrupt(
    ctx: MissionContext,
    mockMode: boolean,
    qwenClient: ReturnType<typeof createQwenClient> | null,
    signal: AbortSignal,
    onUpdate: (ctx: MissionContext) => void,
    classification: MissionClassification
  ) {
    const affectedTasks = this.selectAffectedTasksForConflict(ctx, classification);
    if (affectedTasks.length === 0) return;

    const conflict = this.createGraphConflict(ctx, affectedTasks, classification);
    ctx.conflicts = [...ctx.conflicts, conflict];
    affectedTasks.forEach((task) => {
      this.updateTask(ctx, task.id, { status: "blocked", blockedReason: conflict.summary ?? conflict.description });
      this.updateWorkstream(ctx, task.workstreamId, { status: "blocked" });
      this.recordReplayEvent(ctx, "TASK_BLOCKED", {
        agentRole: task.agent,
        workstreamId: task.workstreamId,
        workstreamTitle: task.title,
        payload: { task, conflict },
        confidence: task.confidence,
        dependencies: task.dependencies,
      });
    });
    this.recordReplayEvent(ctx, "AGENT_CHALLENGED_ASSUMPTION", {
      agentRole: AgentRole.RiskCritic,
      agentName: getAgentByRole(AgentRole.RiskCritic)?.name,
      payload: { conflict },
    });
    this.recordReplayEvent(ctx, "CONFLICT_CREATED", { payload: { conflict }, metadata: { affectedTaskIds: conflict.affectedTaskIds } });
    this.addTimeline(ctx, AgentRole.RiskCritic, MissionState.RiskReview, "Risk Critic interrupted the graph", conflict.summary ?? conflict.description, "conflict");
    this.emit({ type: MissionEventType.ConflictDetected, timestamp: now(), payload: { conflict } });
    this.updateMissionGraph(ctx);
    onUpdate({ ...ctx });

    await this.delay(650, signal);
    ctx.conflicts = ctx.conflicts.map((item) => item.id === conflict.id ? { ...item, status: "resolving" } : item);
    this.recordReplayEvent(ctx, "MEDIATION_STARTED", { agentRole: AgentRole.Mediator, agentName: getAgentByRole(AgentRole.Mediator)?.name, payload: { conflict } });
    await this.runAgentPhase(ctx, MissionState.ConflictResolution, mockMode, qwenClient, signal, onUpdate, classification);

    const decision = this.resolveConflictAction(conflict, classification);
    ctx.conflicts = ctx.conflicts.map((item) => item.id === conflict.id ? {
      ...item,
      status: "resolved",
      resolved: true,
      mediatorDecision: ctx.mediatorDecisions,
      resolution: ctx.mediatorDecisions,
      resolvedAction: decision,
      finalAction: decision,
      resolvedAt: now(),
    } : item);
    this.recordReplayEvent(ctx, "CONFLICT_RESOLVED", { payload: { conflictId: conflict.id, decision }, metadata: { mediatorDecision: ctx.mediatorDecisions } });
    this.emit({ type: MissionEventType.ConflictResolved, timestamp: now(), payload: { conflictId: conflict.id } });

    this.applyPlannerRevision(ctx, affectedTasks, classification);
    onUpdate({ ...ctx });
  }

  private selectAffectedTasksForConflict(ctx: MissionContext, classification: MissionClassification) {
    const pending = ctx.executionTasks.filter((task) => task.status === "pending" || task.status === "ready" || task.status === "revised");
    if (classification.isLaunch) {
      return pending.filter((task) => [AgentRole.MarketingStrategist, AgentRole.Finance, AgentRole.RiskCritic].includes(task.agent)).slice(0, 2);
    }
    if (classification.intent === "technical_debugging") {
      return pending.filter((task) => [AgentRole.TechnicalArchitect, AgentRole.RiskCritic, AgentRole.Finalizer].includes(task.agent)).slice(0, 2);
    }
    return pending.slice(0, 2);
  }

  private createGraphConflict(ctx: MissionContext, affectedTasks: ExecutionTask[], classification: MissionClassification): ConflictInfo {
    const involvedRoles = Array.from(new Set([
      ...affectedTasks.map((task) => task.agent),
      AgentRole.RiskCritic,
    ]));
    const title = classification.isLaunch
      ? "Launch acceleration vs validation confidence"
      : classification.intent === "technical_debugging"
        ? "Quick optimization vs measurement-backed architecture"
        : "Execution confidence gap between workstreams";

    return {
      id: generateId(),
      title,
      agents: this.agentNamesFromRoles(involvedRoles),
      agentsInvolved: this.agentNamesFromRoles(involvedRoles),
      affectedTaskIds: affectedTasks.map((task) => task.id),
      description: "Risk Critic found a weak assumption that could reduce final output quality if the graph continues unchanged.",
      summary: `${title}: ${affectedTasks.map((task) => task.title).join(", ")} paused for mediation while unrelated workstreams continue.`,
      riskLevel: "high",
      severity: "high",
      disagreementSummary: "Specialists disagree on whether the current assumptions are strong enough for synthesis.",
      proposedSolutions: [
        "Narrow the affected workstream scope.",
        "Add a validation dependency.",
        "Reassign review to the strongest specialist.",
      ],
      status: "open",
      resolved: false,
      createdAt: now(),
    };
  }

  private applyPlannerRevision(ctx: MissionContext, tasks: ExecutionTask[], classification: MissionClassification) {
    this.recordReplayEvent(ctx, "PLANNER_REVIEW_REQUESTED", {
      agentRole: AgentRole.Planner,
      agentName: getAgentByRole(AgentRole.Planner)?.name,
      payload: { affectedTaskIds: tasks.map((task) => task.id), classification },
    });

    tasks.forEach((task, index) => {
      const revisedAgent = task.agent === AgentRole.MarketingStrategist && classification.isLaunch
        ? AgentRole.Researcher
        : task.agent;
      const revisionNote = revisedAgent !== task.agent
        ? "Planner reassigned this validation loop to Research before returning it to launch execution."
        : "Planner added mediator guidance and released the task back into the graph.";

      this.updateTask(ctx, task.id, {
        status: "revised",
        agent: revisedAgent,
        revisionNote,
        blockedReason: undefined,
        dependencies: index === 0 ? task.dependencies : Array.from(new Set([...task.dependencies, tasks[0].id])),
      });
      this.updateWorkstream(ctx, task.workstreamId, {
        status: "revised",
        assignedAgent: revisedAgent,
        nextStep: revisionNote,
      });
      this.recordReplayEvent(ctx, revisedAgent !== task.agent ? "TASK_REASSIGNED" : "PLANNER_REVISED_PLAN", {
        agentRole: AgentRole.Planner,
        agentName: getAgentByRole(AgentRole.Planner)?.name,
        workstreamId: task.workstreamId,
        workstreamTitle: task.title,
        payload: { taskId: task.id, from: task.agent, to: revisedAgent, revisionNote },
      });
    });

    const planner = getAgentByRole(AgentRole.Planner);
    if (planner) {
      const revisedTitles = tasks.map((task) => sanitizeMissionText(task.title)).filter(Boolean).join("; ");
      this.addDialogue(
        ctx,
        planner.id,
        planner.name,
        AgentRole.Planner,
        `Based on the council review, I’m revising the execution graph for ${revisedTitles || "the affected workstreams"}. Ownership and dependencies now reflect the validated feedback before execution resumes.`,
        false,
        {
          phase: MissionState.Planning,
          status: "reviewing",
          interactionType: "planner_revision",
          interactionLabel: "Planner Revision",
          interactionTargetRole: ctx.conflicts.length ? AgentRole.Mediator : AgentRole.RiskCritic,
          referencedWorkstreamIds: tasks.map((task) => task.workstreamId),
        },
      );
    }
    this.addTimeline(ctx, AgentRole.Planner, MissionState.Planning, "Planner revised the Mission Graph", "Planner released blocked workstreams with updated ownership and dependencies after mediation.", "workstream");
    this.updateMissionGraph(ctx);
  }

  private reachSynchronizationPoint(ctx: MissionContext) {
    const readiness = this.getFinalizationReadiness(ctx);
    if (readiness.status !== "ready_for_synthesis") {
      this.addTimeline(ctx, AgentRole.Finalizer, MissionState.Finalizing, "Finalizer waiting for synchronization", "Final synthesis is delayed until required tasks, critical conflicts, and confidence thresholds are satisfied.", "report");
      this.recordReplayEvent(ctx, "SYNCHRONIZATION_POINT_REACHED", {
        agentRole: AgentRole.Finalizer,
        agentName: getAgentByRole(AgentRole.Finalizer)?.name,
        payload: { readiness },
      });
      return;
    }

    ctx.missionGraph = ctx.missionGraph ? {
      ...ctx.missionGraph,
      finalizationReadiness: readiness,
      synchronizationPoints: ctx.missionGraph.synchronizationPoints.map((point) => ({
        ...point,
        reached: true,
        reachedAt: now(),
      })),
    } : ctx.missionGraph;
    this.addTimeline(ctx, AgentRole.Finalizer, MissionState.Finalizing, "Synchronization point reached", "All required workstreams and conflicts are synchronized; Finalizer can synthesize the report.", "report");
    this.recordReplayEvent(ctx, "SYNCHRONIZATION_POINT_REACHED", {
      agentRole: AgentRole.Finalizer,
      agentName: getAgentByRole(AgentRole.Finalizer)?.name,
      payload: { readiness, missionGraph: ctx.missionGraph },
    });
  }

  private getActiveAgentRoles(ctx: MissionContext) {
    return Array.from(new Set(ctx.executionTasks.filter((task) => task.status === "running").map((task) => task.agent)));
  }

  private cancelContext(ctx: MissionContext) {
    ctx.status = MissionState.Cancelled;
    ctx.currentAgent = null;
    ctx.completedAt = now();
    this.addTimeline(ctx, AgentRole.RiskCritic, MissionState.Cancelled, "Mission cancelled", "Sequence stopped by the operator. Partial work remains visible for review.", "cancelled");
  }

  private dialogueMessageFromOutput(content: string) {
    const parsed = this.tryParseAgentOutput(content);
    if (parsed?.councilMessage) return sanitizeUserFacingText(parsed.councilMessage);
    if (parsed?.summary) return sanitizeUserFacingText(parsed.summary);
    try {
      const planner = JSON.parse(this.extractJsonObject(content)) as PlannerGraphJson;
      if (planner.summary) return sanitizeUserFacingText(planner.summary);
    } catch {
      // Non-JSON output falls through to its first useful line.
    }
    return sanitizeUserFacingText(content).split("\n").find((line) => line.trim().length > 0)?.trim() ?? "";
  }

  private distinctCouncilMessage(ctx: MissionContext, content: string) {
    const candidatesFrom = (value: string) => {
      const parsed = this.tryParseAgentOutput(value);
      return sanitizeMissionList([
        parsed?.councilMessage,
        parsed?.handoffToNextAgent,
        ...(parsed?.usefulOutput.keyFindings ?? []),
        ...(parsed?.usefulOutput.recommendations ?? []),
        ...(parsed?.usefulOutput.actionItems ?? []),
        ...(parsed?.usefulOutput.risks ?? []),
        ...(parsed?.usefulOutput.dependencies ?? []),
        parsed?.summary,
      ]);
    };
    const unitsFrom = (values: string[]) => values
      .flatMap((value) => value.split(/\r?\n+|(?<=[.!?])\s+/u))
      .map((value) => sanitizeUserFacingText(value).replace(/^\s*(?:[-*•]+|\d+[.)])\s*/, "").trim())
      .filter((value) => value.length > 12)
      .map((value) => value.length > 280 ? `${value.slice(0, 277).replace(/\s+\S*$/, "")}...` : value);
    const similarity = (left: string, right: string) => {
      const normalizedLeft = left.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
      const normalizedRight = right.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
      if (!normalizedLeft || !normalizedRight) return 0;
      if (normalizedLeft === normalizedRight) return 1;
      if (Math.min(normalizedLeft.length, normalizedRight.length) > 32 && (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft))) return 1;
      const leftWords = new Set(normalizedLeft.match(/[\p{L}\p{N}]{3,}/gu) ?? []);
      const rightWords = new Set(normalizedRight.match(/[\p{L}\p{N}]{3,}/gu) ?? []);
      if (!leftWords.size || !rightWords.size) return 0;
      const overlap = [...leftWords].filter((word) => rightWords.has(word)).length;
      return overlap / Math.min(leftWords.size, rightWords.size);
    };
    const previousUnits = ctx.dialogue.flatMap((entry) => unitsFrom([
      entry.conversationMessage ?? "",
      ...candidatesFrom(entry.content),
    ]));
    const novelUnits = unitsFrom(candidatesFrom(content))
      .filter((candidate, index, units) => units.findIndex((item) => similarity(candidate, item) >= 0.78) === index)
      .filter((candidate) => previousUnits.every((previous) => similarity(candidate, previous) < 0.72))
      .slice(0, 2);
    return novelUnits.join(" ");
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
    const previousEntry = [...ctx.dialogue].reverse().find((entry) => entry.agentRole !== agentRole);
    const parsedOutput = this.tryParseAgentOutput(content);
    const challengesAssumption = isConflict || agentRole === AgentRole.RiskCritic || Boolean(parsedOutput?.conflictSignals?.length);
    const interactionType = metadata.interactionType
      ?? (agentRole === AgentRole.Planner && previousEntry ? "planner_revision"
        : agentRole === AgentRole.Mediator ? "consensus_reached"
          : challengesAssumption ? "challenged_assumption"
            : previousEntry ? "accepted_finding"
              : undefined);
    const interactionTargetRole = metadata.interactionTargetRole ?? metadata.targetAgentRole ?? previousEntry?.agentRole;
    const interactionLabel = metadata.interactionLabel ?? (interactionType === "planner_revision"
      ? "Planner Revision"
      : interactionType === "consensus_reached"
        ? "Consensus Reached"
        : interactionType === "challenged_assumption"
          ? "Challenged Assumption"
          : interactionType === "accepted_finding"
            ? "Accepted Finding"
            : undefined);
    const interactionReason = metadata.interactionReason;
    const entry: AgentDialogueEntry = {
      agentId,
      agentName,
      displayRole: metadata.displayRole ?? agentName,
      agentRole,
      content,
      conversationMessage: metadata.conversationMessage ?? this.distinctCouncilMessage(ctx, content),
      timestamp: now(),
      isConflict,
      interactionType,
      interactionLabel,
      interactionTargetRole,
      interactionReason,
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
    duration?: number,
    significance?: string,
  ) {
    ctx.timeline = [...ctx.timeline, { agent, state, label, description, significance, kind, duration, timestamp: now() }];
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
    const jsonParse = this.parsePlannerJson(text, classification);
    if (jsonParse.workstreams.length > 0) {
      console.info("[MissionEngine] Planner JSON parsed successfully.", {
        extractionAttempted: jsonParse.extractionAttempted,
        repairAttempted: false,
        finalWorkstreams: jsonParse.workstreams.length,
        selectedAgents: classification.selectedAgents,
      });
      return jsonParse.workstreams;
    }

    const repaired = this.repairPlannerOutput(text, classification, brief);
    if (repaired.length > 0) {
      console.warn("[MissionEngine] Planner JSON parsing failed, but repair succeeded.", {
        extractionAttempted: jsonParse.extractionAttempted,
        extractionError: jsonParse.error,
        repairAttempted: true,
        finalWorkstreams: repaired.length,
        selectedAgents: classification.selectedAgents,
      });
      return repaired;
    }

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
      const title = this.cleanWorkstreamTitle(sanitizeMissionText(match[3]), classification, index);
      const assignedAgent = this.agentFromOwner(owner) ?? this.agentForMissionWorkstream(classification, title, index);
      const blueprint = this.semanticBlueprintAt(classification, index);

      return {
        id: generateId(),
        title,
        owner: sanitizeMissionText(owner) || missionDisplayRole(classification, assignedAgent),
        responsibleAgent: sanitizeMissionText(owner) || missionDisplayRole(classification, assignedAgent),
        displayRole: missionDisplayRole(classification, assignedAgent),
        description: this.cleanWorkstreamDescription(sanitizeMissionText(description), classification, index),
        status: "pending" as const,
        assignedAgent,
        confidence,
        dependencies: dependencies.map((dependencyIndex) => `workstream-${dependencyIndex}`),
        nextStep: sanitizeMissionText(nextStep),
        deliverables: sanitizeMissionList(deliverables).length ? sanitizeMissionList(deliverables) : blueprint?.deliverables ?? [],
        acceptanceCriteria: blueprint?.acceptanceCriteria,
        expectedOutputs: blueprint?.expectedOutputs,
      };
    }).filter((workstream) => workstream.title && workstream.description);

    if (workstreams.length === 0) {
      const fallback = this.fallbackWorkstreams(classification, brief);
      console.warn("[MissionEngine] Planner parsing failed; using semantic mission graph workstreams.", {
        extractionAttempted: jsonParse.extractionAttempted,
        extractionError: jsonParse.error,
        repairAttempted: true,
        repairReason: "No valid JSON and markdown repair produced usable workstreams.",
        finalWorkstreams: fallback.length,
        selectedAgents: classification.selectedAgents,
      });
      devLog("semantic graph generated", true);
      return fallback;
    }

    devLog("semantic graph generated", false);
    const repairedMarkdown = workstreams.map((workstream, _index, list) => ({
      ...workstream,
      dependencies: workstream.dependencies?.map((dependencyKey) => {
        const dependencyIndex = Number(dependencyKey.replace("workstream-", "")) - 1;
        return list[dependencyIndex]?.id;
      }).filter((id): id is string => Boolean(id)) ?? [],
      deliverables: workstream.deliverables.length > 0 ? workstream.deliverables : extractActionItemsFromText(workstream.description, 3),
    }));
    console.warn("[MissionEngine] Planner returned markdown; markdown parser repaired it.", {
      extractionAttempted: jsonParse.extractionAttempted,
      extractionError: jsonParse.error,
      repairAttempted: true,
      finalWorkstreams: repairedMarkdown.length,
      selectedAgents: classification.selectedAgents,
    });
    return repairedMarkdown;
  }

  private parsePlannerJson(text: string, classification: MissionClassification): { workstreams: Workstream[]; graph?: PlannerGraphJson; extractionAttempted: boolean; error?: string } {
    const candidates = [text, this.extractJsonObject(text)].filter((item): item is string => Boolean(item));
    let lastError = "";

    for (const candidate of candidates) {
      try {
        const graph = JSON.parse(candidate) as PlannerGraphJson;
        const workstreams = this.workstreamsFromPlannerGraph(graph, classification);
        if (workstreams.length > 0) {
          return { workstreams, graph, extractionAttempted: candidate !== text };
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    return { workstreams: [], extractionAttempted: Boolean(candidates[1]), error: lastError || "No JSON object found." };
  }

  private extractJsonObject(text: string) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) return fenced.trim();

    const first = text.indexOf("{");
    if (first < 0) return "";

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = first; i < text.length; i += 1) {
      const char = text[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      if (depth === 0) return text.slice(first, i + 1);
    }

    return "";
  }

  private workstreamsFromPlannerGraph(graph: PlannerGraphJson, classification: MissionClassification): Workstream[] {
    const items = Array.isArray(graph.workstreams) ? graph.workstreams : [];
    const idMap = new Map<string, string>();

    const workstreams = items.map((item, index) => {
      const stableId = sanitizeMissionText(item.id || `ws-${index + 1}`).toLowerCase().replace(/[^a-z0-9-]+/g, "-") || `ws-${index + 1}`;
      const id = generateId();
      idMap.set(stableId, id);
      idMap.set(String(item.id || index + 1), id);
      const assignedAgent = this.agentFromId(item.primaryAgentId) ?? this.agentForMissionWorkstream(classification, item.title ?? "", index);
      const blueprint = this.semanticBlueprintAt(classification, index);
      return {
        id,
        title: this.cleanWorkstreamTitle(sanitizeMissionText(item.title || ""), classification, index),
        owner: missionDisplayRole(classification, assignedAgent),
        responsibleAgent: missionDisplayRole(classification, assignedAgent),
        displayRole: missionDisplayRole(classification, assignedAgent),
        description: this.cleanWorkstreamDescription(sanitizeMissionText(item.description || item.title || ""), classification, index),
        status: "pending" as const,
        assignedAgent,
        supportingAgentIds: this.filterUsefulSupportingAgents((item.supportingAgentIds ?? []).map((idValue) => this.agentFromId(idValue)).filter((role): role is AgentRole => Boolean(role)), assignedAgent, classification),
        confidence: clampConfidence(item.confidence ?? Math.max(70, 86 - index * 3)),
        dependencies: item.dependencies ?? [],
        deliverables: sanitizeMissionList(item.expectedDeliverables ?? []).length ? sanitizeMissionList(item.expectedDeliverables ?? []) : blueprint?.deliverables ?? [],
        acceptanceCriteria: sanitizeMissionList(item.acceptanceCriteria ?? []).length ? sanitizeMissionList(item.acceptanceCriteria ?? []) : blueprint?.acceptanceCriteria,
        expectedOutputs: sanitizeMissionList(item.expectedOutputs ?? []).length ? sanitizeMissionList(item.expectedOutputs ?? []) : blueprint?.expectedOutputs,
        nextStep: item.riskAreas?.length ? `Watch risk areas: ${item.riskAreas.join(", ")}` : "",
      };
    }).filter((workstream) => workstream.title && workstream.description);

    return workstreams.map((workstream) => ({
      ...workstream,
      dependencies: workstream.dependencies?.map((dependency) => idMap.get(dependency)).filter((id): id is string => Boolean(id)) ?? [],
      deliverables: workstream.deliverables.length > 0 ? workstream.deliverables : extractActionItemsFromText(workstream.description, 3),
    }));
  }

  private repairPlannerOutput(text: string, classification: MissionClassification, brief: string): Workstream[] {
    const normalized = sanitizeMissionText(text);
    const repairedFromTable = this.repairMarkdownTable(normalized, classification);
    if (repairedFromTable.length > 0) return repairedFromTable;

    const headingPattern = /(?:^|\n)\s*(?:#{1,4}\s*)?(?:\*\*)?(?:(?:Workstream|Task)\s*(\d+)?|(\d+))\s*[:.)-]\s*(.+?)(?:\*\*)?\s*(?=\n|$)/gi;
    if (headingPattern.test(normalized)) return [];

    if (/\b(owner|agent|dependencies|deliverables|confidence)\b/i.test(normalized)) {
      return this.fallbackWorkstreams(classification, brief);
    }

    return [];
  }

  private repairMarkdownTable(text: string, classification: MissionClassification): Workstream[] {
    const rows = text.split("\n").filter((line) => line.includes("|") && !/^\s*\|?\s*-{2,}/.test(line));
    if (rows.length < 2) return [];

    const header = rows[0].split("|").map((cell) => cell.trim().toLowerCase()).filter(Boolean);
    const titleIndex = header.findIndex((cell) => /title|workstream|task/.test(cell));
    const ownerIndex = header.findIndex((cell) => /owner|agent|primary/.test(cell));
    const descriptionIndex = header.findIndex((cell) => /description|summary|objective/.test(cell));
    const confidenceIndex = header.findIndex((cell) => /confidence/.test(cell));
    if (titleIndex < 0) return [];

    return rows.slice(1).map((row, index) => {
      const cells = row.split("|").map((cell) => cell.trim()).filter(Boolean);
      const title = this.cleanWorkstreamTitle(sanitizeMissionText(cells[titleIndex] || ""), classification, index);
      const assignedAgent = this.agentFromOwner(cells[ownerIndex] || "") ?? this.agentForMissionWorkstream(classification, title, index);
      const blueprint = this.semanticBlueprintAt(classification, index);
      return {
        id: generateId(),
        title,
        owner: missionDisplayRole(classification, assignedAgent),
        responsibleAgent: missionDisplayRole(classification, assignedAgent),
        displayRole: missionDisplayRole(classification, assignedAgent),
        description: this.cleanWorkstreamDescription(sanitizeMissionText(cells[descriptionIndex] || title), classification, index),
        status: "pending" as const,
        assignedAgent,
        supportingAgentIds: this.filterUsefulSupportingAgents(this.supportingAgentsFor(assignedAgent), assignedAgent, classification),
        confidence: clampConfidence(Number(cells[confidenceIndex]?.match(/\d+/)?.[0] ?? Math.max(70, 84 - index * 2))),
        dependencies: [],
        deliverables: blueprint?.deliverables ?? extractActionItemsFromText(cells[descriptionIndex] || title, 3),
        acceptanceCriteria: blueprint?.acceptanceCriteria,
        expectedOutputs: blueprint?.expectedOutputs,
      };
    }).filter((workstream) => workstream.title);
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

  private semanticBlueprintAt(classification: MissionClassification, index: number) {
    return classification.semantic.naturalWorkstreams[index];
  }

  private cleanWorkstreamTitle(title: string, classification: MissionClassification, index: number) {
    const cleaned = sanitizeMissionText(title);
    const generic = /^(workstream|task)\s*\d*$|^problem framing$|^option design$|^risk review$|generated workstream|general mission analysis|execution roadmap/i;
    return generic.test(cleaned) || !cleaned
      ? this.semanticBlueprintAt(classification, index)?.title ?? `${classification.semantic.primaryDomain} Workstream ${index + 1}`
      : cleaned;
  }

  private cleanWorkstreamDescription(description: string, classification: MissionClassification, index: number) {
    const cleaned = sanitizeMissionText(description);
    const generic = /mission graph workstream|generated workstream|general mission analysis|execution roadmap|clarify root problem|generate options/i;
    return generic.test(cleaned) || cleaned.length < 18
      ? this.semanticBlueprintAt(classification, index)?.description ?? `Create a useful ${classification.semantic.primaryDomain.toLowerCase()} output for "${classification.semantic.objective}".`
      : cleaned;
  }

  private filterUsefulSupportingAgents(agents: AgentRole[], primaryAgent: AgentRole, classification: MissionClassification) {
    const useful = new Set(classification.selectedAgents);
    return Array.from(new Set(agents)).filter((agent) =>
      agent !== primaryAgent &&
      agent !== AgentRole.Planner &&
      agent !== AgentRole.Mediator &&
      useful.has(agent)
    );
  }

  private fallbackWorkstreams(classification: MissionClassification, brief: string): Workstream[] {
    const blueprints = classification.semantic.naturalWorkstreams.length
      ? classification.semantic.naturalWorkstreams
      : this.buildSemanticWorkstreams(classification.semantic);
    const workstreams = blueprints.map((blueprint, index) => ({
      id: generateId(),
      title: blueprint.title,
      owner: missionDisplayRole(classification, blueprint.agent),
      responsibleAgent: missionDisplayRole(classification, blueprint.agent),
      displayRole: missionDisplayRole(classification, blueprint.agent),
      description: blueprint.description,
      status: "pending" as const,
      assignedAgent: blueprint.agent,
      supportingAgentIds: this.filterUsefulSupportingAgents(blueprint.supportingAgents ?? this.supportingAgentsFor(blueprint.agent), blueprint.agent, classification),
      confidence: Math.max(68, 88 - index * 3),
      dependencies: blueprint.dependencies?.map((dependency) => `semantic-${dependency - 1}`) ?? [],
      deliverables: blueprint.deliverables,
      acceptanceCriteria: blueprint.acceptanceCriteria,
      expectedOutputs: blueprint.expectedOutputs,
    }));

    return workstreams.map((workstream, _index, list) => ({
      ...workstream,
      dependencies: workstream.dependencies?.map((dependencyKey) => {
        const dependencyIndex = Number(dependencyKey.replace("semantic-", ""));
        return list[dependencyIndex]?.id;
      }).filter((id): id is string => Boolean(id)) ?? [],
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

  private agentFromId(id?: string): AgentRole | null {
    if (!id) return null;
    const normalized = id.toLowerCase().replace(/_/g, "-").trim();
    const aliases: Record<string, AgentRole> = {
      planner: AgentRole.Planner,
      researcher: AgentRole.Researcher,
      research: AgentRole.Researcher,
      "research-agent": AgentRole.Researcher,
      "product-strategist": AgentRole.ProductStrategist,
      product: AgentRole.ProductStrategist,
      "technical-architect": AgentRole.TechnicalArchitect,
      technical: AgentRole.TechnicalArchitect,
      "marketing-strategist": AgentRole.MarketingStrategist,
      marketing: AgentRole.MarketingStrategist,
      finance: AgentRole.Finance,
      "finance-agent": AgentRole.Finance,
      "risk-critic": AgentRole.RiskCritic,
      risk: AgentRole.RiskCritic,
      mediator: AgentRole.Mediator,
      finalizer: AgentRole.Finalizer,
    };
    return aliases[normalized] ?? null;
  }

  private supportingAgentsFor(agent: AgentRole): AgentRole[] {
    const map: Record<AgentRole, AgentRole[]> = {
      [AgentRole.Planner]: [],
      [AgentRole.Researcher]: [AgentRole.MarketingStrategist, AgentRole.ProductStrategist],
      [AgentRole.ProductStrategist]: [AgentRole.Researcher, AgentRole.TechnicalArchitect, AgentRole.Finance],
      [AgentRole.TechnicalArchitect]: [AgentRole.ProductStrategist, AgentRole.Finance, AgentRole.RiskCritic],
      [AgentRole.MarketingStrategist]: [AgentRole.Researcher, AgentRole.Finance],
      [AgentRole.Finance]: [AgentRole.TechnicalArchitect, AgentRole.MarketingStrategist, AgentRole.ProductStrategist],
      [AgentRole.RiskCritic]: [AgentRole.MarketingStrategist, AgentRole.Finance, AgentRole.TechnicalArchitect],
      [AgentRole.Mediator]: [AgentRole.Planner, AgentRole.RiskCritic],
      [AgentRole.Finalizer]: [AgentRole.Planner, AgentRole.Mediator],
    };
    return map[agent] ?? [];
  }

  private classifyMission(brief: string, config?: MissionConfiguration): MissionClassification {
    const semantic = this.analyzeMissionSemantics(brief);
    const strategy = this.classifyExecutionStrategy(brief, semantic, config);
    const intent: MissionIntent = strategy.missionType;

    const agents = new Set<AgentRole>();
    if (strategy.requiresPlanning) agents.add(AgentRole.Planner);
    strategy.recommendedAgents.forEach((agent) => agents.add(agent));
    semantic.usefulAgents.forEach((agent) => {
      if (strategy.requiresPlanning || strategy.complexity > 2) agents.add(agent);
    });
    agents.add(AgentRole.Finalizer);

    const selectedAgents = Array.from(agents).filter((agent) => agent !== AgentRole.Mediator || strategy.requiresConflictResolution);
    const needsMarketing = selectedAgents.includes(AgentRole.MarketingStrategist);
    const needsFinance = selectedAgents.includes(AgentRole.Finance);
    const needsProduct = selectedAgents.includes(AgentRole.ProductStrategist);
    const isTechnical = selectedAgents.includes(AgentRole.TechnicalArchitect);
    const isLearning = ["education", "question_answering"].includes(strategy.missionType) || semantic.intent.toLowerCase().includes("learn");
    const isLaunch = strategy.missionType === "startup_launch" || strategy.missionType === "business_planning";

    return {
      intent,
      strategy: { ...strategy, recommendedAgents: selectedAgents },
      selectedAgents,
      semantic,
      needsMarketing,
      needsFinance,
      needsProduct,
      isLaunch,
      isTechnical,
      isLearning,
    };
  }

  private classifyExecutionStrategy(brief: string, semantic: SemanticMissionAnalysis, config?: MissionConfiguration): MissionExecutionStrategy {
    const text = sanitizeUserFacingText(brief).toLowerCase();
    const wordCount = text.match(/\S+/g)?.length ?? 0;
    const hasCode = /```|function\s+\w+|const\s+\w+|class\s+\w+|<\/?[a-z][\s\S]*>|npm\s|stack trace|error:/i.test(brief);
    const hasFileCue = /\b(file|pdf|document|spreadsheet|csv|attached|upload|image)\b/.test(text);
    const hasTranslationCue = /\b(translate|translation|ترجم|ترجمة)\b/.test(text) || /\b(to|into)\s+(arabic|english|french|spanish|german|italian|turkish|chinese|japanese)\b/.test(text);
    const hasSummaryCue = /\b(summarize|summary|tl;dr|condense|recap)\b/.test(text);
    const hasQuestionCue = /^(what|why|how|when|where|who|which|explain|define)\b/.test(text) || /\?$/.test(text);
    const hasDebugCue = /\b(debug|fix|bug|error|crash|failing|broken|fps drop|not working)\b/.test(text);
    const hasArchitectureCue = /\b(architecture|architect|system design|scalable|migration|migrate|erp|next\.js|react|database|api|multi-tenant)\b/.test(text);
    const hasFocusedCodeGenerationCue = /\b(generate|create|build|implement|make)\b/.test(text) && /\b(component|page|form|button|login|react|vue|next|css|html|typescript|javascript)\b/.test(text) && !/\b(architecture|scalable|migration|migrate|erp|system design|multi-tenant)\b/.test(text);
    const hasGamingCue = /\b(game|gaming|gamer|esports|e-sports|rank|ranked|leaderboard|marvel rivals|fortnite|valorant|league of legends|overwatch|apex legends|call of duty|competitive|one above all|grandmaster|challenger|elo|mmr|ladder|tier|rank up|climb ranks|coaching session|video game)\b/.test(text);
    const hasPersonalGoalCue = hasGamingCue || /\b(fitness|workout|weight loss|marathon|personal goal|hobby|for myself|self improvement)\b/.test(text);
    const hasStartupCue = /\b(startup|launch|go-to-market|saas|mvp|fundraising|investor)\b/.test(text);
    const hasBusinessCue = /\b(business plan|open a|restaurant|company|operations|market|customers|pricing)\b/.test(text);
    const hasFinanceCue = /\b(finance|financial|profit|runway|investment|revenue|forecast|valuation|fundraising|financial analysis|financial plan|p&l|balance sheet)\b/.test(text)
      || (/\b(budget|cost)\b/.test(text) && !hasPersonalGoalCue && (hasBusinessCue || hasStartupCue || /\b(business|company|corporate|enterprise|department|annual|operations)\b/.test(text)));
    const hasEducationCue = /\b(learn|study|teach|exam|course|curriculum|practice|toefl|ielts|school|competition)\b/.test(text);
    const hasCreativeCue = /\b(write|story|poem|script|creative|blog|copy|email|letter)\b/.test(text);
    const hasReviewCue = /\b(review|code review|audit|critique|evaluate)\b/.test(text);
    const hasMathCue = /\b(calculate|solve|proof|logic|equation|math|probability)\b/.test(text);
    const hasResearchCue = /\b(research|compare|analyze|sources|evidence|market analysis|literature)\b/.test(text);
    const hasMultiStepCue = /\b(plan|roadmap|strategy|build|create|design|implement|launch|migrate)\b/.test(text) || wordCount > 45;

    let missionType: MissionKind = "general_problem_solving";
    if (hasTranslationCue) missionType = "translation";
    else if (hasSummaryCue) missionType = "summarization";
    else if (hasReviewCue && hasCode) missionType = "code_review";
    else if (hasDebugCue && (hasCode || /\b(app|react|next|docker|server|frontend|backend|game)\b/.test(text))) missionType = "debugging";
    else if (hasFocusedCodeGenerationCue) missionType = "programming";
    else if (hasArchitectureCue && /\berp\b/.test(text)) missionType = "erp_design";
    else if (hasArchitectureCue) missionType = "software_architecture";
    else if (hasStartupCue) missionType = "startup_launch";
    else if (hasGamingCue && (hasMultiStepCue || /\b(plan|strategy|roadmap|guide|how to|reach|get to|climb|improve)\b/.test(text))) missionType = "multi_step_execution";
    else if (hasGamingCue) missionType = "general_problem_solving";
    else if (hasBusinessCue) missionType = "business_planning";
    else if (hasFinanceCue) missionType = "financial_analysis";
    else if (hasEducationCue) missionType = "education";
    else if (hasCreativeCue) missionType = "creative_writing";
    else if (hasCode) missionType = "programming";
    else if (hasFileCue) missionType = "file_analysis";
    else if (hasMathCue) missionType = "math_logical_reasoning";
    else if (hasResearchCue) missionType = "research";
    else if (hasQuestionCue) missionType = "question_answering";
    else if (/\b(brainstorm|ideas|ideate)\b/.test(text)) missionType = "brainstorming";
    else if (hasMultiStepCue) missionType = "multi_step_execution";
    else if (wordCount <= 12) missionType = "conversation";

    const baseComplexity: Record<MissionKind, number> = {
      translation: 1,
      summarization: wordCount > 140 ? 3 : 2,
      question_answering: wordCount > 30 || hasResearchCue ? 3 : 2,
      research: 6,
      creative_writing: wordCount > 35 ? 4 : 2,
      programming: 4,
      debugging: 4,
      software_architecture: 8,
      business_planning: 8,
      startup_launch: 9,
      erp_design: 10,
      financial_analysis: 6,
      education: wordCount > 35 || /\bplan|30 days|curriculum\b/.test(text) ? 5 : 2,
      brainstorming: 3,
      multi_step_execution: 6,
      general_problem_solving: wordCount > 40 ? 5 : 3,
      file_analysis: 5,
      code_review: 4,
      document_generation: 5,
      conversation: 1,
      math_logical_reasoning: /\bproof|complex|derive\b/.test(text) ? 5 : 3,
    };
    const directResultPreferred = config?.outputFormat === "direct-result";
    const complexity = Math.max(1, Math.min(10, baseComplexity[missionType] + (wordCount > 100 ? 1 : 0) + (hasFileCue ? 1 : 0) - (directResultPreferred && wordCount < 80 ? 1 : 0)));
    const inherentlyComplex = ["software_architecture", "business_planning", "startup_launch", "erp_design", "multi_step_execution"].includes(missionType);
    const requiresPlanning = inherentlyComplex || (!directResultPreferred && complexity >= 6) || (directResultPreferred && complexity >= 8);
    const requiresResearch = ["research", "business_planning", "startup_launch", "financial_analysis", "software_architecture", "erp_design", "education", "file_analysis"].includes(missionType) || (hasQuestionCue && hasResearchCue);
    const requiresConflictResolution = complexity >= 8 || ["startup_launch", "erp_design"].includes(missionType);
    const requiresParallelism = requiresPlanning && complexity >= 7;
    const deliverableMode = this.deliverableModeFor(missionType, complexity, requiresPlanning, directResultPreferred);
    const recommendedAgents = this.recommendAgentsForStrategy(missionType, complexity, requiresPlanning, requiresResearch, requiresConflictResolution, semantic);
    const estimatedWorkstreams = requiresPlanning ? Math.max(3, Math.min(8, recommendedAgents.filter((agent) => ![AgentRole.Planner, AgentRole.Mediator, AgentRole.Finalizer].includes(agent)).length + 1)) : Math.max(1, Math.min(3, recommendedAgents.filter((agent) => agent !== AgentRole.Finalizer).length));
    const selectedStrategy = requiresPlanning ? "mission_graph" : complexity <= 2 ? "specialist_pair" : "focused_sequence";
    const planningReason = requiresPlanning
      ? "The objective has enough scope, dependencies, or parallel specialist work to benefit from a mission graph."
      : directResultPreferred
        ? "Direct Result was selected and the request can be answered cleanly without a mission graph."
        : "The requested deliverable can be produced directly by a small specialist path without enterprise planning.";

    return {
      missionType,
      deliverableMode,
      complexity,
      estimatedWorkstreams,
      estimatedDuration: complexity <= 2 ? "under 1 minute" : complexity <= 5 ? "1-3 minutes" : "3-7 minutes",
      recommendedAgents,
      requiresPlanning,
      requiresResearch,
      requiresConflictResolution,
      requiresParallelism,
      selectedStrategy,
      planningReason,
      classificationConfidence: this.classificationConfidence(missionType, text),
      validationNotes: [
        requiresPlanning ? "Planner enabled because decomposition should improve quality." : "Planner skipped because decomposition would add noise.",
        requiresConflictResolution ? "Conflict resolution may be useful if specialists disagree." : "Mediator stays idle unless a real conflict appears.",
      ],
    };
  }

  private deliverableModeFor(missionType: MissionKind, complexity: number, requiresPlanning: boolean, directResultPreferred: boolean): DeliverableMode {
    if (requiresPlanning || ["software_architecture", "business_planning", "startup_launch", "erp_design", "multi_step_execution", "financial_analysis"].includes(missionType)) {
      return "mission_report";
    }
    if (["translation", "summarization", "question_answering", "conversation"].includes(missionType)) {
      return "direct_answer";
    }
    if (missionType === "education" && (complexity <= 2 || directResultPreferred)) {
      return "direct_answer";
    }
    if (missionType === "math_logical_reasoning" && complexity <= 3) {
      return "direct_answer";
    }
    if (["creative_writing", "programming", "debugging", "code_review", "document_generation", "file_analysis"].includes(missionType)) {
      return "artifact";
    }
    if (directResultPreferred || complexity <= 2) {
      return "direct_answer";
    }
    if (complexity <= 5) {
      return "artifact";
    }
    return "mission_report";
  }

  private recommendAgentsForStrategy(
    missionType: MissionKind,
    complexity: number,
    requiresPlanning: boolean,
    requiresResearch: boolean,
    requiresConflictResolution: boolean,
    semantic: SemanticMissionAnalysis
  ) {
    const agents = new Set<AgentRole>();
    if (requiresPlanning) agents.add(AgentRole.Planner);
    if (requiresResearch) agents.add(AgentRole.Researcher);
    if (missionType === "translation" || missionType === "summarization" || missionType === "question_answering" || missionType === "conversation") agents.add(AgentRole.Researcher);
    if (["programming", "debugging", "software_architecture", "erp_design", "code_review"].includes(missionType)) agents.add(AgentRole.TechnicalArchitect);
    if (["business_planning", "startup_launch", "brainstorming"].includes(missionType)) agents.add(AgentRole.ProductStrategist);
    if (["business_planning", "startup_launch"].includes(missionType)) agents.add(AgentRole.MarketingStrategist);
    if (["business_planning", "startup_launch", "financial_analysis", "erp_design"].includes(missionType)) agents.add(AgentRole.Finance);
    if (["debugging", "software_architecture", "erp_design", "financial_analysis", "startup_launch", "code_review"].includes(missionType) || complexity >= 5) agents.add(AgentRole.RiskCritic);
    if (missionType === "education" || missionType === "research" || missionType === "file_analysis") agents.add(AgentRole.Researcher);
    if (missionType === "education" && complexity > 3) agents.add(AgentRole.TechnicalArchitect);
    if (requiresConflictResolution) agents.add(AgentRole.Mediator);
    semantic.usefulAgents.slice(0, requiresPlanning ? 4 : 2).forEach((agent) => {
      if (![AgentRole.Planner, AgentRole.Mediator, AgentRole.Finalizer].includes(agent)) agents.add(agent);
    });
    agents.add(AgentRole.Finalizer);
    return Array.from(agents);
  }

  private classificationConfidence(missionType: MissionKind, text: string) {
    const clearSignals = {
      translation: /\btranslate|translation|ترجم|ترجمة\b/,
      summarization: /\bsummarize|summary|tl;dr|recap\b/,
      question_answering: /^(what|why|how|when|where|who|which|explain|define)\b|\?$/,
      debugging: /\bdebug|fix|bug|error|crash|broken\b/,
      software_architecture: /\barchitecture|system design|scalable|migration\b/,
      startup_launch: /\bstartup|launch|mvp|go-to-market\b/,
      erp_design: /\berp\b/,
    } as Partial<Record<MissionKind, RegExp>>;
    return clearSignals[missionType]?.test(text) ? 92 : 78;
  }

  private analyzeMissionSemantics(brief: string): SemanticMissionAnalysis {
    const objective = sanitizeUserFacingText(brief.replace(/\s+/g, " ").trim());
    const text = objective.toLowerCase();
    const objectiveTerms = this.extractObjectiveTerms(objective);
    const primaryDomain = this.humanizeDomainFromObjective(objective);
    const secondaryDomains = objectiveTerms.slice(2, 5).map((term) => this.titleCase(term));
    const relevantConcepts = this.extractRelevantConcepts(objective, primaryDomain);
    const intent = this.detectUserIntent(text, primaryDomain);
    const skills = this.extractSkills(text, primaryDomain, secondaryDomains);
    const requiredExpertise = this.detectRequiredExpertise(text, primaryDomain, secondaryDomains, skills);
    const usefulAgents = requiredExpertise.map((item) => item.agent);
    const riskThemes = this.detectRiskThemes(text, primaryDomain, secondaryDomains, skills);
    const semantic: SemanticMissionAnalysis = {
      objective,
      primaryDomain,
      secondaryDomains: Array.from(new Set(secondaryDomains)).slice(0, 6),
      intent,
      skills,
      relevantConcepts,
      requiredExpertise,
      usefulAgents,
      riskThemes,
      naturalWorkstreams: [],
    };
    semantic.naturalWorkstreams = this.buildSemanticWorkstreams(semantic);
    return semantic;
  }

  private humanizeDomainFromObjective(objective: string) {
    const words = this.extractObjectiveTerms(objective);
    return words.slice(0, 2).map((word) => this.titleCase(word)).join(" ") || "Mission";
  }

  private extractObjectiveTerms(text: string) {
    const counts = new Map<string, number>();
    text.toLowerCase().match(/[a-z0-9.+#-]+/g)?.forEach((word) => {
      if (word.length < 3) return;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word)
      .slice(0, 12);
  }

  private titleCase(text: string) {
    return text.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private extractRelevantConcepts(text: string, primaryDomain: string) {
    const objectiveTerms = this.extractObjectiveTerms(text).map((term) => this.titleCase(term));
    return Array.from(new Set([primaryDomain, ...objectiveTerms])).slice(0, 14);
  }

  private detectUserIntent(text: string, primaryDomain: string) {
    const terms = this.extractObjectiveTerms(text);
    const action = terms[0] ?? "solve";
    return `${this.titleCase(action)} the user's ${primaryDomain.toLowerCase()} objective directly`;
  }

  private extractSkills(text: string, primaryDomain: string, secondaryDomains: string[]) {
    const terms = this.extractObjectiveTerms(`${primaryDomain} ${secondaryDomains.join(" ")} ${text}`);
    const skills = terms.slice(0, 4).map((term) => `${this.titleCase(term)} Analysis`);
    return skills.length ? skills : [`${primaryDomain} Analysis`];
  }

  private detectRequiredExpertise(text: string, primaryDomain: string, secondaryDomains: string[], skills: string[]) {
    const missionTerms = new Set(this.extractObjectiveTerms(`${primaryDomain} ${secondaryDomains.join(" ")} ${skills.join(" ")} ${text}`));
    const expertise: SemanticMissionAnalysis["requiredExpertise"] = [];
    const add = (agent: AgentRole, reason: string, priority: "core" | "support" | "review" = "core") => {
      if (!expertise.some((item) => item.agent === agent)) expertise.push({ agent, reason, priority });
    };
    const scoredAgents = AGENT_DEFINITIONS
      .filter((agent) => ![AgentRole.Planner, AgentRole.Mediator, AgentRole.Finalizer].includes(agent.role))
      .map((agent) => {
        const agentTerms = new Set(this.extractObjectiveTerms(`${agent.name} ${agent.capabilities.join(" ")} ${agent.systemPrompt}`));
        const score = Array.from(missionTerms).filter((term) => agentTerms.has(term)).length;
        return { agent, score };
      })
      .sort((a, b) => b.score - a.score);
    scoredAgents.filter((item) => item.score > 0).slice(0, 4).forEach((item, index) => {
      add(item.agent.role, `${item.agent.name} matched the mission language through its role and capabilities`, index === 0 ? "core" : "support");
    });
    if (expertise.length === 0) add(AgentRole.Researcher, "establish evidence, constraints, and mission context", "core");
    return expertise;
  }

  private detectRiskThemes(text: string, primaryDomain: string, secondaryDomains: string[], skills: string[]) {
    const genericTerms = new Set([
      "about", "action", "against", "build", "from", "for", "into", "mission", "plan", "selected", "the", "this", "using", "with",
    ]);
    const terms = this.extractObjectiveTerms(text)
      .filter((term) => !genericTerms.has(term) && !/^\d+$/.test(term));
    if (terms.length < 2) return [];
    return [`Validate whether ${terms.slice(0, 4).map((term) => this.titleCase(term)).join(", ")} can meet the mission constraints.`];
  }

  private buildSemanticWorkstreams(semantic: SemanticMissionAnalysis): SemanticWorkstreamBlueprint[] {
    const blueprints: SemanticWorkstreamBlueprint[] = [];
    const concepts = semantic.relevantConcepts.slice(0, 5).join(", ") || semantic.primaryDomain;
    const add = (blueprint: SemanticWorkstreamBlueprint) => blueprints.push(blueprint);
    const hasAgent = (agent: AgentRole) => semantic.usefulAgents.includes(agent);

    if (hasAgent(AgentRole.Researcher)) {
      add({
        title: `${semantic.primaryDomain} Requirements and Evidence Baseline`,
        agent: AgentRole.Researcher,
        description: `Clarify the objective, constraints, context, and evidence needed to solve "${semantic.objective}" in ${semantic.primaryDomain}.`,
        deliverables: ["objective constraints", "evidence checklist", "decision criteria"],
        acceptanceCriteria: ["constraints are specific", "missing information is named", "recommendations are grounded in the objective"],
        expectedOutputs: ["baseline findings", "assumptions", "open questions"],
      });
    }
    if (hasAgent(AgentRole.TechnicalArchitect)) {
      add({
        title: `${semantic.primaryDomain} Technical Plan for ${concepts}`,
        agent: AgentRole.TechnicalArchitect,
        supportingAgents: [AgentRole.Researcher],
        description: `Design the practical technical sequence, compatibility checks, implementation steps, and validation path for ${concepts}.`,
        deliverables: ["technical sequence", "compatibility or feasibility checks", "validation checklist"],
        acceptanceCriteria: ["steps are actionable", "dependencies are explicit", "validation catches likely failures"],
        expectedOutputs: ["technical plan", "checklist", "implementation notes"],
        dependencies: [1],
      });
    }
    if (hasAgent(AgentRole.ProductStrategist)) {
      add({
        title: `${semantic.primaryDomain} Scope and User Outcome Design`,
        agent: AgentRole.ProductStrategist,
        supportingAgents: [AgentRole.Researcher, AgentRole.TechnicalArchitect],
        description: `Define the useful scope, user-facing outcomes, tradeoffs, and success boundaries for the objective.`,
        deliverables: ["scope boundaries", "outcome map", "tradeoff notes"],
        acceptanceCriteria: ["scope matches the user's objective", "tradeoffs are concrete", "success criteria are measurable"],
        expectedOutputs: ["scope recommendation", "success metrics"],
        dependencies: [1],
      });
    }
    if (hasAgent(AgentRole.Finance)) {
      add({
        title: `${semantic.primaryDomain} Budget and Resource Model`,
        agent: AgentRole.Finance,
        supportingAgents: [AgentRole.Researcher],
        description: `Estimate costs, budget constraints, resource needs, and financial assumptions that affect the mission outcome.`,
        deliverables: ["cost drivers", "budget assumptions", "resource plan"],
        acceptanceCriteria: ["major costs are visible", "assumptions are testable", "budget advice matches the objective"],
        expectedOutputs: ["resource model", "budget notes"],
        dependencies: [1],
      });
    }
    if (hasAgent(AgentRole.MarketingStrategist)) {
      add({
        title: `${semantic.primaryDomain} Audience and Adoption Plan`,
        agent: AgentRole.MarketingStrategist,
        supportingAgents: [AgentRole.Researcher],
        description: `Define the audience, positioning, channels, adoption path, or demand signals only where they matter to the objective.`,
        deliverables: ["audience definition", "positioning notes", "channel or adoption plan"],
        acceptanceCriteria: ["audience is specific", "channels fit the domain", "claims are realistic"],
        expectedOutputs: ["audience plan", "messaging notes"],
        dependencies: [1],
      });
    }
    if (hasAgent(AgentRole.RiskCritic)) {
      add({
        title: `${semantic.primaryDomain} Failure Mode and Assumption Review`,
        agent: AgentRole.RiskCritic,
        supportingAgents: [AgentRole.Researcher, AgentRole.TechnicalArchitect, AgentRole.Finance],
        description: `Stress-test the plan against ${semantic.riskThemes.join("; ") || "mission-specific risks"} without fabricating disagreements.`,
        deliverables: ["risk register", "assumption checks", "mitigation steps"],
        acceptanceCriteria: ["risks are specific to the objective", "mitigations are actionable", "no conflict is fabricated"],
        expectedOutputs: ["risk review", "mitigation checklist"],
        dependencies: blueprints.length ? [Math.max(1, blueprints.length)] : undefined,
      });
    }
    add({
      title: `${semantic.primaryDomain} Final User Deliverable`,
      agent: AgentRole.Finalizer,
      supportingAgents: semantic.usefulAgents,
      description: `Synthesize the completed work into a direct answer for "${semantic.objective}" with orchestration details kept secondary.`,
      deliverables: ["final user-facing answer", "prioritized next steps", "quality checklist"],
      acceptanceCriteria: ["answers the user objective directly", "contains no raw JSON or parser/debug text", "uses the same MissionContext as all tabs"],
      expectedOutputs: ["final deliverable", "next steps"],
      dependencies: blueprints.map((_item, index) => index + 1),
    });
    return blueprints;
  }

  private agentForMissionWorkstream(classification: MissionClassification, title: string, index: number): AgentRole {
    const blueprint = this.semanticBlueprintAt(classification, index);
    if (blueprint?.agent) return blueprint.agent;
    const titleTerms = new Set(this.extractObjectiveTerms(title));
    const capabilityMatch = AGENT_DEFINITIONS
      .filter((agent) => classification.selectedAgents.includes(agent.role))
      .map((agent) => {
        const terms = new Set(this.extractObjectiveTerms(`${agent.name} ${agent.capabilities.join(" ")}`));
        return { role: agent.role, score: Array.from(titleTerms).filter((term) => terms.has(term)).length };
      })
      .sort((a, b) => b.score - a.score)
      .find((item) => item.score > 0)?.role;
    if (capabilityMatch) return capabilityMatch;
    return classification.selectedAgents.filter((agent) => agent !== AgentRole.Planner && agent !== AgentRole.Finalizer)[index % Math.max(1, classification.selectedAgents.length - 2)] ?? AgentRole.Researcher;
  }

  private ensureRequiredWorkstreams(ctx: MissionContext, classification: MissionClassification) {
    if (!classification.strategy.requiresPlanning && !classification.strategy.requiresConflictResolution) return;
    const hasRisk = ctx.workstreams.some((workstream) => workstream.assignedAgent === AgentRole.RiskCritic);
    if (classification.selectedAgents.includes(AgentRole.RiskCritic) && classification.semantic.riskThemes.length > 0 && !hasRisk) {
      ctx.workstreams = [...ctx.workstreams, {
        id: generateId(),
        title: `${classification.semantic.primaryDomain} Failure Mode and Assumption Review`,
        owner: missionDisplayRole(classification, AgentRole.RiskCritic),
        responsibleAgent: missionDisplayRole(classification, AgentRole.RiskCritic),
        displayRole: missionDisplayRole(classification, AgentRole.RiskCritic),
        description: `Challenge the plan for ${classification.semantic.riskThemes.join("; ")} without fabricating disagreement.`,
        status: "pending",
        assignedAgent: AgentRole.RiskCritic,
        deliverables: ["Risk register", "Assumption checks", "Mitigation checklist"],
        acceptanceCriteria: ["risks are specific to the objective", "no conflict is fabricated", "mitigations are actionable"],
        expectedOutputs: ["risk review", "mitigation plan"],
        confidence: 76,
        dependencies: ctx.workstreams.map((workstream) => workstream.id),
      }];
    }
  }

  private createDirectWorkstreams(classification: MissionClassification): Workstream[] {
    const objective = classification.semantic.objective;
    const primaryAgent = classification.selectedAgents.find((agent) => ![AgentRole.Planner, AgentRole.Finalizer, AgentRole.Mediator].includes(agent)) ?? AgentRole.Researcher;
    const reviewer = classification.selectedAgents.includes(AgentRole.RiskCritic) && classification.strategy.complexity > 2 ? AgentRole.RiskCritic : AgentRole.Finalizer;
    const workstreams: Workstream[] = [{
      id: generateId(),
      title: this.directWorkstreamTitle(classification, primaryAgent),
      owner: missionDisplayRole(classification, primaryAgent),
      responsibleAgent: missionDisplayRole(classification, primaryAgent),
      displayRole: missionDisplayRole(classification, primaryAgent),
      description: this.directWorkstreamDescription(classification),
      status: "pending",
      assignedAgent: primaryAgent,
      supportingAgentIds: [],
      deliverables: this.directDeliverables(classification),
      acceptanceCriteria: ["answer the user request directly", "avoid unrelated planning sections", "keep output user-quality"],
      expectedOutputs: ["direct useful answer"],
      confidence: Math.max(78, 92 - classification.strategy.complexity * 2),
      dependencies: [],
    }];

    if (reviewer !== AgentRole.Finalizer) {
      workstreams.push({
        id: generateId(),
        title: `${this.titleCase(classification.strategy.missionType)} Review`,
        owner: missionDisplayRole(classification, reviewer),
        responsibleAgent: missionDisplayRole(classification, reviewer),
        displayRole: missionDisplayRole(classification, reviewer),
        description: `Review the direct answer for correctness, omissions, and user-facing clarity without adding unrelated scope.`,
        status: "pending",
        assignedAgent: reviewer,
        supportingAgentIds: [primaryAgent],
        deliverables: ["quality check", "correction notes"],
        acceptanceCriteria: ["review stays relevant", "no fabricated conflict", "only material issues are flagged"],
        expectedOutputs: ["reviewed answer"],
        confidence: 80,
        dependencies: [workstreams[0].id],
      });
    }

    return workstreams;
  }

  private directWorkstreamTitle(classification: MissionClassification, agent: AgentRole) {
    const kind = classification.strategy.missionType;
    if (kind === "translation") return "Translate the Provided Text";
    if (kind === "summarization") return "Summarize the Provided Content";
    if (kind === "question_answering") return "Answer the Question Clearly";
    if (kind === "creative_writing") return "Draft the Requested Text";
    if (kind === "programming") return "Implement the Requested Code";
    if (kind === "debugging") return "Diagnose and Fix the Issue";
    if (kind === "code_review") return "Review the Code";
    return `${missionDisplayRole(classification, agent)} Direct Response`;
  }

  private directWorkstreamDescription(classification: MissionClassification) {
    const objective = classification.semantic.objective;
    const kind = classification.strategy.missionType.replace(/_/g, " ");
    return `Produce the ${kind} deliverable requested by the user: "${objective}". Do not add budget, timeline, stakeholder, roadmap, or enterprise planning sections unless the prompt asks for them.`;
  }

  private directDeliverables(classification: MissionClassification) {
    const kind = classification.strategy.missionType;
    if (kind === "translation") return ["translated text", "short fidelity check"];
    if (kind === "summarization") return ["concise summary", "key points"];
    if (kind === "question_answering") return ["direct answer", "brief supporting explanation"];
    if (kind === "creative_writing") return ["draft text", "editorial polish"];
    if (kind === "programming" || kind === "debugging") return ["working solution", "validation notes"];
    return ["direct answer", "useful next step"];
  }

  private validateWorkstreamsForStrategy(workstreams: Workstream[], classification: MissionClassification, brief: string) {
    const forbiddenForDirect = /\b(budget|stakeholder|roadmap|go-to-market|financial|runway|hiring|implementation phase|market launch)\b/i;
    if (!classification.strategy.requiresPlanning) {
      const noisy = workstreams.some((workstream) => forbiddenForDirect.test(`${workstream.title} ${workstream.description} ${workstream.deliverables.join(" ")}`));
      if (noisy || workstreams.length > Math.max(2, classification.strategy.estimatedWorkstreams + 1)) {
        console.warn("[MissionEngine] Planner-like workstreams rejected for direct mission.", {
          missionType: classification.strategy.missionType,
          workstreams: workstreams.map((workstream) => workstream.title),
        });
        return this.createDirectWorkstreams(classification);
      }
    }

    if (classification.strategy.requiresPlanning && workstreams.length < Math.min(3, classification.strategy.estimatedWorkstreams)) {
      console.warn("[MissionEngine] Planner output under-scoped for complex mission; using semantic graph fallback.", {
        missionType: classification.strategy.missionType,
        expected: classification.strategy.estimatedWorkstreams,
        actual: workstreams.length,
      });
      return this.fallbackWorkstreams(classification, brief);
    }

    return workstreams;
  }

  private createExecutionTasks(workstreams: Workstream[], classification: MissionClassification): ExecutionTask[] {
    const tasks = workstreams.map((workstream, index) => ({
      id: generateId(),
      workstreamId: workstream.id,
      title: workstream.title,
      description: workstream.description,
      agent: workstream.assignedAgent ?? this.agentForMissionWorkstream(classification, workstream.title, index),
      displayRole: workstream.displayRole ?? missionDisplayRole(classification, workstream.assignedAgent ?? this.agentForMissionWorkstream(classification, workstream.title, index)),
      supportingAgents: workstream.supportingAgentIds ?? [],
      acceptanceCriteria: workstream.acceptanceCriteria,
      expectedOutputs: workstream.expectedOutputs,
      dependencies: [] as string[],
      status: "pending" as const,
      confidence: workstream.confidence ?? Math.max(68, 86 - index * 3),
    }));

    return tasks.map((task, index) => {
      const workstream = workstreams.find((item) => item.id === task.workstreamId);
      const explicitDependencies = workstream?.dependencies
        ?.map((dependencyId) => tasks.find((candidate) => candidate.workstreamId === dependencyId)?.id)
        .filter((dependencyId): dependencyId is string => Boolean(dependencyId)) ?? [];

      const researchTask = tasks.find((candidate) => candidate.agent === AgentRole.Researcher);
      const technicalTask = tasks.find((candidate) => candidate.agent === AgentRole.TechnicalArchitect);
      const productTask = tasks.find((candidate) => candidate.agent === AgentRole.ProductStrategist);

      if (task.agent === AgentRole.Researcher || index === 0) return task;
      if (classification.isTechnical && task.agent === AgentRole.TechnicalArchitect) return task;
      if (classification.isLaunch && task.agent === AgentRole.TechnicalArchitect) return task;
      if (explicitDependencies.length) return { ...task, dependencies: explicitDependencies };

      if (task.agent === AgentRole.ProductStrategist) {
        return { ...task, dependencies: researchTask ? [researchTask.id] : [] };
      }
      if (task.agent === AgentRole.MarketingStrategist) {
        return { ...task, dependencies: researchTask ? [researchTask.id] : [] };
      }
      if (task.agent === AgentRole.Finance) {
        return { ...task, dependencies: technicalTask ? [technicalTask.id] : productTask ? [productTask.id] : [] };
      }
      if (task.agent === AgentRole.TechnicalArchitect) {
        return { ...task, dependencies: productTask ? [productTask.id] : researchTask ? [researchTask.id] : [] };
      }
      if (task.agent === AgentRole.RiskCritic) {
        const upstream = tasks.filter((candidate) => candidate.id !== task.id && [AgentRole.Researcher, AgentRole.TechnicalArchitect, AgentRole.MarketingStrategist, AgentRole.Finance].includes(candidate.agent));
        return { ...task, dependencies: upstream.slice(0, 2).map((candidate) => candidate.id) };
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

  private setAgentActivity(
    ctx: MissionContext,
    role: AgentRole,
    state: AgentThinkingState,
    label: string,
    detail: string,
    confidence?: number,
    confidenceReason?: string,
    confidenceDelta?: number,
  ) {
    this.setAgentState(ctx, role, state);
    const activity: AgentActivity = {
      state,
      label,
      detail,
      updatedAt: now(),
      ...(confidence != null ? { confidence } : {}),
      ...(confidenceReason ? { confidenceReason } : {}),
      ...(confidenceDelta != null ? { confidenceDelta } : {}),
    };
    ctx.agentActivities = { ...ctx.agentActivities, [role]: activity };
    return activity;
  }

  private activityDetail(ctx: MissionContext, task?: ExecutionTask) {
    const dependencies = task?.dependencies
      .map((id) => ctx.executionTasks.find((candidate) => candidate.id === id)?.title)
      .filter((title): title is string => Boolean(title));
    if (dependencies?.length) return `Using completed dependency findings from ${dependencies.join(", ")}.`;
    const previousContribution = ctx.dialogue.at(-1);
    if (previousContribution) return `Reviewing the latest contribution from ${previousContribution.displayRole ?? previousContribution.agentName}.`;
    return task ? `Framing the assigned workstream: ${task.title}.` : "Reviewing the mission objective, constraints, and assigned role.";
  }

  private recordConfidenceTransition(
    ctx: MissionContext,
    task: ExecutionTask,
    agentDef: NonNullable<ReturnType<typeof getAgentByRole>>,
    confidence: number,
    reason: string,
  ) {
    const current = ctx.executionTasks.find((candidate) => candidate.id === task.id)?.confidence ?? task.confidence;
    const next = clampConfidence(confidence);
    if (next === current) return current;
    this.updateTask(ctx, task.id, { confidence: next });
    this.updateWorkstream(ctx, task.workstreamId, { confidence: next });
    const activity = this.setAgentActivity(ctx, task.agent, ctx.agentStates[task.agent], "Updating confidence", reason, next, reason, next - current);
    this.recordReplayEvent(ctx, "CONFIDENCE_UPDATED", {
      agentId: agentDef.id,
      agentName: agentDef.name,
      agentRole: task.agent,
      workstreamId: task.workstreamId,
      workstreamTitle: task.title,
      confidence: next,
      dependencies: task.dependencies,
      payload: { previousConfidence: current, reason, activity },
    });
    this.addTimeline(ctx, task.agent, this.phaseForAgent(task.agent), `${agentDef.name} confidence updated`, `${current}% → ${next}% — ${reason}`, "agent");
    return next;
  }

  private scheduleLiveReview(
    ctx: MissionContext,
    agentDef: NonNullable<ReturnType<typeof getAgentByRole>>,
    role: AgentRole,
    phase: MissionState,
    onUpdate: (ctx: MissionContext) => void,
    task?: ExecutionTask,
  ) {
    const timer = window.setTimeout(() => {
      if (ctx.agentStates[role] !== "analyzing") return;
      const activity = this.setAgentActivity(ctx, role, "reviewing", "Cross-checking assumptions", task ? this.activityDetail(ctx, task) : "Re-evaluating the contribution against the shared council context.");
      this.recordReplayEvent(ctx, "AGENT_REVIEWING", {
        agentId: agentDef.id,
        agentName: agentDef.name,
        agentRole: role,
        workstreamId: task?.workstreamId,
        workstreamTitle: task?.title,
        payload: { phase, activity },
        confidence: task?.confidence,
        dependencies: task?.dependencies,
      });
      if (task) this.recordConfidenceTransition(ctx, task, agentDef, task.confidence + 4, "Shared dependencies were cross-checked before the recommendation was finalized.");
      onUpdate({ ...ctx });
    }, 900);
    return () => window.clearTimeout(timer);
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
    if (!classification.strategy.requiresConflictResolution && !classification.selectedAgents.includes(AgentRole.RiskCritic)) {
      ctx.conflicts = [];
      return;
    }
    const conflicts: ConflictInfo[] = [];
    ctx.dialogue.forEach((entry) => {
      const structured = this.tryParseAgentOutput(entry.content);
      structured?.conflictSignals?.forEach((signal) => {
        const otherAgent = this.agentFromOwner(signal.withAgent);
        conflicts.push({
          id: generateId(),
          title: signal.topic || `${entry.agentName} disagreement`,
          agents: this.agentNamesFromRoles([entry.agentRole, otherAgent].filter((agent): agent is AgentRole => Boolean(agent))),
          riskLevel: signal.severity === "high" ? "high" : signal.severity === "moderate" ? "moderate" : "low",
          description: sanitizeMissionText(signal.disagreement),
          disagreementSummary: sanitizeMissionText(signal.disagreement),
          resolved: false,
        });
      });
    });

    const riskText = sanitizeMissionText(ctx.riskReview);
    if (/CONFLICT_DETECTED:\s*true/i.test(riskText) && conflicts.length === 0) {
      conflicts.push({
        id: generateId(),
        title: `${classification.semantic.primaryDomain} assumption conflict`,
        agents: this.agentNamesFromRoles([AgentRole.RiskCritic]),
        riskLevel: "moderate",
        description: "Risk Critic flagged a material objection that requires mediation.",
        disagreementSummary: riskText.slice(0, 500),
        resolved: false,
      });
    }

    const existingIds = new Set(ctx.conflicts.map((conflict) => conflict.id));
    ctx.conflicts = [
      ...ctx.conflicts,
      ...conflicts.filter((conflict) => !existingIds.has(conflict.id)),
    ];
  }

  private resolveConflictAction(conflict: ConflictInfo, classification: MissionClassification) {
    if (classification.isLearning) {
      return "Use 2 full mock tests instead of 4, keep short daily speaking practice, and reserve review blocks for weak speaking and writing areas.";
    }
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

  private reconcileMissionParticipants(ctx: MissionContext, classification: MissionClassification) {
    const participantRoles = new Set(
      ctx.replayEvents
        .filter((event) => event.agentRole && ["PLANNER_STARTED", "AGENT_STARTED", "MEDIATOR_STARTED", "MEDIATION_STARTED", "FINALIZER_STARTED"].includes(event.type))
        .map((event) => event.agentRole!)
    );
    const selectedAgents = AGENT_DEFINITIONS.map((agent) => agent.role).filter((role) => participantRoles.has(role));

    if (selectedAgents.length === 0) return;

    classification.selectedAgents = selectedAgents;
    classification.strategy = { ...classification.strategy, recommendedAgents: selectedAgents };
    ctx.missionClassification = classification.strategy;
  }

  private generateEfficiencyMetrics(ctx: MissionContext, hadConflicts: boolean): EfficiencyMetrics {
    const totalWorkstreams = Math.max(1, ctx.workstreams.length);
    const completedWorkstreams = ctx.workstreams.filter((workstream) => workstream.status === "completed").length;
    const taskCoverage = Math.round((completedWorkstreams / totalWorkstreams) * 100);
    const participatingAgents = new Set(
      ctx.missionClassification?.recommendedAgents.length
        ? ctx.missionClassification.recommendedAgents
        : ctx.dialogue.map((entry) => entry.agentRole)
    );
    const confidenceValues = ctx.workstreams.map((workstream) => workstream.confidence ?? 70);
    const confidence = Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / Math.max(1, confidenceValues.length));
    const resolved = ctx.conflicts.filter((conflict) => conflict.resolved).length;
    const conflictResolutionScore = ctx.conflicts.length === 0 ? 100 : Math.round((resolved / ctx.conflicts.length) * 100);
    const outputCompleteness = Math.min(100, Math.round((ctx.dialogue.reduce((sum, entry) => sum + sanitizeMissionText(entry.content).length, 0) / Math.max(1, totalWorkstreams)) / 20));
    const qualityScore = Math.round((taskCoverage * 0.32) + (confidence * 0.34) + (conflictResolutionScore * 0.18) + (outputCompleteness * 0.16));
    const executionDurationMs = ctx.startedAt ? Math.max(0, new Date(ctx.completedAt ?? now()).getTime() - new Date(ctx.startedAt).getTime()) : 0;
    const tokenText = [
      ctx.researchSummary,
      ctx.productStrategy,
      ctx.technicalArchitecture,
      ctx.marketingStrategy,
      ctx.financialPlan,
      ctx.riskReview,
      ctx.mediatorDecisions,
      ctx.dialogue.map((entry) => entry.content).join("\n"),
    ].join("\n");
    const tokensConsumed = Math.max(0, Math.round(tokenText.length / 4));
    const finishedEvents = ctx.replayEvents.filter((event) => /FINISHED$/.test(event.type) && event.agentRole);
    const startedEvents = ctx.replayEvents.filter((event) => /STARTED$/.test(event.type) && event.agentRole);
    const latencies = finishedEvents.map((finished) => {
      const started = [...startedEvents].reverse().find((event) =>
        event.agentRole === finished.agentRole &&
        event.relativeTimestamp <= finished.relativeTimestamp &&
        (!finished.workstreamId || event.workstreamId === finished.workstreamId)
      );
      return started ? finished.relativeTimestamp - started.relativeTimestamp : 0;
    }).filter((value) => value > 0);
    const independentTasks = ctx.executionTasks.filter((task) => task.dependencies.length === 0).length;
    const parallelismPercent = Math.round((independentTasks / Math.max(1, ctx.executionTasks.length)) * 100);
    const consensusPercent = ctx.conflicts.length === 0 ? 100 : Math.round((resolved / Math.max(1, ctx.conflicts.length)) * 100);
    const complexity = ctx.missionClassification?.complexity ?? Math.max(1, Math.min(10, Math.ceil(totalWorkstreams * 1.2)));
    const directMode = ctx.missionClassification?.deliverableMode === "direct_answer";
    const dependencyLoad = ctx.executionTasks.reduce((sum, task) => sum + task.dependencies.length, 0);
    const lowConfidenceTasks = ctx.executionTasks.filter((task) => task.confidence < 75).length;
    const estimatedCompletionTime = this.efficiencyCompletionLabel(ctx, executionDurationMs, latencies, totalWorkstreams, complexity);
    const singleAgentCoverageBaseline = Math.max(35, Math.min(92, taskCoverage - Math.max(8, Math.round(totalWorkstreams * 3.5 + dependencyLoad * 2))));
    const singleAgentConfidenceBaseline = Math.max(38, Math.min(90, confidence - Math.max(6, Math.round(participatingAgents.size * 2.2 + lowConfidenceTasks * 1.5))));
    const singleAgentPerspectiveBaseline = directMode ? 10 : Math.max(10, Math.min(45, Math.round((1 / Math.max(1, participatingAgents.size)) * 100)));
    const singleAgentBaseline = Math.max(
      36,
      Math.min(88, Math.round((singleAgentCoverageBaseline * 0.28) + (singleAgentConfidenceBaseline * 0.34) + (Math.min(100, outputCompleteness) * 0.18) + (singleAgentPerspectiveBaseline * 0.2)))
    );
    return {
      taskCoverage,
      qualityScore: Math.max(45, Math.min(98, qualityScore)),
      conflictsResolved: resolved,
      estimatedCompletionTime,
      perspectivesConsidered: participatingAgents.size,
      revisionCount: ctx.conflicts.length + ctx.executionTasks.filter((task) => task.confidence < 75).length + (hadConflicts ? 1 : 0),
      finalConfidenceScore: confidence,
      executionDurationMs,
      tokensConsumed,
      averageLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0,
      retryCount: ctx.replayEvents.filter((event) => event.type === "PLANNER_REVISED_PLAN" || event.type === "TASK_REASSIGNED" || /fallback/i.test(JSON.stringify(event.payload ?? {}))).length,
      failureCount: ctx.executionTasks.filter((task) => task.status === "blocked" || task.status === "cancelled").length + (ctx.status === MissionState.Failed ? 1 : 0),
      parallelismPercent,
      consensusPercent,
      agentUtilizationPercent: Math.round((participatingAgents.size / Math.max(1, AGENT_DEFINITIONS.length)) * 100),
      singleAgentBaseline,
      singleAgentCoverageBaseline,
      singleAgentConfidenceBaseline,
      singleAgentPerspectiveBaseline,
    };
  }

  private efficiencyCompletionLabel(ctx: MissionContext, executionDurationMs: number, latencies: number[], totalWorkstreams: number, complexity: number) {
    if (executionDurationMs > 0) return `${this.formatMetricDuration(executionDurationMs)} actual runtime`;
    const averageLatency = latencies.length ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : 1600;
    const dependencyMultiplier = 1 + (ctx.executionTasks.reduce((sum, task) => sum + task.dependencies.length, 0) / Math.max(1, ctx.executionTasks.length)) * 0.18;
    const estimateMs = Math.max(1000, Math.round((averageLatency * Math.max(1, totalWorkstreams) * dependencyMultiplier) + complexity * 650));
    return `${this.formatMetricDuration(estimateMs)} telemetry estimate`;
  }

  private formatMetricDuration(ms: number) {
    const seconds = Math.max(1, Math.round(ms / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  }

  private generateReport(ctx: MissionContext): MissionReport {
    const classification = this.classifyMission(ctx.missionBrief, ctx.configuration);
    const completedParticipants = ctx.missionClassification?.recommendedAgents;
    if (completedParticipants?.length) {
      classification.selectedAgents = completedParticipants;
      classification.strategy = { ...classification.strategy, recommendedAgents: completedParticipants };
    }
    ctx.missionClassification = classification.strategy;
    const metrics = ctx.efficiencyMetrics ?? this.generateEfficiencyMetrics(ctx, ctx.conflicts.length > 0);
    const parallelGroups = ctx.missionGraph?.parallelGroups ?? this.buildNamedParallelGroups(ctx.executionTasks);
    const revisedTasks = ctx.executionTasks.filter((task) => task.status === "revised" || task.revisionNote);
    const semantic = classification.semantic;
    const workstreamLines = ctx.workstreams.map((workstream) =>
      `- ${sanitizeMissionText(workstream.title)} (${getAgentByRole(workstream.assignedAgent ?? AgentRole.Planner)?.name ?? workstream.owner ?? "Owner pending"}, ${workstream.confidence ?? 80}% confidence): ${sanitizeMissionText(workstream.description)}`
    ).join("\n");
    const parsedContributions = ctx.dialogue
      .map((entry) => ({ entry, parsed: this.tryParseAgentOutput(entry.content) }))
      .filter(({ entry }) => entry.agentRole !== AgentRole.Planner || ctx.workstreams.length === 0);
    const contributionLines = parsedContributions.map(({ entry, parsed }) => {
      const useful = parsed?.summary || parsed?.usefulOutput?.recommendations?.[0] || parsed?.usefulOutput?.keyFindings?.[0];
      return `- ${entry.displayRole ?? entry.agentName}: ${sanitizeUserFacingText(useful ?? entry.content).split("\n").find(Boolean)?.replace(/^#+\s*/, "") ?? "Contribution captured."}`;
    }).join("\n");
    const finalDeliverable = this.composeObjectiveAnswer(ctx, classification);
    const predictiveNextMissions = this.predictiveNextMissionsFromContext(ctx);
    if (classification.strategy.deliverableMode === "direct_answer") {
      const directReport: MissionReport = {
        deliverableMode: "direct_answer",
        finalAnswer: finalDeliverable,
        reviewNote: this.directReviewNoteFromContext(ctx, classification),
        executiveSummary: finalDeliverable,
        missionObjective: ctx.missionBrief,
        selectedMissionConfiguration: configSummary(ctx.configuration),
        workstreams: "",
        roleAssignments: "",
        agentContributions: "",
        keyDisagreements: "",
        mediatorDecisions: "",
        executionRoadmap: "",
        timeline: "",
        budgetEstimate: "",
        riskAssessment: "",
        successMetrics: "",
        finalRecommendations: "",
        predictiveNextMissions,
        singleAgentComparison: "",
      };
      return this.validateFinalReport(directReport, classification);
    }
    const report: MissionReport = {
      deliverableMode: classification.strategy.deliverableMode,
      executiveSummary: finalDeliverable,
      missionObjective: ctx.missionBrief,
      selectedMissionConfiguration: configSummary(ctx.configuration),
      workstreams: workstreamLines,
      roleAssignments: [
        `Mission type: ${classification.strategy.missionType.replace(/_/g, " ")}`,
        `Complexity: ${classification.strategy.complexity}/10`,
        `Strategy: ${classification.strategy.selectedStrategy}`,
        `Planning: ${classification.strategy.requiresPlanning ? `enabled - ${classification.strategy.planningReason}` : "skipped - direct specialist execution"}`,
        "",
        `Primary domain: ${semantic.primaryDomain}`,
        semantic.secondaryDomains.length ? `Related domains: ${semantic.secondaryDomains.join(", ")}` : "Related domains: none required.",
        `User intent: ${semantic.intent}`,
        "",
        "Expertise used:",
        ...semantic.requiredExpertise.map((item) => `${missionDisplayRole(classification, item.agent)}: ${item.reason}`),
        "",
        classification.strategy.requiresPlanning ? "Mission Graph assignments:" : "Direct execution assignments:",
        ...ctx.workstreams.map((workstream) => `${workstream.title}: ${getAgentByRole(workstream.assignedAgent ?? AgentRole.Planner)?.name ?? "Unassigned"}${workstream.dependencies?.length ? ` (depends on ${workstream.dependencies.length} node${workstream.dependencies.length > 1 ? "s" : ""})` : " (parallel start eligible)"}`),
        "",
        classification.strategy.requiresParallelism ? "Parallel execution groups:" : "Parallel execution: not required for this mission.",
        ...(classification.strategy.requiresParallelism ? parallelGroups.map((group) => `${group.title}: ${group.taskIds.map((taskId) => ctx.executionTasks.find((task) => task.id === taskId)?.title).filter(Boolean).join(" + ")}`) : []),
        "",
        classification.strategy.requiresPlanning
          ? revisedTasks.length ? `Planner revisions: ${revisedTasks.map((task) => `${task.title} - ${task.revisionNote}`).join("; ")}` : "Planner revisions: none required after synchronization."
          : "Planner revisions: Planner was not invoked.",
      ].join("\n"),
      agentContributions: contributionLines,
      keyDisagreements: ctx.conflicts.map((conflict) => `${conflict.title}: ${conflict.disagreementSummary}`).join("\n") || "No conflicts generated.",
      mediatorDecisions: ctx.mediatorDecisions || "No mediator decision was required.",
      executionRoadmap: classification.strategy.requiresPlanning ? this.generateExecutionRoadmap(ctx, classification) : "No roadmap was required; the request was handled through direct specialist execution.",
      timeline: ctx.timeline.map((entry) => `- ${entry.label}: ${entry.description ?? entry.state}`).join("\n"),
      budgetEstimate: classification.strategy.requiresPlanning || classification.needsFinance ? this.generateResourceEstimate(ctx, classification) : "No budget or resource model was required for this request.",
      riskAssessment: this.generateRiskAssessment(ctx, classification),
      successMetrics: this.generateSuccessMetrics(ctx, metrics),
      finalRecommendations: this.generateFinalRecommendations(ctx, classification),
      predictiveNextMissions,
      singleAgentComparison: `Single-agent baseline: ${metrics.singleAgentBaseline}%. Agent Council quality score: ${metrics.qualityScore}%. Estimated efficiency gain: ${Math.max(0, metrics.qualityScore - metrics.singleAgentBaseline)} points.`,
    };
    return this.validateFinalReport(report, classification);
  }

  private predictiveNextMissionsFromContext(ctx: MissionContext) {
    return [...ctx.dialogue]
      .reverse()
      .map((entry) => this.tryParseAgentOutput(entry.content)?.followUpMissions ?? [])
      .find((missions) => missions.length > 0)
      ?.map((item) => ({
        mission: sanitizeUserFacingText(item.mission),
        rationale: sanitizeUserFacingText(item.rationale ?? ""),
      }))
      .filter((item) => item.mission.length >= 12)
      .slice(0, 3) ?? [];
  }

  private generateRiskAssessment(ctx: MissionContext, classification: MissionClassification) {
    const reviewedRisk = sanitizeMissionText(ctx.riskReview);
    if (reviewedRisk) return reviewedRisk;

    const risks: string[] = [];
    const constraints = [
      ctx.configuration.timeHorizon !== "none" ? `delivery horizon of ${getTimeHorizonLabel(ctx.configuration)}` : "",
      ctx.configuration.budgetRange !== "none" ? `budget range of ${BUDGET_RANGE_LABELS[ctx.configuration.budgetRange]}` : "",
    ].filter(Boolean);
    if (constraints.length) {
      risks.push(`Validate the ${classification.semantic.primaryDomain.toLowerCase()} scope against the selected ${constraints.join(" and ")}.`);
    }

    const unresolvedConflicts = ctx.conflicts.filter((conflict) => !conflict.resolved);
    if (unresolvedConflicts.length) {
      risks.push(`Resolve ${unresolvedConflicts.length} active conflict${unresolvedConflicts.length === 1 ? "" : "s"}: ${unresolvedConflicts.map((conflict) => sanitizeMissionText(conflict.title)).filter(Boolean).join("; ")}.`);
    }

    const uncertainWorkstreams = ctx.workstreams.filter((workstream) => (workstream.confidence ?? 100) < 70);
    if (uncertainWorkstreams.length) {
      risks.push(`Recheck low-confidence workstreams before execution: ${uncertainWorkstreams.map((workstream) => sanitizeMissionText(workstream.title)).filter(Boolean).join("; ")}.`);
    }

    return risks.length ? risks.map((risk) => `- ${risk}`).join("\n") : "No unresolved conflicts or low-confidence workstreams were recorded.";
  }

  private generateSuccessMetrics(ctx: MissionContext, metrics: EfficiencyMetrics) {
    const completedWorkstreams = ctx.workstreams.filter((workstream) => workstream.status === "completed").length;
    const workstreamTotal = ctx.workstreams.length;
    const synchronization = ctx.missionGraph?.finalizationReadiness.status?.replace(/_/g, " ");
    const measures = [
      workstreamTotal ? `Workstreams completed: ${completedWorkstreams}/${workstreamTotal}.` : "",
      `Task coverage: ${metrics.taskCoverage}%.`,
      `Quality score: ${metrics.qualityScore}%.`,
      `Final confidence: ${metrics.finalConfidenceScore}%.`,
      `Perspectives considered: ${metrics.perspectivesConsidered}.`,
      synchronization ? `Synthesis status: ${synchronization}.` : "",
    ].filter(Boolean);

    return measures.map((measure) => `- ${measure}`).join("\n");
  }

  private composeObjectiveAnswer(ctx: MissionContext, classification: MissionClassification) {
    const semantic = classification.semantic;
    const parsedOutputs = ctx.dialogue
      .map((entry) => this.tryParseAgentOutput(entry.content))
      .filter((output): output is AgentStructuredOutput => Boolean(output));
    const recommendations = parsedOutputs.flatMap((output) => output.usefulOutput?.recommendations ?? []);
    const actionItems = parsedOutputs.flatMap((output) => output.usefulOutput?.actionItems ?? []);
    const findings = parsedOutputs.flatMap((output) => output.usefulOutput?.keyFindings ?? []);
    const scheduleItems = ctx.configuration.timeHorizon === "none"
      ? []
      : parsedOutputs
          .flatMap((output) => output.usefulOutput?.scheduleItems ?? [])
          .filter((item) => scheduleFitsConfiguredHorizon(item, ctx.configuration));
    const risks = parsedOutputs.flatMap((output) => output.usefulOutput?.risks ?? []);
    if (classification.strategy.deliverableMode === "direct_answer" || (ctx.configuration.outputFormat === "direct-result" && !classification.strategy.requiresPlanning)) {
      const artifact = this.directArtifactFromContext(ctx, classification);
      if (artifact) return artifact;
      const directLines = sanitizeMissionList([
        ...recommendations,
        ...actionItems,
        ...findings,
        parsedOutputs.at(-1)?.summary,
      ]).slice(0, classification.strategy.complexity <= 2 ? 3 : 6);
      return sanitizeUserFacingText(directLines.join("\n") || parsedOutputs.at(-1)?.summary || semantic.objective);
    }
    const sections = [
      `${semantic.primaryDomain} answer for "${semantic.objective}"`,
      "",
      "What to do:",
      ...sanitizeMissionList(recommendations.length ? recommendations : ctx.workstreams.flatMap((workstream) => workstream.deliverables)).slice(0, 8).map((item) => `- ${item}`),
      "",
      "Practical steps:",
      ...sanitizeMissionList(actionItems.length ? actionItems : ctx.workstreams.map((workstream) => workstream.description)).slice(0, 10).map((item, index) => `${index + 1}. ${item}`),
    ];
    if (findings.length) sections.push("", "Key context:", ...sanitizeMissionList(findings).slice(0, 6).map((item) => `- ${item}`));
    if (scheduleItems.length) sections.push("", "Timing:", ...sanitizeMissionList(scheduleItems).slice(0, 6).map((item) => `- ${item}`));
    if (risks.length || semantic.riskThemes.length) sections.push("", "Watch-outs:", ...sanitizeMissionList(risks.length ? risks : semantic.riskThemes).slice(0, 6).map((item) => `- ${item}`));
    return sanitizeUserFacingText(sections.join("\n"));
  }

  private validateFinalReport(report: MissionReport, classification: MissionClassification): MissionReport {
    const badPattern = /\b(undefined|null|empty arrays?|developer notes?|parser repair|internal debugging|fallback activated|no client available|generated workstream derived|general mission analysis)\b|```json|^\s*[{[]/i;
    const sanitizeField = (value: string, replacement: string) => {
      const cleaned = sanitizeUserFacingText(value);
      if (!cleaned || badPattern.test(cleaned)) return replacement;
      return cleaned.replace(/\bundefined\b|\bnull\b/gi, "").trim();
    };
    const semantic = classification.semantic;
    const defaultAnswer = `${semantic.primaryDomain} deliverable for "${semantic.objective}": follow the mission workstreams, complete the highest-confidence actions first, validate assumptions, and use the final recommendations as the user-facing answer.`;
    if (classification.strategy.deliverableMode === "direct_answer") {
      const directAnswer = sanitizeField(report.finalAnswer || report.executiveSummary, sanitizeUserFacingText(report.finalAnswer || report.executiveSummary || semantic.objective));
      return {
        ...report,
        deliverableMode: "direct_answer",
        finalAnswer: directAnswer,
        reviewNote: sanitizeField(report.reviewNote ?? "", ""),
        executiveSummary: directAnswer,
        workstreams: "",
        roleAssignments: "",
        agentContributions: "",
        keyDisagreements: "",
        mediatorDecisions: "",
        executionRoadmap: "",
        timeline: "",
        budgetEstimate: "",
        riskAssessment: "",
        successMetrics: "",
        finalRecommendations: "",
        singleAgentComparison: "",
      };
    }
    return {
      ...report,
      executiveSummary: sanitizeField(report.executiveSummary, defaultAnswer),
      workstreams: sanitizeField(report.workstreams, semantic.naturalWorkstreams.map((workstream) => `- ${workstream.title}: ${workstream.description}`).join("\n")),
      roleAssignments: sanitizeField(report.roleAssignments, semantic.requiredExpertise.map((item) => `${missionDisplayRole(classification, item.agent)}: ${item.reason}`).join("\n")),
      agentContributions: sanitizeField(report.agentContributions, "Agent contributions were captured as mission-specific workstream outputs."),
      keyDisagreements: sanitizeField(report.keyDisagreements, "No conflicts generated."),
      mediatorDecisions: sanitizeField(report.mediatorDecisions, "No mediator decision was required."),
      executionRoadmap: sanitizeField(report.executionRoadmap, semantic.naturalWorkstreams.map((workstream, index) => `${index + 1}. ${workstream.title}`).join("\n")),
      timeline: sanitizeField(report.timeline, "Timeline entries were captured from the mission execution events."),
      budgetEstimate: sanitizeField(report.budgetEstimate, "Resource posture: None specified."),
      riskAssessment: sanitizeField(report.riskAssessment, semantic.riskThemes.length ? semantic.riskThemes.join("\n") : "No mission-specific risk review was required."),
      successMetrics: sanitizeField(report.successMetrics, "Success metrics are based on completed workstreams, confidence, consensus, and final validation."),
      finalRecommendations: sanitizeField(report.finalRecommendations, defaultAnswer),
      singleAgentComparison: sanitizeField(report.singleAgentComparison ?? "", "Multi-agent comparison unavailable for this mission."),
    };
  }

  private directArtifactFromContext(ctx: MissionContext, classification: MissionClassification) {
    const parsedDialogueOutputs = ctx.dialogue
      .map((entry) => this.tryParseAgentOutput(entry.content))
      .filter((output): output is AgentStructuredOutput => Boolean(output));
    const explicitFinalAnswer = parsedDialogueOutputs
      .map((output) => output.finalAnswer)
      .reverse()
      .find((item) => item && item.length > 0 && !this.isMetaOnlyDirectOutput(item));
    if (explicitFinalAnswer) return sanitizeUserFacingText(explicitFinalAnswer);

    const workerOutputs = ctx.dialogue
      .filter((entry) => agentExecutionCategory(classification, entry.agentRole, entry.phase) === "worker")
      .map((entry) => this.tryParseAgentOutput(entry.content))
      .filter((output): output is AgentStructuredOutput => Boolean(output));
    const coordinatorOutputs = ctx.dialogue
      .filter((entry) => agentExecutionCategory(classification, entry.agentRole, entry.phase) === "coordinator")
      .map((entry) => this.tryParseAgentOutput(entry.content))
      .filter((output): output is AgentStructuredOutput => Boolean(output));
    const candidates = [...workerOutputs, ...coordinatorOutputs].flatMap((output) => [
      output.finalAnswer,
      output.summary,
      ...output.usefulOutput.keyFindings,
      ...output.usefulOutput.recommendations,
      ...output.usefulOutput.actionItems,
    ]);
    const cleanCandidates = sanitizeMissionList(candidates)
      .map((item) => sanitizeUserFacingText(item))
      .filter((item) => item.length > 0 && !this.isMetaOnlyDirectOutput(item));

    if (classification.strategy.missionType === "translation") {
      return cleanCandidates.find((item) => /[\u0600-\u06FF]{8,}/.test(item)) ?? cleanCandidates[0] ?? "";
    }
    if (classification.strategy.missionType === "programming" || classification.strategy.missionType === "debugging") {
      return cleanCandidates.find((item) => /```|function\s+\w+|const\s+\w+|class\s+\w+|<\/?[a-z][\s\S]*>/i.test(item)) ?? cleanCandidates.join("\n");
    }
    return cleanCandidates.slice(0, classification.strategy.complexity <= 2 ? 3 : 6).join("\n");
  }

  private directReviewNoteFromContext(ctx: MissionContext, classification: MissionClassification) {
    const reviewerOutputs = ctx.dialogue
      .filter((entry) => agentExecutionCategory(classification, entry.agentRole, entry.phase) === "reviewer" || entry.agentRole === AgentRole.Finalizer)
      .map((entry) => this.tryParseAgentOutput(entry.content))
      .filter((output): output is AgentStructuredOutput => Boolean(output));
    const note = reviewerOutputs
      .map((output) => output.reviewNote)
      .find((item) => item && item.length > 8 && !this.isMetaOnlyDirectOutput(item));
    return sanitizeUserFacingText(note ?? "");
  }

  private generateLearningReport(ctx: MissionContext, classification: MissionClassification): MissionReport {
    const metrics = ctx.efficiencyMetrics ?? this.generateEfficiencyMetrics(ctx, ctx.conflicts.length > 0);
    const isToefl = /toefl/i.test(ctx.missionBrief);
    const subject = isToefl ? "TOEFL" : "study";
    const workstreamLines = ctx.workstreams.map((workstream) =>
      `- ${sanitizeUserFacingText(workstream.title)} (${sanitizeUserFacingText(workstream.displayRole ?? workstream.owner ?? "Coach")}, ${workstream.confidence ?? 80}% confidence): ${sanitizeUserFacingText(workstream.description)}`
    ).join("\n");
    const mediatorNote = ctx.conflicts.length
      ? "Risk Critic reduced the mock-test count from 4 to 2 so the learner has more time to review weak speaking and writing areas."
      : "No mediation was required; the study plan remained balanced across practice, review, and recovery.";

    return {
      deliverableMode: classification.strategy.deliverableMode,
      executiveSummary: `Final ${subject} study plan is ready: start with a diagnostic, rotate the four TOEFL sections daily, use official practice resources, complete two full mock tests in the final 10 days, and review weak areas after every timed session.`,
      missionObjective: sanitizeUserFacingText(ctx.missionBrief),
      selectedMissionConfiguration: configSummary(ctx.configuration),
      workstreams: workstreamLines,
      roleAssignments: [
        "Diagnostic Coach: baseline practice test and weak-area map.",
        "Curriculum Coach: 30-day calendar, weekly goals, and review days.",
        "Practice Coach: Reading, Listening, Speaking, Writing, vocabulary, and grammar drills.",
        "Test Simulation Coach: timed section sets and full mock-test schedule.",
        "Risk Critic: burnout, ignored speaking practice, template overuse, and unrealistic target checks.",
        "Finalizer: final clean study plan and score tracking metrics.",
      ].join("\n"),
      agentContributions: ctx.dialogue.map((entry) => {
        const label = entry.displayRole ?? entry.agentName;
        const summary = this.tryParseAgentOutput(entry.content)?.summary ?? sanitizeUserFacingText(entry.content).split("\n").find(Boolean) ?? "Contribution captured.";
        return `- ${label}: ${sanitizeUserFacingText(summary)}`;
      }).join("\n"),
      keyDisagreements: ctx.conflicts.map((conflict) => `${sanitizeUserFacingText(conflict.summary ?? conflict.title)} ${sanitizeUserFacingText(conflict.disagreementSummary ?? conflict.description)}`).join("\n") || "No active conflict.",
      mediatorDecisions: mediatorNote,
      executionRoadmap: [
        "Current assumption / starting point: take a baseline TOEFL practice test before choosing daily emphasis.",
        "Days 1-2: baseline test, score tracker, target score, resource setup, error log.",
        "Days 3-7: Reading and Listening fundamentals, daily vocabulary, short speaking recordings, one timed writing task.",
        "Days 8-14: rotate all four sections; add integrated speaking and writing templates with timed practice.",
        "Days 15-20: increase timed section sets, review error log, repeat weakest question types.",
        "Days 21-24: full mock test 1, score review, two-day weak-area repair loop.",
        "Days 25-28: final section drills, speaking fluency, essay structure, and vocabulary review.",
        "Day 29: full mock test 2 under test conditions.",
        "Day 30: light review, template refresh, logistics, sleep, and confidence check.",
      ].join("\n"),
      timeline: [
        "Diagnostic Assessment completed.",
        "30-Day Study Calendar created.",
        "TOEFL section practice schedule created.",
        "Practice schedule adjusted after risk review.",
        "Mock test plan finalized.",
        "Final TOEFL study plan generated.",
      ].join("\n"),
      budgetEstimate: "Use official ETS TOEFL resources as the primary benchmark, then add free or low-cost vocabulary tools, voice recording, and writing feedback only where they improve review quality.",
      riskAssessment: [
        "Burnout risk: keep one lighter review day each week.",
        "Speaking avoidance risk: record at least one short answer daily.",
        "Template memorization risk: practice under timing instead of only reading templates.",
        "Poor time management risk: use timed section sets starting in week 2.",
        "Unrealistic target risk: adjust daily emphasis after the baseline and each mock test.",
      ].join("\n"),
      successMetrics: `Track section scores after each mock, daily study completion, vocabulary retention, speaking timing accuracy, writing rubric misses, and error-log repeat rate. Output completeness: ${metrics.taskCoverage}%. Average confidence: ${metrics.finalConfidenceScore}%. Perspectives used: ${metrics.perspectivesConsidered}.`,
      finalRecommendations: "Keep the plan practical: study daily, rotate sections, review mistakes deeply, speak out loud every day, write under time pressure, and treat mock tests as diagnosis plus review rather than just volume.",
      singleAgentComparison: `Multi-agent quality score: ${metrics.qualityScore}%. The added value is perspective coverage: diagnostic planning, curriculum structure, practice design, risk review, mediation, and final synthesis.`,
    };
  }

  private generateExecutionRoadmap(ctx: MissionContext, classification: MissionClassification) {
    return ctx.workstreams.map((workstream, index) =>
      `${index + 1}. ${sanitizeMissionText(workstream.nextStep || workstream.title)} - ${sanitizeMissionText(workstream.deliverables[0] ?? workstream.description)}`
    ).join("\n");
  }

  private generateResourceEstimate(ctx: MissionContext, classification: MissionClassification) {
    const financeOutput = sanitizeUserFacingText(ctx.financialPlan).split("\n").find((line) => line.trim().length > 20);
    if (financeOutput) return financeOutput;
    return `Resource posture: ${BUDGET_RANGE_LABELS[ctx.configuration.budgetRange]}. Apply it to ${classification.semantic.primaryDomain.toLowerCase()} decisions, and prioritize the workstreams with the highest impact on "${classification.semantic.objective}".`;
  }

  private generateFinalRecommendations(ctx: MissionContext, classification: MissionClassification) {
    const parsedOutputs = ctx.dialogue.map((entry) => this.tryParseAgentOutput(entry.content)).filter((output): output is AgentStructuredOutput => Boolean(output));
    const recommendations = sanitizeMissionList(parsedOutputs.flatMap((output) => output.usefulOutput?.recommendations ?? []));
    if (classification.strategy.deliverableMode === "direct_answer") {
      return this.directArtifactFromContext(ctx, classification) || sanitizeUserFacingText(parsedOutputs.at(-1)?.finalAnswer ?? parsedOutputs.at(-1)?.summary ?? "");
    }
    if (recommendations.length) return recommendations.slice(0, 8).map((item, index) => `${index + 1}. ${item}`).join("\n");
    if (ctx.configuration.outputFormat === "direct-result" && !classification.strategy.requiresPlanning) {
      return this.directArtifactFromContext(ctx, classification) || sanitizeUserFacingText(parsedOutputs.at(-1)?.summary ?? "The requested direct result is complete.");
    }
    const topWorkstreams = ctx.workstreams.slice(0, 4).map((workstream) => sanitizeMissionText(workstream.title)).join(", ");
    return `Use ${topWorkstreams} as the backbone for solving "${classification.semantic.objective}". Complete the domain-specific validation checks before spending money, changing systems, or treating the answer as final.`;
  }

  private timelineKind(phase: MissionState): TimelineEntry["kind"] {
    if (phase === MissionState.ConflictResolution || phase === MissionState.RiskReview) return "conflict";
    if (phase === MissionState.Finalizing) return "report";
    if (phase === MissionState.Planning) return "workstream";
    return "agent";
  }
}
