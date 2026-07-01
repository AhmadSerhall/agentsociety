import {
  AgentRole,
  BUDGET_RANGE_LABELS,
  DEPTH_LABELS,
  MISSION_TYPE_LABELS,
  MissionState,
  OUTPUT_FORMAT_LABELS,
  RISK_TOLERANCE_LABELS,
  TIME_HORIZON_LABELS,
  type MissionConfiguration,
  type MissionContext,
} from "@/types";

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

  generate(phase: MissionState, ctx: MissionContext): string {
    switch (phase) {
      case MissionState.Planning:
        return this.planner(ctx);
      case MissionState.Researching:
        return this.research(ctx);
      case MissionState.ProductStrategy:
        return this.product(ctx);
      case MissionState.TechnicalArchitecture:
        return this.technical(ctx);
      case MissionState.MarketingStrategy:
        return this.marketing(ctx);
      case MissionState.FinancialAnalysis:
        return this.finance(ctx);
      case MissionState.RiskReview:
        return this.risk(ctx);
      case MissionState.ConflictResolution:
        return this.mediator(ctx);
      case MissionState.Finalizing:
        return this.finalizer(ctx);
      default:
        return "Mission phase complete.";
    }
  }

  private planner(ctx: MissionContext) {
    const { configuration } = ctx;
    return `## Planner Output

${configLine(configuration)}

${depthQualifier(configuration)}

**Workstream 1: Strategic Discovery**
- Owner: Research Agent
- Confidence: 86
- Description: Validate the mission assumptions, target users, market context, constraints, and success criteria for this ${missionNoun(configuration)}.
- Deliverables: Assumption map; stakeholder profile; validation checklist

**Workstream 2: Solution & MVP Definition**
- Owner: Product Strategist
- Confidence: 88
- Description: Convert the brief into a prioritized offer, scope, user journey, and phased roadmap.
- Deliverables: MVP scope; feature priority matrix; success metrics

**Workstream 3: Technical Execution Plan**
- Owner: Technical Architect
- Confidence: 84
- Description: Define the implementation architecture, dependencies, integration risks, and delivery sequence.
- Deliverables: Architecture blueprint; build phases; dependency register

**Workstream 4: Market Activation**
- Owner: Marketing Strategist
- Confidence: 82
- Description: Shape positioning, channels, launch narrative, and demand-generation milestones.
- Deliverables: GTM plan; campaign calendar; launch messaging

**Workstream 5: Risk, Budget & Governance**
- Owner: Finance Agent
- Confidence: 80
- Description: Estimate resourcing, budget range, operating constraints, and risk controls.
- Deliverables: Budget model; risk register; governance checkpoints`;
  }

  private research(ctx: MissionContext) {
    return `## Research Agent Findings

The mission brief points to a ${missionNoun(ctx.configuration)} requiring clarity on users, constraints, and adoption friction.

- The strongest opportunity is to narrow the first release around a painful operational workflow rather than a broad platform promise.
- ${TIME_HORIZON_LABELS[ctx.configuration.timeHorizon]} requires explicit sequencing: validation first, build second, launch third.
- ${DEPTH_LABELS[ctx.configuration.depth]} means the plan should include assumptions, confidence levels, and decision gates.
- For ${BUDGET_RANGE_LABELS[ctx.configuration.budgetRange]}, resource trade-offs should be visible in the roadmap.

Research recommendation: run a validation sprint before heavy execution, document objection patterns, and use those findings to prioritize the final scope.`;
  }

  private product(ctx: MissionContext) {
    return `## Product Strategist Output

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

  private technical(ctx: MissionContext) {
    return `## Technical Architect Output

Architecture stance: frontend-only Mission Control remains valid for this stage. Qwen calls should stay in the browser via NEXT_PUBLIC configuration, with mock mode as the reliable fallback.

Implementation priorities:
- Preserve MissionEngine as the orchestration layer.
- Keep AgentRegistry separate from UI panels.
- Treat mock output as a first-class runner for demos and offline use.
- Keep panels reactive to MissionContext instead of duplicating state.

Concern: the ${TIME_HORIZON_LABELS[ctx.configuration.timeHorizon]} timeline is aggressive if the scope grows beyond the current frontend-only cockpit. The MVP should avoid backend, auth, database, or persistence expansion until the core workflow feels excellent.`;
  }

  private marketing(ctx: MissionContext) {
    return `## Marketing Strategist Output

The launch narrative should emphasize a premium AI Mission Control experience where specialists collaborate, disagree, and synthesize a professional plan.

Campaign plan:
- Position as "multi-agent strategy execution for complex objectives."
- Use short demos showing the Planner, Risk Critic, Mediator, and Finalizer in sequence.
- Turn conflicts into proof: disagreement makes the output more trustworthy.
- For ${RISK_TOLERANCE_LABELS[ctx.configuration.riskTolerance]} risk tolerance, message the system as ${ctx.configuration.riskTolerance === "aggressive" ? "fast-moving but governed" : "structured, reviewable, and controlled"}.

Launch recommendation: ship a polished demo workflow before adding more product surface area.`;
  }

  private finance(ctx: MissionContext) {
    return `## Finance Agent Output

Budget posture: ${BUDGET_RANGE_LABELS[ctx.configuration.budgetRange]}.

Resource plan:
- Keep near-term investment focused on frontend quality, agent orchestration, and report credibility.
- Delay backend/database work until there is a validated need.
- Allocate effort across UI polish, prompt quality, QA, and documentation.

Financial concern: if the team tries to satisfy every requested feature inside ${TIME_HORIZON_LABELS[ctx.configuration.timeHorizon]}, scope creep will reduce quality. A smaller, credible Mission Control workflow is the better asset.`;
  }

  private risk(ctx: MissionContext) {
    return `## Risk Critic Assessment

CONFLICT_DETECTED: true

### Meaningful Disagreement
The Technical Architect says the MVP timeline is too aggressive if architecture expands beyond frontend-only Mission Control. The Marketing Strategist wants a faster launch to capture momentum. The Finance Agent says the budget is constrained and should not absorb backend/database scope.

### Risk Level
High

### Why it matters
If the team chases a faster launch and broader architecture at the same time, the product will feel shallow and brittle. The Mission Control workflow needs believable agent progression, readable outputs, conflict resolution, and professional reporting before expanding.

### Suggested Fix
Keep the launch focused on frontend-only Mission Control, slow the mock flow enough to feel real, and use the Mediator to convert disagreement into a phased execution plan.`;
  }

  private mediator(ctx: MissionContext) {
    return `## Mediator Decision

### Conflict Resolved
The Technical Architect, Marketing Strategist, Finance Agent, and Risk Critic disagree on speed versus scope.

### Decision
Proceed with a polished frontend-only Mission Control MVP. Do not add backend or database scope. The launch can remain ambitious, but the workflow must feel real: sequential agents, visible progress, completed workstreams, a meaningful conflict, and a final report derived from the mission brief and configuration.

### Final Resolved Action
Use ${DEPTH_LABELS[ctx.configuration.depth]} to determine report depth, ${TIME_HORIZON_LABELS[ctx.configuration.timeHorizon]} to shape roadmap urgency, and ${OUTPUT_FORMAT_LABELS[ctx.configuration.outputFormat]} to shape the final deliverable.`;
  }

  private finalizer(ctx: MissionContext) {
    return `## Finalizer Synthesis

The mission is ready to package as a professional ${OUTPUT_FORMAT_LABELS[ctx.configuration.outputFormat]}. The final report should explicitly include the selected mission configuration, completed workstreams, agent contributions, conflict resolution, timeline, efficiency metrics, and a single-agent versus Agent Society comparison.

Recommendation: proceed with the current frontend-only architecture, keep Qwen/mock separation, and treat disagreement as a visible quality signal in the Mission Control experience.`;
  }
}
