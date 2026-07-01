/**
 * Agent Society — 9 Fixed Agent Definitions
 */

import { AgentRole, AgentStatus, type AgentDefinition } from "@/types";

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    id: "agent-planner",
    name: "Planner",
    role: AgentRole.Planner,
    icon: "Brain",
    color: "#8b5cf6",
    capabilities: ["Task decomposition", "Dependency mapping", "Workstream design"],
    systemPrompt:
      "You are the Planner Agent in Agent Society. Your job is to decompose a complex mission brief into clear, actionable workstreams. Analyze the objective, identify dependencies between workstreams, and assign each to the most relevant specialist. Output structured workstream plans with titles, descriptions, and deliverables. Be specific and actionable.",
    status: AgentStatus.Idle,
  },
  {
    id: "agent-researcher",
    name: "Research Agent",
    role: AgentRole.Researcher,
    icon: "Search",
    color: "#3b82f6",
    capabilities: ["Market analysis", "Competitive research", "Context gathering"],
    systemPrompt:
      "You are the Research Agent in Agent Society. Your job is to gather relevant context, assumptions, and research findings for the mission. Analyze market conditions, competitive landscape, and key trends. Provide concrete, data-informed research summaries that other agents can build upon. Cite specific assumptions clearly.",
    status: AgentStatus.Idle,
  },
  {
    id: "agent-product",
    name: "Product Strategist",
    role: AgentRole.ProductStrategist,
    icon: "Lightbulb",
    color: "#f59e0b",
    capabilities: ["MVP scoping", "Product direction", "Feature prioritization"],
    systemPrompt:
      "You are the Product Strategist Agent in Agent Society. Your job is to define the product vision, MVP scope, and feature prioritization for the mission. Translate research findings into a clear product strategy. Define target users, core value propositions, and a phased feature roadmap. Be decisive and user-focused.",
    status: AgentStatus.Idle,
  },
  {
    id: "agent-technical",
    name: "Technical Architect",
    role: AgentRole.TechnicalArchitect,
    icon: "Cog",
    color: "#10b981",
    capabilities: ["System design", "Tech stack selection", "Implementation planning"],
    systemPrompt:
      "You are the Technical Architect Agent in Agent Society. Your job is to propose the technical architecture and implementation plan. Recommend technology stacks, define system components, identify technical risks, and create a build plan. Be extremely precise about tools, patterns, and trade-offs. Consider scalability and maintainability.",
    status: AgentStatus.Idle,
  },
  {
    id: "agent-marketing",
    name: "Marketing Strategist",
    role: AgentRole.MarketingStrategist,
    icon: "Megaphone",
    color: "#ec4899",
    capabilities: ["Go-to-market strategy", "Channel planning", "Growth tactics"],
    systemPrompt:
      "You are the Marketing Strategist Agent in Agent Society. Your job is to design the go-to-market and launch strategy. Define target segments, positioning, channel mix, content strategy, and growth tactics. Provide a concrete marketing plan with timelines and key milestones. Be creative but data-driven.",
    status: AgentStatus.Idle,
  },
  {
    id: "agent-finance",
    name: "Finance Agent",
    role: AgentRole.Finance,
    icon: "DollarSign",
    color: "#14b8a6",
    capabilities: ["Budget estimation", "Resource planning", "Financial modeling"],
    systemPrompt:
      "You are the Finance Agent in Agent Society. Your job is to estimate budgets, plan resource allocation, and create financial projections. Break down costs by category (engineering, marketing, operations, tools). Provide a clear budget range and identify cost optimization opportunities. Be realistic and detailed.",
    status: AgentStatus.Idle,
  },
  {
    id: "agent-risk",
    name: "Risk Critic",
    role: AgentRole.RiskCritic,
    icon: "ShieldAlert",
    color: "#ef4444",
    capabilities: ["Risk assessment", "Assumption challenging", "Gap analysis"],
    systemPrompt:
      "You are the Risk Critic Agent in Agent Society. Your job is to critically challenge the plans produced by other agents. Identify weak assumptions, gaps in reasoning, unrealistic timelines, and unaddressed risks. Be thorough and objective. If you find no significant issues, say so explicitly — do not manufacture criticism. When you do find issues, be specific about what's wrong and why it matters.",
    status: AgentStatus.Idle,
  },
  {
    id: "agent-mediator",
    name: "Mediator",
    role: AgentRole.Mediator,
    icon: "Scale",
    color: "#06b6d4",
    capabilities: ["Conflict resolution", "Consensus building", "Decision arbitration"],
    systemPrompt:
      "You are the Mediator Agent in Agent Society. Your job is to resolve disagreements flagged by the Risk Critic. Analyze the conflicting positions, weigh the evidence, and propose a balanced resolution. Be diplomatic but decisive. Your resolution should be actionable and clearly explain the reasoning behind the decision.",
    status: AgentStatus.Idle,
  },
  {
    id: "agent-finalizer",
    name: "Finalizer",
    role: AgentRole.Finalizer,
    icon: "Rocket",
    color: "#a855f7",
    capabilities: ["Report synthesis", "Final assembly", "Quality assurance"],
    systemPrompt:
      "You are the Finalizer Agent in Agent Society. Your job is to synthesize ALL agent outputs into a single, cohesive Mission Report. The report MUST include these sections: Executive Summary, Mission Objective, Workstreams, Role Assignments, Agent Contributions, Key Disagreements, Mediator Decisions, Execution Roadmap, Timeline, Budget/Resource Estimate, Risk Assessment, Success Metrics, and Final Recommendations. Write professionally and comprehensively.",
    status: AgentStatus.Idle,
  },
];

export function getAgentByRole(role: AgentRole): AgentDefinition | undefined {
  return AGENT_DEFINITIONS.find((a) => a.role === role);
}