import {
  AgentRole,
  BUDGET_RANGE_LABELS,
  DEPTH_LABELS,
  MISSION_TYPE_LABELS,
  MissionState,
  OUTPUT_FORMAT_LABELS,
  RISK_TOLERANCE_LABELS,
  TIME_HORIZON_LABELS,
  type ExecutionTask,
  type MissionConfiguration,
  type MissionContext,
} from "@/types";

type MissionIntent =
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

interface MockMissionClassification {
  intent: MissionIntent;
  semantic?: {
    objective: string;
    primaryDomain: string;
    secondaryDomains: string[];
    intent: string;
    relevantConcepts: string[];
    riskThemes: string[];
    naturalWorkstreams: Array<{
      title: string;
      description: string;
      agent: AgentRole;
      supportingAgents?: AgentRole[];
      deliverables: string[];
      acceptanceCriteria: string[];
      expectedOutputs: string[];
      dependencies?: number[];
    }>;
  };
}

const MOCK_TIMINGS: Partial<Record<MissionState, number>> = {
  [MissionState.Planning]: 2500,
  [MissionState.Researching]: 3000,
  [MissionState.ProductStrategy]: 2500,
  [MissionState.TechnicalArchitecture]: 3000,
  [MissionState.MarketingStrategy]: 2500,
  [MissionState.FinancialAnalysis]: 2000,
  [MissionState.RiskReview]: 2000,
  [MissionState.ConflictResolution]: 2000,
  [MissionState.Finalizing]: 3000,
};

function configLine(config: MissionConfiguration) {
  return [
    `Mission Type: ${MISSION_TYPE_LABELS[config.missionType]}`,
    `Depth: ${DEPTH_LABELS[config.depth]}`,
    `Time Horizon: ${TIME_HORIZON_LABELS[config.timeHorizon]}`,
    `Budget: ${BUDGET_RANGE_LABELS[config.budgetRange]}`,
    `Risk Tolerance: ${RISK_TOLERANCE_LABELS[config.riskTolerance]}`,
    `Output Format: ${OUTPUT_FORMAT_LABELS[config.outputFormat]}`,
  ].join("\n");
}

function depthQualifier(config: MissionConfiguration) {
  if (config.depth === "deep-analysis") {
    return "Deep analysis mode expands assumptions, second-order risks, dependencies, and validation checkpoints.";
  }
  if (config.depth === "fast") {
    return "Fast mode prioritizes a lean scope, rapid sequencing, and only the most critical risks.";
  }
  return "Balanced mode keeps strategy, execution, and risk controls in proportion.";
}

function missionNoun(config: MissionConfiguration) {
  return MISSION_TYPE_LABELS[config.missionType].toLowerCase();
}

export class MockAgentRunner {
  getDelay(phase: MissionState) {
    return MOCK_TIMINGS[phase] ?? 1800;
  }

  generate(phase: MissionState, ctx: MissionContext, task?: ExecutionTask, classification?: MockMissionClassification): string {
    switch (phase) {
      case MissionState.Planning:
        return this.planner(ctx, classification);
      case MissionState.Researching:
        return this.research(ctx, task);
      case MissionState.ProductStrategy:
        return this.product(ctx, task);
      case MissionState.TechnicalArchitecture:
        return this.technical(ctx, task);
      case MissionState.MarketingStrategy:
        return this.marketing(ctx, task);
      case MissionState.FinancialAnalysis:
        return this.finance(ctx, task);
      case MissionState.RiskReview:
        return this.risk(ctx, task, classification);
      case MissionState.ConflictResolution:
        return this.mediator(ctx, classification);
      case MissionState.Finalizing:
        return this.finalizer(ctx, classification);
      default:
        return "Mission phase complete.";
    }
  }

  private planner(ctx: MissionContext, classification?: MockMissionClassification) {
    const { configuration } = ctx;
    const focus = this.extractMissionFocus(ctx.missionBrief);
    const noun = missionNoun(configuration);
    if (classification?.semantic?.naturalWorkstreams?.length) {
      return JSON.stringify({
        summary: `${classification.semantic.primaryDomain} plan for ${classification.semantic.objective}`,
        workstreams: classification.semantic.naturalWorkstreams.map((workstream, index) => ({
          id: `semantic-${index + 1}`,
          title: workstream.title,
          description: workstream.description,
          primaryAgentId: workstream.agent,
          supportingAgentIds: workstream.supportingAgents ?? [],
          dependencies: workstream.dependencies?.map((dependency) => `semantic-${dependency}`) ?? [],
          parallelGroup: index + 1,
          expectedDeliverables: workstream.deliverables,
          acceptanceCriteria: workstream.acceptanceCriteria,
          expectedOutputs: workstream.expectedOutputs,
          riskAreas: classification.semantic?.riskThemes ?? [],
          confidence: Math.max(70, 88 - index * 3),
        })),
        parallelGroups: classification.semantic.naturalWorkstreams.map((workstream, index) => ({
          id: `group-${index + 1}`,
          title: workstream.title,
          description: workstream.description,
          taskIds: [`semantic-${index + 1}`],
        })),
        conflictZones: [],
        synthesisReadinessCriteria: ["domain understood", "useful agents selected", "workstreams completed", "final answer validated"],
      });
    }
    if (classification?.intent === "exam_preparation" || classification?.intent === "learning_plan") {
      return JSON.stringify({
        summary: "Create a practical study plan with diagnostic testing, daily section practice, resources, mock tests, risk controls, and final synthesis.",
        workstreams: [
          { id: "diagnostic", title: "Diagnostic Assessment", description: "Estimate current level across Reading, Listening, Speaking, and Writing with a baseline practice test and weak-area review.", primaryAgentId: "researcher", supportingAgentIds: [], dependencies: [], parallelGroup: 1, expectedDeliverables: ["baseline test plan", "section score tracker", "weak-area list"], riskAreas: ["unclear starting score"], confidence: 86 },
          { id: "calendar", title: "30-Day Study Calendar", description: "Build a week-by-week calendar with daily routine, section rotation, review days, and mock exam days.", primaryAgentId: "product-strategist", supportingAgentIds: ["researcher"], dependencies: ["diagnostic"], parallelGroup: 2, expectedDeliverables: ["30-day calendar", "daily routine", "weekly goals"], riskAreas: ["unrealistic daily workload"], confidence: 84 },
          { id: "practice", title: "TOEFL Section Practice", description: "Create Reading drills, Listening drills, Speaking templates, Writing templates, vocabulary routine, and grammar review.", primaryAgentId: "technical-architect", supportingAgentIds: [], dependencies: ["diagnostic"], parallelGroup: 2, expectedDeliverables: ["section drills", "speaking routine", "writing feedback loop"], riskAreas: ["ignoring speaking practice"], confidence: 83 },
          { id: "resources", title: "Resources and Tools", description: "Choose official ETS resources, practice tests, vocabulary tools, speaking recording method, and writing feedback method.", primaryAgentId: "researcher", supportingAgentIds: [], dependencies: ["diagnostic"], parallelGroup: 2, expectedDeliverables: ["resource list", "practice test sources", "feedback tools"], riskAreas: ["low-quality practice materials"], confidence: 82 },
          { id: "mock-tests", title: "Mock Test and Score Improvement Plan", description: "Schedule full simulations, timing strategy, scoring review, weak-area loops, and final week plan.", primaryAgentId: "technical-architect", supportingAgentIds: ["risk-critic"], dependencies: ["calendar", "practice"], parallelGroup: 3, expectedDeliverables: ["mock test schedule", "timing strategy", "score review loop"], riskAreas: ["too many mocks without review"], confidence: 81 },
          { id: "risk-review", title: "Risk Review", description: "Identify burnout, ignored speaking, template memorization, poor time management, and unrealistic score target risks.", primaryAgentId: "risk-critic", supportingAgentIds: [], dependencies: ["calendar", "practice", "mock-tests"], parallelGroup: 4, expectedDeliverables: ["risk register", "mitigation checklist", "plan adjustments"], riskAreas: ["burnout"], confidence: 79 },
          { id: "final-plan", title: "Final Study Plan", description: "Produce a clean 30-day actionable study plan with daily tasks, weekly goals, mock tests, resources, and success metrics.", primaryAgentId: "finalizer", supportingAgentIds: ["planner"], dependencies: ["calendar", "practice", "resources", "mock-tests", "risk-review"], parallelGroup: 5, expectedDeliverables: ["final study plan", "daily tasks", "success metrics"], riskAreas: [], confidence: 84 }
        ],
        parallelGroups: [
          { id: "group-1", title: "Diagnostic", description: "Find the learner's starting point.", taskIds: ["diagnostic"] },
          { id: "group-2", title: "Plan and Practice Design", description: "Create schedule, drills, and resources.", taskIds: ["calendar", "practice", "resources"] },
          { id: "group-3", title: "Simulation Planning", description: "Set mock tests and review loop.", taskIds: ["mock-tests"] },
          { id: "group-4", title: "Risk Review", description: "Balance intensity with sustainability.", taskIds: ["risk-review"] },
          { id: "group-5", title: "Final Synthesis", description: "Assemble the final plan.", taskIds: ["final-plan"] }
        ],
        conflictZones: [{ title: "Mock test volume vs review time", agentsInvolved: ["technical-architect", "risk-critic"], reason: "More full mocks build stamina, but too many reduce review time for weak speaking and writing areas." }],
        synthesisReadinessCriteria: ["baseline captured", "calendar completed", "section drills defined", "risk review complete", "mock test plan balanced"]
      });
    }
    const technicalWorkstreams = [
      {
        title: "Performance Profiling & Baseline Measurement",
        owner: "Technical Architect",
        confidence: 86,
        description: `Measure current slowness, reproduction paths, Core Web Vitals, React profiler traces, and user-visible latency for ${focus.shortBrief}.`,
        deliverables: "Performance baseline; reproduction checklist; measurement plan",
        dependencies: "None",
      },
      {
        title: "Render & Re-render Analysis",
        owner: "Technical Architect",
        confidence: 84,
        description: "Identify expensive renders, unnecessary re-renders, context churn, missing memoization, and component hot paths.",
        deliverables: "Render hot spot list; component trace notes; memoization candidates",
        dependencies: "Workstream 1",
      },
      {
        title: "Network/API/Data Fetching Audit",
        owner: "Risk Critic",
        confidence: 81,
        description: "Separate React rendering cost from API latency, request waterfalls, duplicate fetching, cache misses, and backend/network bottlenecks.",
        deliverables: "Request waterfall map; latency split; data fetching fixes",
        dependencies: "Workstream 1",
      },
      {
        title: "Bundle/Asset Optimization",
        owner: "Technical Architect",
        confidence: 80,
        description: "Inspect bundle size, third-party scripts, dynamic imports, asset weight, and route-level loading behavior.",
        deliverables: "Bundle report; code splitting plan; asset optimization list",
        dependencies: "Workstream 1",
      },
      {
        title: "State Management & Component Architecture Review",
        owner: "Technical Architect",
        confidence: 79,
        description: "Review state ownership, derived state, global store subscriptions, component boundaries, and architecture changes needed for durable performance.",
        deliverables: "State ownership map; architecture refactor candidates; risk notes",
        dependencies: "Workstream 2",
      },
      {
        title: "Prioritized Optimization Roadmap",
        owner: "Finalizer",
        confidence: 82,
        description: "Sequence quick wins, deeper refactors, regression tests, monitoring, and rollout strategy.",
        deliverables: "Prioritized roadmap; regression checklist; monitoring plan",
        dependencies: "Workstream 2; Workstream 3; Workstream 4; Workstream 5",
      },
    ];

    const architectureDecisionWorkstreams = [
      {
        title: "Current SPA Architecture Baseline",
        owner: "Technical Architect",
        confidence: 84,
        description: `Assess the current React SPA architecture, constraints, routing, data fetching, performance, and maintainability for ${focus.shortBrief}.`,
        deliverables: "Current-state architecture map; constraint list; technical debt inventory",
        dependencies: "None",
      },
      {
        title: "Next.js Migration Benefit Analysis",
        owner: "Technical Architect",
        confidence: 82,
        description: "Evaluate SSR/SSG, routing, performance, deployment, SEO, and developer workflow gains from rebuilding in Next.js.",
        deliverables: "Migration benefit matrix; implementation implications; adoption prerequisites",
        dependencies: "Workstream 1",
      },
      {
        title: "Product & User Impact Review",
        owner: "Product Strategist",
        confidence: 80,
        description: "Assess whether migration improves user outcomes enough to justify disruption and roadmap delay.",
        deliverables: "User impact notes; roadmap disruption map; decision criteria",
        dependencies: "Workstream 1",
      },
      {
        title: "Cost, Risk & Delivery Tradeoff Review",
        owner: "Risk Critic",
        confidence: 78,
        description: "Compare rebuild risk, incremental improvement risk, migration cost, QA burden, and rollback options.",
        deliverables: "Tradeoff register; risk matrix; mitigation plan",
        dependencies: "Workstream 2; Workstream 3",
      },
      {
        title: "Decision Roadmap",
        owner: "Finalizer",
        confidence: 83,
        description: "Recommend rebuild, incremental modernization, or hybrid migration with concrete decision gates.",
        deliverables: "Decision recommendation; phased roadmap; success metrics",
        dependencies: "Workstream 2; Workstream 3; Workstream 4",
      },
    ];

    const businessWorkstreams = [
      {
        title: `${focus.primary} Discovery & Validation`,
        owner: "Research Agent",
        confidence: 84,
        description: `Validate audience, constraints, current alternatives, and adoption friction for ${focus.shortBrief}.`,
        deliverables: "Assumption map; evidence checklist; stakeholder profile",
        dependencies: "None",
      },
      {
        title: `${focus.primary} Offer & Experience Design`,
        owner: "Product Strategist",
        confidence: 86,
        description: `Turn validated findings into a focused ${noun} scope, user journey, priorities, and success criteria.`,
        deliverables: "Scope brief; priority matrix; success metrics",
        dependencies: "Workstream 1",
      },
      {
        title: `${focus.primary} Execution Architecture`,
        owner: "Technical Architect",
        confidence: 82,
        description: `Define implementation sequence, constraints, integration points, and delivery risks for the selected roadmap.`,
        deliverables: "Architecture plan; dependency register; delivery sequence",
        dependencies: "Workstream 2",
      },
      {
        title: `${focus.primary} Market Activation`,
        owner: "Marketing Strategist",
        confidence: 81,
        description: `Shape positioning, launch narrative, channels, and campaign milestones around the mission objective.`,
        deliverables: "Positioning brief; launch calendar; message map",
        dependencies: "Workstream 2",
      },
      {
        title: `${focus.primary} Resource & Risk Governance`,
        owner: configuration.riskTolerance === "conservative" ? "Risk Critic" : "Finance Agent",
        confidence: 79,
        description: `Model budget, operating constraints, risk controls, and go/no-go checkpoints for ${TIME_HORIZON_LABELS[configuration.timeHorizon]}.`,
        deliverables: "Budget model; risk register; governance checkpoints",
        dependencies: "Workstream 1; Workstream 2",
      },
    ];
    const workstreams = classification?.intent === "technical_debugging"
      ? technicalWorkstreams
      : classification?.intent === "product_strategy"
        ? architectureDecisionWorkstreams
        : businessWorkstreams;

    return `## Planner Output

${configLine(configuration)}

${depthQualifier(configuration)}

Mission interpretation: ${focus.shortBrief}

${workstreams.map((workstream, index) => `**Workstream ${index + 1}: ${workstream.title}**
- Owner: ${workstream.owner}
- Confidence: ${workstream.confidence}
- Description: ${workstream.description}
- Dependencies: ${workstream.dependencies}
- Deliverables: ${workstream.deliverables}`).join("\n\n")}`;
  }

  private research(ctx: MissionContext, task?: ExecutionTask) {
    return `## Research Agent Findings

Task focus: ${task?.title ?? "Strategic research"}.

The mission brief points to a ${missionNoun(ctx.configuration)} requiring clarity on users, constraints, and adoption friction.

- The strongest opportunity is to narrow the first release around a painful operational workflow rather than a broad platform promise.
- ${TIME_HORIZON_LABELS[ctx.configuration.timeHorizon]} requires explicit sequencing: validation first, build second, launch third.
- ${DEPTH_LABELS[ctx.configuration.depth]} means the plan should include assumptions, confidence levels, and decision gates.
- For ${BUDGET_RANGE_LABELS[ctx.configuration.budgetRange]}, resource trade-offs should be visible in the roadmap.

Research recommendation: run a validation sprint before heavy execution, document objection patterns, and use those findings to prioritize the final scope.`;
  }

  private product(ctx: MissionContext, task?: ExecutionTask) {
    return `## Product Strategist Output

Task focus: ${task?.title ?? "Product strategy"}.

The product direction should be framed as a focused ${MISSION_TYPE_LABELS[ctx.configuration.missionType]} system, not a generic plan.

Core strategy:
- Define one primary operator persona and two secondary stakeholders.
- Prioritize features that produce measurable outcomes inside ${TIME_HORIZON_LABELS[ctx.configuration.timeHorizon]}.
- Package the first release as a guided mission cockpit: brief, agent collaboration, conflict resolution, and final report.
- Use ${OUTPUT_FORMAT_LABELS[ctx.configuration.outputFormat]} as the final deliverable shape.

Success metrics:
- Clear activation milestone
- Completion rate for the first mission
- Quality score from final report review
- Number of risks discovered before execution`;
  }

  private technical(ctx: MissionContext, task?: ExecutionTask) {
    return `## Technical Architect Output

Task focus: ${task?.title ?? "Technical architecture"}.

Architecture stance: frontend-only Mission Control remains valid for this stage. Qwen calls should stay in the browser via NEXT_PUBLIC configuration, with mock mode as the reliable fallback.

Implementation priorities:
- Preserve MissionEngine as the orchestration layer.
- Keep AgentRegistry separate from UI panels.
- Treat mock output as a first-class runner for demos and offline use.
- Keep panels reactive to MissionContext instead of duplicating state.

Concern: the ${TIME_HORIZON_LABELS[ctx.configuration.timeHorizon]} timeline is aggressive if the scope grows beyond the current frontend-only cockpit. The MVP should avoid backend, auth, database, or persistence expansion until the core workflow feels excellent.`;
  }

  private marketing(ctx: MissionContext, task?: ExecutionTask) {
    return `## Marketing Strategist Output

Task focus: ${task?.title ?? "Market activation"}.

The launch narrative should emphasize a premium AI Mission Control experience where specialists collaborate, disagree, and synthesize a professional plan.

Campaign plan:
- Position as "multi-agent strategy execution for complex objectives."
- Use short demos showing the Planner, Risk Critic, Mediator, and Finalizer in sequence.
- Turn conflicts into proof: disagreement makes the output more trustworthy.
- For ${RISK_TOLERANCE_LABELS[ctx.configuration.riskTolerance]} risk tolerance, message the system as ${ctx.configuration.riskTolerance === "aggressive" ? "fast-moving but governed" : "structured, reviewable, and controlled"}.

Launch recommendation: ship a polished demo workflow before adding more product surface area.`;
  }

  private finance(ctx: MissionContext, task?: ExecutionTask) {
    return `## Finance Agent Output

Task focus: ${task?.title ?? "Financial analysis"}.

Budget posture: ${BUDGET_RANGE_LABELS[ctx.configuration.budgetRange]}.

Resource plan:
- Keep near-term investment focused on frontend quality, agent orchestration, and report credibility.
- Delay backend/database work until there is a validated need.
- Allocate effort across UI polish, prompt quality, QA, and documentation.

Financial concern: if the team tries to satisfy every requested feature inside ${TIME_HORIZON_LABELS[ctx.configuration.timeHorizon]}, scope creep will reduce quality. A smaller, credible Mission Control workflow is the better asset.`;
  }

  private risk(ctx: MissionContext, task?: ExecutionTask, classification?: MockMissionClassification) {
    if (classification?.intent === "technical_debugging") {
      return `## Risk Critic Assessment

Task focus: ${task?.title ?? "Performance risk review"}.

CONFLICT_DETECTED: true

### Meaningful Disagreement
The Technical Architect can deliver quick memoization and bundle fixes, but deeper render/data-flow refactors may be required if profiling shows structural bottlenecks.

### Risk Level
High

### Why it matters
Optimizing before measurement can hide the real source of slowness. React render work, network/API latency, asset weight, and state subscription churn must be separated before committing to fixes.

### Suggested Fix
Require baseline profiling first, apply quick wins only where traces prove impact, and schedule deeper architecture refactors for repeated hot paths with regression monitoring.`;
    }

    if (classification?.intent === "product_strategy") {
      return `## Risk Critic Assessment

Task focus: ${task?.title ?? "Architecture decision risk"}.

CONFLICT_DETECTED: true

### Meaningful Disagreement
Rebuilding in Next.js may improve long-term architecture, but keeping the React SPA may reduce migration risk and protect current delivery speed.

### Risk Level
High

### Why it matters
A rebuild can consume roadmap capacity, introduce regressions, and delay user-facing improvements. Staying put can preserve speed but leave structural problems unresolved.

### Suggested Fix
Use a decision matrix: migration benefit, user impact, delivery cost, rollback strategy, and measurable success criteria. Prefer incremental migration unless the benefits are clearly proven.`;
    }

    return `## Risk Critic Assessment

Task focus: ${task?.title ?? "Risk review"}.

CONFLICT_DETECTED: true

### Meaningful Disagreement
The Technical Architect says the MVP timeline is too aggressive if architecture expands beyond frontend-only Mission Control. The Marketing Strategist wants a faster launch to capture momentum. The Finance Agent says the budget is constrained and should not absorb backend/database scope.

### Risk Level
High

### Why it matters
If the team chases a faster launch and broader architecture at the same time, the product will feel shallow and brittle. The Mission Control workflow needs believable agent progression, readable outputs, conflict resolution, and professional reporting before expanding.

### Suggested Fix
Keep the plan focused, validate before expanding spend or scope, and use the Mediator to convert disagreement into a phased execution plan.`;
  }

  private extractMissionFocus(brief: string) {
    const cleaned = brief.replace(/\s+/g, " ").trim();
    const words = cleaned
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !["with", "from", "that", "this", "into", "plan", "launch", "mission", "using", "today"].includes(word));
    const primary = words.slice(0, 3).map((word) => word[0].toUpperCase() + word.slice(1)).join(" ") || "Mission";
    return {
      primary,
      shortBrief: cleaned.length > 140 ? `${cleaned.slice(0, 137)}...` : cleaned,
    };
  }

  private mediator(ctx: MissionContext, classification?: MockMissionClassification) {
    if (classification?.intent === "technical_debugging") {
      return `## Mediator Decision

### Conflict Resolved
The technical path must balance quick performance fixes against deeper architecture correction.

### Decision
Start with profiling and baseline measurement. Apply quick wins only when profiler/network evidence proves impact. Schedule deeper state, component, or data-fetching refactors for bottlenecks that remain after measurement-backed fixes.

### Final Resolved Action
Separate render, network/API, bundle, and state-management causes before prioritizing the optimization roadmap.`;
    }

    if (classification?.intent === "product_strategy") {
      return `## Mediator Decision

### Conflict Resolved
The rebuild decision must balance architecture quality, user impact, migration risk, and delivery speed.

### Decision
Do not choose a full rebuild by default. Compare Next.js migration against incremental SPA modernization using measurable criteria: performance gains, routing/data needs, SEO requirements, regression risk, and team capacity.

### Final Resolved Action
Recommend the lowest-risk path that achieves the required product and architecture outcomes, with migration gates if Next.js is selected.`;
    }

    return `## Mediator Decision

### Conflict Resolved
The Technical Architect, Marketing Strategist, Finance Agent, and Risk Critic disagree on speed versus scope.

### Decision
Proceed with a polished frontend-only Mission Control MVP. Do not add backend or database scope. The launch can remain ambitious, but the workflow must feel real: sequential agents, visible progress, completed workstreams, a meaningful conflict, and a final report derived from the mission brief and configuration.

### Final Resolved Action
Use ${DEPTH_LABELS[ctx.configuration.depth]} to determine report depth, ${TIME_HORIZON_LABELS[ctx.configuration.timeHorizon]} to shape roadmap urgency, and ${OUTPUT_FORMAT_LABELS[ctx.configuration.outputFormat]} to shape the final deliverable.`;
  }

  private finalizer(ctx: MissionContext, classification?: MockMissionClassification) {
    if (classification?.intent === "technical_debugging") {
      return `## Finalizer Synthesis

The mission should be packaged as a technical optimization plan built from profiling, render analysis, network/API audit, bundle review, architecture review, risk objections, and mediator decisions.

Recommendation: measure first, optimize second, validate third. Prioritize changes by observed user impact and regression risk.`;
    }

    return `## Finalizer Synthesis

The mission is ready to package as a professional ${OUTPUT_FORMAT_LABELS[ctx.configuration.outputFormat]}. The final report should explicitly include the selected mission configuration, completed workstreams, agent contributions, conflict resolution, timeline, efficiency metrics, and a single-agent versus Agent Society comparison.

Recommendation: proceed with the current frontend-only architecture, keep Qwen/mock separation, and treat disagreement as a visible quality signal in the Mission Control experience.`;
  }
}
