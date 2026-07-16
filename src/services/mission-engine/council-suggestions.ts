import type { CouncilHiddenContext, CouncilSuggestionChip, CouncilSuggestionIconKind } from "@/types/council.types";
import type { MissionHistoryEntry } from "@/types";
import { createMockClient, createQwenClient, isMockMode } from "@/services/qwen";
import { generateId, sanitizeUserFacingText } from "@/utils";
import {
  councilLabelForKind,
  extractMissionTopic,
  humanBriefForTopic,
  isAwkwardSuggestionLabel,
  polishSuggestionLabel,
  type MissionTopic,
} from "./suggestion-label-utils";
import { buildGuaranteedCouncilReplacement, REPLACEMENT_ANGLES } from "./suggestion-replacement-angles";

const MAX_CHIPS = 4;

function firstReportInsight(value?: string) {
  return value
    ?.split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .find((line) => line.length >= 18 && !/^(none|no\s)/i.test(line));
}

function missionStatus(entry: MissionHistoryEntry): "completed" | "cancelled" {
  return entry.finalReport ? "completed" : "cancelled";
}

function buildHistoryPayload(entry: MissionHistoryEntry) {
  const completedWorkstreams = entry.workstreams.filter((workstream) => workstream.status === "completed").length;
  const latestDialogue = entry.dialogue.at(-1);
  const dialogueExcerpt = latestDialogue && "content" in latestDialogue
    ? sanitizeUserFacingText(latestDialogue.content).slice(0, 220)
    : "";
  const topic = extractMissionTopic(entry.missionBrief);
  return {
    historyId: entry.id,
    missionBrief: sanitizeUserFacingText(entry.missionBrief),
    topic,
    status: missionStatus(entry),
    recommendation: firstReportInsight(entry.finalReport?.finalRecommendations)?.slice(0, 220) ?? "",
    roadmap: firstReportInsight(entry.finalReport?.executionRoadmap)?.slice(0, 220) ?? "",
    risk: firstReportInsight(entry.finalReport?.riskAssessment)?.slice(0, 220) ?? "",
    completedWorkstreams,
    totalWorkstreams: entry.workstreams.length,
    dialogueExcerpt,
    replayAvailable: Boolean(entry.replayEvents?.length),
    configuration: entry.configuration,
  };
}

function normalizeIconKind(value?: string): CouncilSuggestionIconKind {
  const normalized = (value ?? "").toLowerCase().replace(/_/g, "-");
  const allowed: CouncilSuggestionIconKind[] = [
    "continue", "implement", "optimize", "validate", "reduce-risk", "estimate-cost", "expand", "research",
  ];
  return allowed.find((kind) => kind === normalized) ?? "research";
}

function normalizeChipLabel(
  label: string,
  topic: MissionTopic,
  iconKind: CouncilSuggestionIconKind,
  status: "completed" | "cancelled",
  visibleBrief: string,
) {
  const polished = polishSuggestionLabel(label, visibleBrief, topic).slice(0, 56);
  if (!isAwkwardSuggestionLabel(polished)) return polished;
  return councilLabelForKind(iconKind, topic, status).slice(0, 56);
}

function buildHiddenContext(
  entry: MissionHistoryEntry,
  payload: ReturnType<typeof buildHistoryPayload>,
  iconKind: CouncilSuggestionIconKind,
  rationale: string,
): CouncilHiddenContext {
  return {
    parentMissionId: entry.id,
    sourceMissionBrief: entry.missionBrief,
    missionStatus: payload.status,
    suggestionKind: iconKind,
    councilRationale: rationale.slice(0, 220),
    checkpointSummary: payload.status === "cancelled"
      ? `${payload.completedWorkstreams}/${payload.totalWorkstreams} workstreams completed before cancellation.`
      : undefined,
    recommendationExcerpt: payload.recommendation || undefined,
    roadmapExcerpt: payload.roadmap || undefined,
    riskExcerpt: payload.risk || undefined,
    agentMemoryExcerpt: payload.dialogueExcerpt || undefined,
    replayAvailable: payload.replayAvailable,
    completedWorkstreams: payload.completedWorkstreams,
    totalWorkstreams: payload.totalWorkstreams,
  };
}

function buildCandidatesForEntry(entry: MissionHistoryEntry, payload: ReturnType<typeof buildHistoryPayload>) {
  const { topic, missionBrief, status, recommendation, roadmap, risk } = payload;
  const candidates: Array<{
    label: string;
    visibleBrief: string;
    why: string;
    iconKind: CouncilSuggestionIconKind;
    config?: Partial<typeof entry.configuration>;
  }> = [];

  if (status === "cancelled") {
    candidates.push({
      label: councilLabelForKind("continue", topic, status),
      visibleBrief: humanBriefForTopic(`continue where I left off on ${topic.phrase}`, topic, missionBrief),
      why: `Suggested because your mission on ${topic.phrase} was stopped before completion.`,
      iconKind: "continue",
    });
  }

  if (recommendation) {
    candidates.push({
      label: polishSuggestionLabel(recommendation, recommendation, topic),
      visibleBrief: humanBriefForTopic(recommendation, topic, missionBrief),
      why: `Suggested because the council's recommendation points to a strong next move on ${topic.phrase}.`,
      iconKind: "expand",
    });
  }

  if (roadmap) {
    candidates.push({
      label: "Map Next Milestones",
      visibleBrief: humanBriefForTopic(roadmap, topic, missionBrief),
      why: `Suggested because the roadmap for ${topic.phrase} has a concrete next step to run now.`,
      iconKind: "implement",
      config: { ...entry.configuration, outputFormat: "execution-roadmap" },
    });
  }

  if (risk) {
    candidates.push({
      label: "Review Key Risks",
      visibleBrief: humanBriefForTopic(`address the biggest risk around ${risk}`, topic, missionBrief),
      why: `Suggested because an unresolved risk still needs attention in ${topic.phrase}.`,
      iconKind: "reduce-risk",
      config: { ...entry.configuration, riskTolerance: "conservative" },
    });
  }

  for (const angle of REPLACEMENT_ANGLES.slice(0, 4)) {
    candidates.push({
      label: angle.label,
      visibleBrief: humanBriefForTopic(angle.prompt(topic), topic, missionBrief),
      why: angle.why(topic),
      iconKind: angle.iconKind,
    });
  }

  return candidates;
}

function candidateToChip(
  entry: MissionHistoryEntry,
  payload: ReturnType<typeof buildHistoryPayload>,
  candidate: ReturnType<typeof buildCandidatesForEntry>[number],
): CouncilSuggestionChip {
  return {
    id: generateId(),
    label: candidate.label.slice(0, 56),
    visibleBrief: candidate.visibleBrief.slice(0, 280),
    why: candidate.why,
    iconKind: candidate.iconKind,
    config: candidate.config ?? entry.configuration,
    hidden: buildHiddenContext(entry, payload, candidate.iconKind, candidate.why),
  };
}

function buildFallbackCouncilChips(entries: MissionHistoryEntry[]): CouncilSuggestionChip[] {
  const rows: CouncilSuggestionChip[] = [];

  for (const entry of entries.slice(0, MAX_CHIPS)) {
    const payload = buildHistoryPayload(entry);
    const candidates = buildCandidatesForEntry(entry, payload);

    for (const candidate of candidates) {
      if (rows.length >= MAX_CHIPS) break;
      if (rows.some((row) => row.label.toLowerCase() === candidate.label.toLowerCase())) continue;
      rows.push(candidateToChip(entry, payload, candidate));
      break;
    }
  }

  return rows.slice(0, MAX_CHIPS);
}

function parseCouncilPayload(raw: string, entries: MissionHistoryEntry[]): CouncilSuggestionChip[] {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return [];
  const parsed = JSON.parse(json) as {
    suggestions?: Array<{
      historyId?: string;
      label?: string;
      visibleBrief?: string;
      why?: string;
      iconKind?: string;
    }>;
  };
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const rows: CouncilSuggestionChip[] = [];
  const usedLabels = new Set<string>();

  for (const item of parsed.suggestions ?? []) {
    const entry = item.historyId ? byId.get(item.historyId) : entries[0];
    if (!entry) continue;
    const payload = buildHistoryPayload(entry);
    const visibleBrief = sanitizeUserFacingText(item.visibleBrief ?? "").trim();
    const why = sanitizeUserFacingText(item.why ?? "").trim();
    if (visibleBrief.length < 12 || why.length < 12) continue;
    if (/resume the cancelled mission|continue the completed mission|turn this next step from/i.test(visibleBrief)) continue;

    const iconKind = normalizeIconKind(item.iconKind);
    const label = normalizeChipLabel(item.label ?? "", payload.topic, iconKind, payload.status, visibleBrief);
    if (usedLabels.has(label.toLowerCase())) continue;
    usedLabels.add(label.toLowerCase());

    rows.push({
      id: generateId(),
      label,
      visibleBrief: visibleBrief.slice(0, 280),
      why: why.slice(0, 220),
      iconKind,
      config: entry.configuration,
      hidden: buildHiddenContext(entry, payload, iconKind, why),
    });
  }

  return rows.slice(0, MAX_CHIPS);
}

async function callCouncilModel(system: string, user: string) {
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
  return isMockMode()
    ? createMockClient().chat(messages)
    : createQwenClient().chat(messages, { temperature: 0.75, maxTokens: 1500 });
}

export async function generateCouncilSuggestionChips(entries: MissionHistoryEntry[]): Promise<CouncilSuggestionChip[]> {
  const recent = entries.slice(0, 5);
  if (!recent.length) return [];

  const payloads = recent.map(buildHistoryPayload);
  const system = `You are the Agent Council council suggestion engine.
Generate contextual follow-up mission chips from prior missions.

Rules:
- label must be 2-5 plain English words that are instantly understandable (examples: "Compare Best Champions", "Build Weekly Schedule", "Review Key Risks", "Learn AI Skills").
- NEVER stitch awkward words from the source mission into the label (BAD: "Reduce Day Can Software Risk", "Validate Hit Challenger League Plan").
- NEVER use vague labels like "Where We Left Off", "The Best Current Options", or "Next Steps".
- visibleBrief must sound like a real user wrote it: concise, conversational, outcome-oriented. Never mention internal systems, checkpoints, parentMissionId, replay, or council orchestration.
- why must briefly explain why this chip relates to that specific prior mission.
- iconKind must be one of: continue, implement, optimize, validate, reduce-risk, estimate-cost, expand, research.
- Each suggestion must be a distinct next task tied to its source mission topic.
- Spread suggestions across different historyId values when possible.

Return ONLY JSON:
{"suggestions":[{"historyId":"id","label":"topic-specific 2-4 words","visibleBrief":"natural user mission under 220 chars","why":"brief rationale tied to source mission","iconKind":"research"}]}
Generate up to ${MAX_CHIPS} suggestions across the supplied missions.`;

  const user = payloads.map((payload) => [
    `historyId: ${payload.historyId}`,
    `topicName: ${payload.topic.name}`,
    `topicPhrase: ${payload.topic.phrase}`,
    `sourceMission: ${payload.missionBrief}`,
    `status: ${payload.status}`,
    payload.recommendation ? `recommendation: ${payload.recommendation}` : "",
    payload.roadmap ? `roadmap: ${payload.roadmap}` : "",
    payload.risk ? `risk: ${payload.risk}` : "",
    payload.dialogueExcerpt ? `latestAgentSignal: ${payload.dialogueExcerpt}` : "",
    payload.status === "cancelled" ? `checkpoint: ${payload.completedWorkstreams}/${payload.totalWorkstreams} workstreams completed` : "",
  ].filter(Boolean).join("\n")).join("\n\n---\n\n");

  try {
    const response = await callCouncilModel(system, user);
    const parsed = parseCouncilPayload(response, recent);
    if (parsed.length >= Math.min(MAX_CHIPS, recent.length)) return parsed;
    if (parsed.length) {
      const fallback = buildFallbackCouncilChips(recent.filter((entry) => !parsed.some((chip) => chip.hidden.parentMissionId === entry.id)));
      return [...parsed, ...fallback].slice(0, MAX_CHIPS);
    }
  } catch {
    // Fall through to fallback generation.
  }

  return buildFallbackCouncilChips(recent);
}

export async function replaceCouncilSuggestionChip(
  entry: MissionHistoryEntry,
  exclude: { labels: string[]; briefs: string[] },
): Promise<CouncilSuggestionChip> {
  const payload = buildHistoryPayload(entry);
  const excludeBlock = [
    ...exclude.labels.map((label) => `- label: ${label}`),
    ...exclude.briefs.map((brief) => `- brief: ${brief}`),
  ].join("\n");

  const system = `You generate one fresh follow-up mission chip for an AI mission control product.
Rules:
- label must be 2-5 plain English words that are instantly understandable.
- NEVER stitch awkward words from the source mission into the label.
- visibleBrief must sound like a real user wrote it.
- why must explain why this relates to the source mission.
Return ONLY JSON:
{"suggestions":[{"historyId":"${entry.id}","label":"clear readable label","visibleBrief":"natural brief under 220 chars","why":"brief rationale","iconKind":"research"}]}
Generate exactly 1 suggestion that is clearly different from every excluded item below.
Do NOT repeat or closely paraphrase:
${excludeBlock}`;

  const user = [
    `historyId: ${payload.historyId}`,
    `topicName: ${payload.topic.name}`,
    `topicPhrase: ${payload.topic.phrase}`,
    `sourceMission: ${payload.missionBrief}`,
    `status: ${payload.status}`,
    `replacementAttempt: ${exclude.labels.length + exclude.briefs.length + 1}`,
    payload.recommendation ? `recommendation: ${payload.recommendation}` : "",
    payload.roadmap ? `roadmap: ${payload.roadmap}` : "",
    payload.risk ? `risk: ${payload.risk}` : "",
  ].filter(Boolean).join("\n");

  try {
    const response = await callCouncilModel(system, user);
    const parsed = parseCouncilPayload(response, [entry]);
    const candidate = parsed.find(
      (chip) => !exclude.labels.some((label) => label.toLowerCase() === chip.label.toLowerCase())
        && !exclude.briefs.some((brief) => brief.trim() === chip.visibleBrief.trim()),
    );
    if (candidate) return candidate;
  } catch {
    // Fall through to guaranteed replacement below.
  }

  const guaranteed = buildGuaranteedCouncilReplacement(entry, exclude);
  return candidateToChip(entry, payload, {
    label: guaranteed.label,
    visibleBrief: guaranteed.visibleBrief,
    why: guaranteed.why,
    iconKind: guaranteed.iconKind,
  });
}
