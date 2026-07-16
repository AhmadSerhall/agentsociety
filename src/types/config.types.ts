/**
 * Agent Society — Mission Configuration Types
 */

export type MissionType =
  | "general-mission"
  | "startup-launch"
  | "product-strategy"
  | "software-architecture"
  | "marketing-campaign"
  | "research-plan"
  | "business-plan";

export type Depth = "fast" | "balanced" | "deep-analysis";

export type TimeHorizon =
  | "none"
  | "custom"
  | "7-days"
  | "30-days"
  | "90-days"
  | "6-months"
  | "1-year";

export type BudgetRange =
  | "none"
  | "low"
  | "medium"
  | "enterprise";

export type RiskTolerance = "none" | "conservative" | "balanced" | "aggressive";

export type OutputFormat =
  | "direct-result"
  | "executive-report"
  | "execution-roadmap"
  | "strategy-brief"
  | "technical-plan";

export interface MissionConfiguration {
  missionType: MissionType;
  depth: Depth;
  timeHorizon: TimeHorizon;
  customTimeHorizon?: string;
  budgetRange: BudgetRange;
  riskTolerance: RiskTolerance;
  outputFormat: OutputFormat;
}

export const MISSION_TYPE_LABELS: Record<MissionType, string> = {
  "general-mission": "General Mission",
  "startup-launch": "Startup Launch",
  "product-strategy": "Product Strategy",
  "software-architecture": "Software Architecture",
  "marketing-campaign": "Marketing Campaign",
  "research-plan": "Research Plan",
  "business-plan": "Business Plan",
};

export const DEPTH_LABELS: Record<Depth, string> = {
  fast: "Fast",
  balanced: "Balanced",
  "deep-analysis": "Deep Analysis",
};

export const TIME_HORIZON_LABELS: Record<TimeHorizon, string> = {
  none: "None specified",
  custom: "Custom",
  "7-days": "7 Days",
  "30-days": "30 Days",
  "90-days": "90 Days",
  "6-months": "6 Months",
  "1-year": "1 Year",
};

export function getTimeHorizonLabel(configuration: Pick<MissionConfiguration, "timeHorizon" | "customTimeHorizon">) {
  if (configuration.timeHorizon === "custom") {
    return configuration.customTimeHorizon?.trim() || TIME_HORIZON_LABELS.custom;
  }
  return TIME_HORIZON_LABELS[configuration.timeHorizon];
}

export const BUDGET_RANGE_LABELS: Record<BudgetRange, string> = {
  none: "None specified",
  low: "Low budget",
  medium: "Medium budget",
  enterprise: "Enterprise budget",
};

export const RISK_TOLERANCE_LABELS: Record<RiskTolerance, string> = {
  none: "None specified",
  conservative: "Conservative",
  balanced: "Balanced",
  aggressive: "Aggressive",
};

export const OUTPUT_FORMAT_LABELS: Record<OutputFormat, string> = {
  "direct-result": "Direct Result",
  "executive-report": "Executive Report",
  "execution-roadmap": "Execution Roadmap",
  "strategy-brief": "Strategy Brief",
  "technical-plan": "Technical Plan",
};

export const DEFAULT_CONFIGURATION: MissionConfiguration = {
  missionType: "general-mission",
  depth: "balanced",
  timeHorizon: "none",
  budgetRange: "none",
  riskTolerance: "balanced",
  outputFormat: "direct-result",
};
