"use client";

import { AGENT_DEFINITIONS, getAgentByRole } from "@/agents";
import type { AgentDialogueEntry, ConflictInfo, MissionReport, MissionReplayEvent, TimelineEntry, Workstream } from "@/types";
import { sanitizeMissionList, sanitizeMissionText, sanitizeUserFacingText } from "@/utils";

const INTERNAL_KEYS = new Set([
  "id",
  "agentId",
  "agentName",
  "agentRole",
  "displayRole",
  "primaryAgentId",
  "supportingAgentIds",
  "assignedAgentId",
  "taskIds",
  "workstreamId",
  "workstreamTitle",
  "status",
  "usefulOutput",
  "keyFindings",
  "recommendations",
  "actionItems",
  "confidence",
  "conflictSignals",
  "payload",
  "metadata",
  "dependencies",
  "relativeTimestamp",
]);

const BAD_TEXT = /\b(undefined|null|parser repair|internal debug|developer note|fallback activated|no client available)\b|```json|^\s*[{[]/i;

export interface HumanOutput {
  title?: string;
  summary: string;
  bullets: string[];
  cards: Array<{ title: string; body?: string; meta?: string }>;
  tone: "planning" | "analysis" | "risk" | "mediation" | "synthesis" | "update";
  wasStructured: boolean;
}

export interface HumanReportSection {
  title: string;
  kicker: string;
  body: string;
  bullets: string[];
}

export function renderAgentMessage(entry: AgentDialogueEntry, maxLength = 360): HumanOutput {
  return renderStructuredText(entry.content, {
    fallbackTitle: entry.displayRole ?? entry.agentName,
    fallbackSummary: `${entry.displayRole ?? entry.agentName} completed a mission contribution.`,
    maxLength,
    toneHint: entry.agentRole,
    isConflict: entry.isConflict,
  });
}

export function renderStructuredText(value: unknown, options: { fallbackTitle?: string; fallbackSummary?: string; maxLength?: number; toneHint?: string; isConflict?: boolean } = {}): HumanOutput {
  const raw = typeof value === "string" ? value : "";
  const parsed = typeof value === "string" ? parseJsonLike(value) : value;
  const tone = inferTone(`${raw} ${options.toneHint ?? ""}`, options.isConflict);

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const object = parsed as Record<string, unknown>;
    const useful = object.usefulOutput && typeof object.usefulOutput === "object" ? object.usefulOutput as Record<string, unknown> : {};
    const cards = Array.isArray(object.workstreams)
      ? (object.workstreams as Record<string, unknown>[]).map((stream) => ({
          title: clean(stream.title) || "Mission workstream",
          body: clean(stream.description),
          meta: list(stream.expectedDeliverables).slice(0, 2).join(" | "),
        }))
      : [];
    const summary = firstClean([
      object.finalAnswer,
      object.summary,
      object.decisionSummary,
      object.decision,
      object.rationale,
      object.output,
      object.finalAction,
      object.resolvedAction,
      object.mediatorDecision,
      object.description,
    ]) || readableObject(object) || options.fallbackSummary || "The agent completed its assigned contribution.";
    const bullets = sanitizeMissionList([
      ...list(useful.keyFindings),
      ...list(useful.recommendations),
      ...list(useful.actionItems),
      ...list(useful.scheduleItems),
      ...list(useful.risks),
      ...list(object.expectedDeliverables),
      ...list(object.acceptanceCriteria),
    ]).slice(0, 6);

    return {
      title: clean(object.title) || clean(object.workstreamTitle) || options.fallbackTitle,
      summary: clamp(summary, options.maxLength ?? 360),
      bullets,
      cards,
      tone,
      wasStructured: true,
    };
  }

  if (Array.isArray(parsed)) {
    const bullets = sanitizeMissionList(parsed.map((item) => readableValue(item))).slice(0, 6);
    return {
      title: options.fallbackTitle,
      summary: clamp(bullets[0] || options.fallbackSummary || "The agent shared a structured update.", options.maxLength ?? 360),
      bullets,
      cards: [],
      tone,
      wasStructured: true,
    };
  }

  return {
    title: options.fallbackTitle,
    summary: clamp(clean(raw) || options.fallbackSummary || "The agent shared an update.", options.maxLength ?? 360),
    bullets: [],
    cards: [],
    tone,
    wasStructured: false,
  };
}

export function composeReportSections(report: MissionReport): HumanReportSection[] {
  if (report.deliverableMode === "direct_answer") {
    const answer = clean(report.finalAnswer || report.executiveSummary);
    const reviewerNote = clean(report.reviewNote);
    const directSections: Array<HumanReportSection | null> = [
      answer ? { title: "Answer", kicker: "Direct result", body: answer, bullets: [] } : null,
      reviewerNote ? { title: "Reviewer Note", kicker: "Quality check", body: reviewerNote, bullets: [] } : null,
    ];
    return directSections.filter((section): section is HumanReportSection => Boolean(section));
  }

  const sections: Array<[string, string | undefined, string]> = [
    ["Consulting Summary", report.executiveSummary, "Primary answer"],
    ["Objective", report.missionObjective, "User request"],
    // ["Expert Contributions", report.agentContributions, "Specialist synthesis"],
    // ["Workstreams", report.workstreams, "Completed work"],
    ["Decision Notes", report.keyDisagreements || report.mediatorDecisions, "Tradeoffs"],
    // ["Action Plan", report.executionRoadmap, "Next steps"],
    // ["Risk Summary", report.riskAssessment, "Executive risk view"],
    ["Resources", report.budgetEstimate, "Budget and constraints"],
    // ["Success Measures", report.successMetrics, "How to judge quality"],
    ["Final Recommendations", report.finalRecommendations, "Recommended path"],
  ];

  const seen = new Set<string>();
  return sections.flatMap(([title, content, kicker]) => {
    if (!shouldShowReportSection(title, content)) return [];
    const rendered = renderStructuredText(content ?? "", { fallbackTitle: title, fallbackSummary: "", maxLength: 5000 });
    const body = clean(title === "Expert Contributions" ? dedupeContributionLines(rendered.summary) : rendered.summary);
    const key = `${title}:${body}`;
    if (!body || seen.has(key)) return [];
    seen.add(key);
    return [{ title, kicker, body, bullets: dedupeList(rendered.bullets) }];
  });
}

export function renderConflict(conflict: ConflictInfo) {
  const participants = sanitizeMissionList([
    ...conflict.agents,
    ...(conflict.agentsInvolved ?? []),
  ]).map((agent) => {
    const match = AGENT_DEFINITIONS.find((definition) => agent.toLowerCase().includes(definition.name.toLowerCase()) || agent.toLowerCase().includes(definition.role.replace(/-/g, " ")));
    return match?.name ?? agent;
  });
  return {
    title: clean(conflict.title) || "Mission dispute",
    summary: clean(conflict.disagreementSummary ?? conflict.summary ?? conflict.description) || "A mission tradeoff needs a decision.",
    participants: Array.from(new Set(participants)),
    arguments: sanitizeMissionList(conflict.proposedSolutions ?? []).slice(0, 4),
    decision: clean(conflict.finalAction ?? conflict.resolvedAction ?? conflict.mediatorDecision ?? conflict.resolution),
    status: conflict.resolved || conflict.status === "resolved" ? "Resolved" : conflict.status === "resolving" ? "Mediation" : "Active",
    risk: conflict.riskLevel ?? conflict.severity ?? "moderate",
  };
}

export function renderTimelineEntry(entry: TimelineEntry, index: number) {
  const agent = getAgentByRole(entry.agent);
  const label = clean(entry.label);
  const description = clean(entry.description);
  const kind = entry.kind ?? "agent";
  return {
    step: index + 1,
    title: label || description,
    body: description === label ? "" : description,
    agentName: agent?.name ?? humanize(String(entry.agent)),
    kind,
  };
}

export function renderWorkstream(ws: Workstream) {
  const title = clean(ws.title).replace(/\s+(for|with)\s+".*?"$/i, "");
  const subtitle = clean(ws.description);
  const assignedOwner = ws.assignedAgent ? getAgentByRole(ws.assignedAgent)?.name : "";
  const owner = assignedOwner || clean(ws.owner ?? ws.responsibleAgent) || "Owner pending";
  const bullets = sanitizeMissionList([
    ...ws.deliverables,
    ...(ws.acceptanceCriteria ?? []),
    ...(ws.expectedOutputs ?? []),
  ]).slice(0, 5);
  return { title, subtitle, owner, bullets };
}

export function renderReplayEvent(event: MissionReplayEvent | null) {
  if (!event) {
    return {
      title: "Select an event",
      summary: "Choose a replay marker to see what changed at that moment.",
      details: [] as string[],
    };
  }
  const title = eventLabel(event.type);
  const who = event.agentName ? `${event.agentName} participated.` : "The mission system updated the run state.";
  const workstream = event.workstreamTitle ? `Workstream: ${clean(event.workstreamTitle)}.` : "";
  const confidence = event.confidence != null ? `Confidence at this point: ${event.confidence}%.` : "";
  return {
    title,
    summary: [who, workstream, confidence].filter(Boolean).join(" "),
    details: [
      `Event type: ${eventLabel(event.type)}`,
      event.relativeTimestamp != null ? `Replay time: ${Math.round(event.relativeTimestamp / 1000)}s` : "",
      event.dependencies?.length ? `${event.dependencies.length} dependency checkpoints were attached.` : "",
    ].filter(Boolean),
  };
}

function parseJsonLike(value: string): unknown | null {
  const text = value.trim();
  if (!text) return null;
  const candidates = [
    text,
    text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1],
    text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1),
    text.slice(text.indexOf("["), text.lastIndexOf("]") + 1),
  ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim().length > 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }
  return null;
}

function readableObject(object: Record<string, unknown>) {
  return Object.entries(object)
    .filter(([key, value]) => !INTERNAL_KEYS.has(key) && value != null && value !== "")
    .map(([key, value]) => `${humanize(key)}: ${readableValue(value)}`)
    .filter((line) => !BAD_TEXT.test(line))
    .slice(0, 5)
    .join("\n");
}

function readableValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return clean(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(readableValue).filter(Boolean).join("; ");
  if (typeof value === "object") return readableObject(value as Record<string, unknown>);
  return "";
}

function firstClean(values: unknown[]) {
  return values.map(clean).find(Boolean) ?? "";
}

function list(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(readableValue).filter(Boolean);
  return [readableValue(value)].filter(Boolean);
}

function clean(value: unknown): string {
  if (typeof value !== "string") return "";
  const cleaned = sanitizeUserFacingText(value)
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*(agentName|displayRole|workstreamTitle|status|usefulOutput|keyFindings|recommendations|actionItems|confidence|conflictSignals)\s*:\s*/gim, "")
    .replace(/\b(agentName|displayRole|workstreamTitle|status|usefulOutput|keyFindings|recommendations|actionItems|confidence|conflictSignals|primaryAgentId|supportingAgentIds|assignedAgentId|workstreamId|taskIds|payload|metadata)\b:?/gi, "")
    .replace(/\b(ws|task|agent)-[a-z0-9-]+\b/gi, "")
    .replace(/[{}[\]"]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!cleaned || BAD_TEXT.test(cleaned)) return "";
  return sanitizeMissionText(cleaned);
}

function clamp(text: string, max: number) {
  const cleaned = clean(text);
  if (cleaned.length <= max) return cleaned;
  const sliced = cleaned.slice(0, max - 1);
  return `${sliced.replace(/\s+\S*$/, "")}...`;
}

function inferTone(text: string, isConflict?: boolean): HumanOutput["tone"] {
  const lower = text.toLowerCase();
  if (isConflict || /\b(conflict_detected|material disagreement|disagree|active conflict|mediator required)\b/.test(lower)) return "risk";
  if (/mediator|resolved|resolution/.test(lower)) return "mediation";
  if (/final|synthesis|report/.test(lower)) return "synthesis";
  if (/planner|workstream|graph/.test(lower)) return "planning";
  if (/research|analysis|finding/.test(lower)) return "analysis";
  return "update";
}

function shouldShowReportSection(title: string, content?: string) {
  const cleaned = clean(content ?? "");
  if (!cleaned) return false;
  if (title === "Risk Summary" && /no mission-specific risk review was required|risk review was not completed/i.test(cleaned)) return false;
  if (title === "Resources" && /resource posture:\s*none specified|not provided|none specified/i.test(cleaned)) return false;
  if (title === "Decision Notes" && /no conflicts generated|no active conflict|no material disagreement/i.test(cleaned)) return false;
  return true;
}

function dedupeContributionLines(text: string) {
  const seen = new Set<string>();
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      const normalized = line.replace(/^[-*\d.\s]+/, "").replace(/^(finalizer|research agent|planner|technical architect|risk critic|mediator|finance agent|marketing strategist):\s*/i, "").toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .join("\n");
}

function dedupeList(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = item.toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function eventLabel(type: string) {
  return humanize(type.toLowerCase());
}

function humanize(key: string) {
  return key.replace(/[_-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
