import type { MissionHistoryEntry } from "@/types";
import { createMockClient, createQwenClient, isMockMode } from "@/services/qwen";
import { generateId, sanitizeUserFacingText } from "@/utils";
import { extractMissionTopic, isAwkwardSuggestionLabel, polishSuggestionLabel, type MissionTopic } from "./suggestion-label-utils";
import { buildGuaranteedHistoryReplacement, REPLACEMENT_ANGLES } from "./suggestion-replacement-angles";

export interface HistoryMissionSuggestion {
  id: string;
  historyId: string;
  historyBrief: string;
  label: string;
  prompt: string;
}

const MAX_HISTORY_ENTRIES = 5;
const SUGGESTIONS_PER_ENTRY = 2;
const SIMILARITY_THRESHOLD = 0.36;

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "give", "plan", "follow",
  "want", "need", "make", "create", "build", "design", "help", "into", "about", "have",
  "will", "should", "would", "could", "mission", "strategy", "budget", "days", "weeks",
]);

const DISTINCT_SUGGESTION_RULES = `CRITICAL RULES:
- Each suggestion must be a DIFFERENT mission, not a paraphrase of the source mission.
- Stay in the same topic/domain universe, but change the mission angle completely.
- label must be 2-5 plain English words that a human would understand instantly (examples: "Compare Best Champions", "Build Weekly Schedule", "Review Key Risks", "Learn AI and Cloud Skills").
- NEVER build labels by awkwardly stitching words from the source mission (BAD: "Reduce Day Can Software Risk", "Validate Hit Challenger League Plan").
- NEVER use vague labels like "The Best Current Options" or "Where We Left Off".
- Prefer adjacent missions such as: practice schedule, resource guide, risk audit, tool comparison, prerequisite learning, competition prep, privacy framework, or cost estimate.
- Do NOT restate the same primary outcome, timeline, and budget together.
- BAD example: source asks for a piano plan with $1000 -> suggestion asks for another piano plan with $1000.
- GOOD example: source asks for a piano competition plan -> suggestion asks for competition repertoire research or a daily practice schedule.`;

function buildEntryContext(entry: MissionHistoryEntry) {
  const recommendation = entry.finalReport?.finalRecommendations
    ?.split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .find((line) => line.length >= 18);
  const roadmap = entry.finalReport?.executionRoadmap
    ?.split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .find((line) => line.length >= 18);

  return {
    historyId: entry.id,
    missionBrief: sanitizeUserFacingText(entry.missionBrief),
    topic: extractMissionTopic(entry.missionBrief),
    recommendation: recommendation ? sanitizeUserFacingText(recommendation).slice(0, 220) : "",
    roadmap: roadmap ? sanitizeUserFacingText(roadmap).slice(0, 220) : "",
  };
}

function tokenize(text: string) {
  return sanitizeUserFacingText(text)
    .toLowerCase()
    .replace(/[^\w\s$]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

function jaccardSimilarity(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return intersection / (leftTokens.size + rightTokens.size - intersection);
}

function sharesConstraintBundle(source: string, prompt: string) {
  const money = [...source.matchAll(/(?:\$|\b)(\d[\d,]*)\s*(?:\$|usd|dollars?)?/gi)].map((match) => match[1]);
  const durations = [...source.matchAll(/\b(\d{1,3})\s*(day|days|week|weeks|month|months)\b/gi)].map((match) => `${match[1]} ${match[2].toLowerCase()}`);
  if (!money.length && !durations.length) return false;
  const promptLower = prompt.toLowerCase();
  const moneyMatches = money.filter((amount) => promptLower.includes(amount)).length;
  const durationMatches = durations.filter((duration) => promptLower.includes(duration)).length;
  const bundleMatched = (money.length ? moneyMatches > 0 : true) && (durations.length ? durationMatches > 0 : true);
  return bundleMatched && jaccardSimilarity(source, prompt) >= 0.28;
}

function isDistinctSuggestion(sourceMission: string, prompt: string, excludePrompts: string[] = [], strict = true) {
  const threshold = strict ? SIMILARITY_THRESHOLD : 0.52;
  if (jaccardSimilarity(sourceMission, prompt) >= threshold) return false;
  if (strict && sharesConstraintBundle(sourceMission, prompt)) return false;
  if (excludePrompts.some((existing) => jaccardSimilarity(existing, prompt) >= 0.48)) return false;
  const sourceSnippet = sanitizeUserFacingText(sourceMission).toLowerCase().slice(0, 48);
  if (strict && sourceSnippet.length >= 24 && sanitizeUserFacingText(prompt).toLowerCase().includes(sourceSnippet)) return false;
  return true;
}

function normalizeHistoryLabel(label: string, prompt: string, topic: MissionTopic) {
  return polishSuggestionLabel(label, prompt, topic);
}

function parseSuggestionsPayload(
  raw: string,
  entries: MissionHistoryEntry[],
  excludeByHistory: Record<string, string[]> = {},
): HistoryMissionSuggestion[] {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return [];

  const parsed = JSON.parse(json) as {
    missions?: Array<{ historyId?: string; suggestions?: Array<{ label?: string; prompt?: string }> }>;
    suggestions?: Array<{ label?: string; prompt?: string }>;
  };

  const byHistory = new Map<string, MissionHistoryEntry>();
  entries.forEach((entry) => byHistory.set(entry.id, entry));

  const rows: HistoryMissionSuggestion[] = [];

  if (Array.isArray(parsed.missions)) {
    for (const group of parsed.missions) {
      const entry = group.historyId ? byHistory.get(group.historyId) : undefined;
      if (!entry || !Array.isArray(group.suggestions)) continue;
      const context = buildEntryContext(entry);
      for (const item of group.suggestions.slice(0, SUGGESTIONS_PER_ENTRY)) {
        const prompt = sanitizeUserFacingText(item.prompt ?? "").trim();
        const label = normalizeHistoryLabel(item.label ?? "", prompt, context.topic);
        if (prompt.length < 18 || label.length < 4) continue;
        if (!isDistinctSuggestion(entry.missionBrief, prompt, excludeByHistory[entry.id] ?? [])) continue;
        rows.push({
          id: generateId(),
          historyId: entry.id,
          historyBrief: entry.missionBrief,
          label,
          prompt: prompt.slice(0, 520),
        });
      }
    }
    return rows;
  }

  const entry = entries[0];
  if (!entry || !Array.isArray(parsed.suggestions)) return rows;
  const context = buildEntryContext(entry);
  for (const item of parsed.suggestions.slice(0, SUGGESTIONS_PER_ENTRY)) {
    const prompt = sanitizeUserFacingText(item.prompt ?? "").trim();
    const label = normalizeHistoryLabel(item.label ?? "", prompt, context.topic);
    if (prompt.length < 18 || label.length < 4) continue;
    if (!isDistinctSuggestion(entry.missionBrief, prompt, excludeByHistory[entry.id] ?? [])) continue;
    rows.push({
      id: generateId(),
      historyId: entry.id,
      historyBrief: entry.missionBrief,
      label,
      prompt: prompt.slice(0, 520),
    });
  }
  return rows;
}

function buildTopicFallbackSuggestions(
  entry: MissionHistoryEntry,
  count: number,
  excludePrompts: string[] = [],
): HistoryMissionSuggestion[] {
  const context = buildEntryContext(entry);
  const { topic, missionBrief, recommendation, roadmap } = context;

  const templates: Array<{ label: string; prompt: string }> = REPLACEMENT_ANGLES.map((angle) => ({
    label: angle.label,
    prompt: angle.prompt(topic),
  }));

  if (recommendation) {
    templates.unshift({
      label: polishSuggestionLabel(recommendation, recommendation, topic),
      prompt: recommendation,
    });
  }

  if (roadmap) {
    templates.unshift({
      label: "Map Next Milestones",
      prompt: roadmap,
    });
  }

  if (!entry.finalReport) {
    templates.unshift({
      label: context.topic.name === "This Mission" ? "Continue This Mission" : `Continue ${context.topic.name}`,
      prompt: `Help me continue my work on ${topic.phrase} from where I left off and finish with a clear outcome.`,
    });
  }

  const results: HistoryMissionSuggestion[] = [];
  for (const template of templates) {
    if (results.length >= count) break;
    const prompt = sanitizeUserFacingText(template.prompt).slice(0, 520);
    const label = isAwkwardSuggestionLabel(template.label)
      ? polishSuggestionLabel(template.label, prompt, topic)
      : template.label.slice(0, 72);
    if (!isDistinctSuggestion(missionBrief, prompt, [...excludePrompts, ...results.map((item) => item.prompt)], false)) continue;
    results.push({
      id: generateId(),
      historyId: entry.id,
      historyBrief: entry.missionBrief,
      label,
      prompt,
    });
  }

  while (results.length < count) {
    const replacement = buildGuaranteedHistoryReplacement(entry, [
      ...excludePrompts,
      ...results.map((item) => item.prompt),
    ]);
    if (results.some((item) => item.prompt === replacement.prompt)) {
      const serial = excludePrompts.length + results.length + 1;
      results.push({
        id: generateId(),
        historyId: entry.id,
        historyBrief: entry.missionBrief,
        label: `Fresh Follow-Up ${serial}`.slice(0, 72),
        prompt: sanitizeUserFacingText(
          `Give me a fresh adjacent mission idea #${serial} for ${topic.phrase} with a clear deliverable and a practical outcome I can execute next.`,
        ).slice(0, 520),
      });
    } else {
      results.push({
        id: generateId(),
        historyId: entry.id,
        historyBrief: entry.missionBrief,
        label: replacement.label,
        prompt: replacement.prompt,
      });
    }
  }

  return results.slice(0, count);
}

async function callSuggestionModel(system: string, user: string, temperature = 0.85) {
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
  return isMockMode()
    ? createMockClient().chat(messages)
    : createQwenClient().chat(messages, { temperature, maxTokens: 1800 });
}

function ensureSuggestionsPerEntry(
  entries: MissionHistoryEntry[],
  current: HistoryMissionSuggestion[],
  suggestionsPerEntry: number,
): HistoryMissionSuggestion[] {
  const rows: HistoryMissionSuggestion[] = [];

  for (const entry of entries) {
    const existing = current.filter((item) => item.historyId === entry.id).slice(0, suggestionsPerEntry);
    if (existing.length >= suggestionsPerEntry) {
      rows.push(...existing);
      continue;
    }

    const missing = suggestionsPerEntry - existing.length;
    const fallback = buildTopicFallbackSuggestions(entry, missing, [
      ...existing.map((item) => item.prompt),
      entry.missionBrief,
    ]);
    rows.push(...existing, ...fallback.slice(0, missing));
  }

  return rows;
}

export async function generateHistoryMissionSuggestions(
  entries: MissionHistoryEntry[],
  suggestionsPerEntry = SUGGESTIONS_PER_ENTRY,
): Promise<HistoryMissionSuggestion[]> {
  const recent = entries.slice(0, MAX_HISTORY_ENTRIES);
  if (!recent.length) return [];

  const contexts = recent.map(buildEntryContext);
  const system = `You generate fresh adjacent follow-up mission briefs for an AI mission control product.
Each suggestion must stay in the SAME topic/domain as its source mission, but must be a DIFFERENT mission with a new angle.
${DISTINCT_SUGGESTION_RULES}
Every prompt must be a complete mission brief the user can paste directly into the composer.
Return ONLY JSON in this shape:
{"missions":[{"historyId":"id","suggestions":[{"label":"simple topic-specific title","prompt":"complete mission brief under 220 characters"}]}]}
Generate exactly ${suggestionsPerEntry} suggestions for EVERY mission in the input.`;

  const user = contexts.map((context) => [
    `historyId: ${context.historyId}`,
    `topicName: ${context.topic.name}`,
    `topicPhrase: ${context.topic.phrase}`,
    `sourceMission: ${context.missionBrief}`,
    context.recommendation ? `priorRecommendation: ${context.recommendation}` : "",
    context.roadmap ? `priorRoadmap: ${context.roadmap}` : "",
  ].filter(Boolean).join("\n")).join("\n\n---\n\n");

  let parsed: HistoryMissionSuggestion[] = [];
  try {
    const response = await callSuggestionModel(system, user);
    parsed = parseSuggestionsPayload(response, recent);
  } catch {
    parsed = [];
  }

  if (!parsed.length) {
    return recent.flatMap((entry) => buildTopicFallbackSuggestions(entry, suggestionsPerEntry, [entry.missionBrief]));
  }

  return ensureSuggestionsPerEntry(recent, parsed, suggestionsPerEntry);
}

export async function replaceHistoryMissionSuggestion(
  entry: MissionHistoryEntry,
  excludePrompts: string[] = [],
): Promise<HistoryMissionSuggestion> {
  const context = buildEntryContext(entry);
  const excludeBlock = excludePrompts.length
    ? `\nDo NOT repeat or closely paraphrase any of these excluded prompts:\n${excludePrompts.map((prompt) => `- ${prompt}`).join("\n")}`
    : "";

  const system = `You generate one fresh adjacent follow-up mission brief for an AI mission control product.
${DISTINCT_SUGGESTION_RULES}
Return ONLY JSON: {"suggestions":[{"label":"simple topic-specific title","prompt":"complete mission brief under 220 characters"}]}
Generate exactly 1 suggestion that is clearly different from every excluded prompt.${excludeBlock}`;

  const user = [
    `historyId: ${context.historyId}`,
    `topic: ${context.topic}`,
    `sourceMission: ${context.missionBrief}`,
    `replacementAttempt: ${excludePrompts.length + 1}`,
    context.recommendation ? `priorRecommendation: ${context.recommendation}` : "",
    context.roadmap ? `priorRoadmap: ${context.roadmap}` : "",
  ].filter(Boolean).join("\n");

  try {
    const response = await callSuggestionModel(system, user, 0.95);
    const parsed = parseSuggestionsPayload(response, [entry], { [entry.id]: excludePrompts });
    const candidate = parsed.find((item) => !excludePrompts.some((prompt) => jaccardSimilarity(prompt, item.prompt) >= 0.62));
    if (candidate) return candidate;
  } catch {
    // Fall through to guaranteed replacement below.
  }

  const guaranteed = buildGuaranteedHistoryReplacement(entry, excludePrompts);
  return {
    id: generateId(),
    historyId: entry.id,
    historyBrief: entry.missionBrief,
    label: guaranteed.label,
    prompt: guaranteed.prompt,
  };
}
