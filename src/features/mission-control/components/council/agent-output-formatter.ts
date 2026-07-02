"use client";

import type { AgentDialogueEntry, AgentRole, ExecutionTask, Workstream } from "@/types";
import { sanitizeMissionList, sanitizeUserFacingText } from "@/utils";

export type DisplayMessageType =
  | "planning"
  | "question"
  | "answer"
  | "challenge"
  | "agreement"
  | "conflict"
  | "mediation"
  | "synthesis";

export interface NormalizedAgentOutput {
  title?: string;
  summary: string;
  bullets: string[];
  workstreams: Array<{ title: string; description?: string; deliverables: string[]; confidence?: number }>;
  type: DisplayMessageType;
  raw: string;
  wasJson: boolean;
  truncated: boolean;
}

const INTERNAL_KEYS = new Set([
  "id",
  "taskIds",
  "primaryAgentId",
  "supportingAgentIds",
  "assignedAgentId",
  "agentId",
  "workstreamId",
  "dependencies",
]);

function tryParseJson(value: string): unknown | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) {
      try {
        return JSON.parse(fenced);
      } catch {
        return null;
      }
    }
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(trimmed.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return sanitizeUserFacingText(value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\b(ws|agent)-[a-z0-9-]+\b/gi, "")
    .replace(/\b(primaryAgentId|supportingAgentIds|assignedAgentId|taskIds|workstreamId)\b:?/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim());
}

function stringifyReadable(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return cleanText(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(stringifyReadable).filter(Boolean).join("; ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !INTERNAL_KEYS.has(key))
      .map(([key, entry]) => `${humanizeKey(key)}: ${stringifyReadable(entry)}`)
      .filter((line) => !line.endsWith(": "))
      .join("\n");
  }
  return "";
}

function humanizeKey(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function trimToSentence(text: string, max = 280) {
  const cleaned = cleanText(text).replace(/\s+/g, " ");
  if (cleaned.length <= max) return { text: cleaned, truncated: false };
  const slice = cleaned.slice(0, max - 1);
  const sentence = slice.match(/^([\s\S]*?[.!?])\s+[A-Z0-9]/)?.[1] ?? slice;
  return { text: `${sentence.trim()}...`, truncated: true };
}

function inferType(text: string, agentRole?: AgentRole, conflict?: boolean): DisplayMessageType {
  const lower = text.toLowerCase();
  if (conflict || lower.includes("conflict") || lower.includes("challenge") || lower.includes("disagree")) return "conflict";
  if (agentRole === "mediator" || lower.includes("mediator") || lower.includes("resolved")) return "mediation";
  if (agentRole === "finalizer" || lower.includes("synthesis") || lower.includes("final report")) return "synthesis";
  if (agentRole === "planner" || lower.includes("mission graph") || lower.includes("workstream")) return "planning";
  if (lower.includes("?") || lower.includes("request")) return "question";
  if (lower.includes("agree") || lower.includes("aligned")) return "agreement";
  return "answer";
}

function fromPlannerObject(parsed: Record<string, unknown>, raw: string, type: DisplayMessageType): NormalizedAgentOutput {
  const workstreams = Array.isArray(parsed.workstreams) ? parsed.workstreams as Record<string, unknown>[] : [];
  const title = "Mission Graph created";
  const bullets = [
    typeof parsed.summary === "string" ? parsed.summary : "",
    workstreams.length ? `${workstreams.length} mission-specific workstreams assigned across the agent society.` : "",
    Array.isArray(parsed.parallelGroups) ? `${parsed.parallelGroups.length} parallel collaboration waves prepared.` : "",
  ].filter(Boolean);
  return {
    title,
    summary: bullets[0] ?? "The Planner created a structured mission graph.",
    bullets,
    workstreams: workstreams.map((stream) => ({
      title: String(stream.title ?? "Workstream"),
      description: typeof stream.description === "string" ? cleanText(stream.description) : undefined,
      deliverables: Array.isArray(stream.expectedDeliverables) ? stream.expectedDeliverables.map(String) : [],
      confidence: typeof stream.confidence === "number" ? stream.confidence : undefined,
    })),
    type,
    raw,
    wasJson: true,
    truncated: false,
  };
}

export function normalizeAgentOutputForDisplay(output: unknown, options?: { agentRole?: AgentRole; isConflict?: boolean; maxLength?: number }): NormalizedAgentOutput {
  const raw = typeof output === "string" ? output : JSON.stringify(output, null, 2);
  const parsed = typeof output === "string" ? tryParseJson(output) : output;
  const type = inferType(raw, options?.agentRole, options?.isConflict);

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const object = parsed as Record<string, unknown>;
    if (Array.isArray(object.workstreams)) return fromPlannerObject(object, raw, type);

    const title = typeof object.title === "string" ? cleanText(object.title) : undefined;
    const usefulOutput = object.usefulOutput && typeof object.usefulOutput === "object" ? object.usefulOutput as Record<string, unknown> : {};
    const summaryCandidate = object.summary ?? object.decisionSummary ?? object.decision ?? object.rationale ?? object.finalVideoPrompt ?? object.concept ?? object.output;
    const summary = stringifyReadable(summaryCandidate) || stringifyReadable(object) || "The agent completed its assigned analysis.";
    const bulletKeys = ["keyFindings", "recommendations", "actionItems", "scheduleItems", "risks", "dependencies", "qualityChecklist", "constraints", "deliverables", "resolvedActions", "resolvedAction"];
    const bullets = bulletKeys.flatMap((key) => {
      const value = usefulOutput[key] ?? object[key];
      if (!value) return [];
      return Array.isArray(value) ? value.map(stringifyReadable) : [stringifyReadable(value)];
    }).filter(Boolean).slice(0, 6);
    const trimmed = trimToSentence(summary, options?.maxLength ?? 280);
    return {
      title,
      summary: trimmed.text,
      bullets: sanitizeMissionList(bullets),
      workstreams: [],
      type,
      raw,
      wasJson: true,
      truncated: trimmed.truncated,
    };
  }

  if (Array.isArray(parsed)) {
    const bullets = parsed.map(stringifyReadable).filter(Boolean).slice(0, 6);
    const trimmed = trimToSentence(bullets[0] ?? raw, options?.maxLength ?? 280);
    return { summary: trimmed.text, bullets, workstreams: [], type, raw, wasJson: true, truncated: trimmed.truncated };
  }

  const trimmed = trimToSentence(raw, options?.maxLength ?? 280);
  return {
    summary: trimmed.text,
    bullets: [],
    workstreams: [],
    type,
    raw,
    wasJson: false,
    truncated: trimmed.truncated,
  };
}

export function normalizeDialogueEntry(entry: AgentDialogueEntry) {
  return normalizeAgentOutputForDisplay(entry.content, {
    agentRole: entry.agentRole,
    isConflict: entry.isConflict,
    maxLength: 280,
  });
}

export function displayWorkstreamTitle(task: ExecutionTask | Workstream) {
  return cleanText(task.title || "Untitled workstream");
}

export function displayRoleForTask(task: ExecutionTask | Workstream) {
  return cleanText(task.displayRole || ("owner" in task ? task.owner : "") || ("agent" in task ? task.agent.replace(/-/g, " ") : "") || "Mission specialist");
}

export function displayTaskOutput(output?: string) {
  if (!output) return "No output yet. The agent is waiting for its turn or dependency context.";
  const formatted = normalizeAgentOutputForDisplay(output, { maxLength: 420 });
  return formatted.summary;
}
