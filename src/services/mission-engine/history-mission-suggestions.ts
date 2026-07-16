import type { MissionHistoryEntry } from "@/types";
import { createMockClient, createQwenClient, isMockMode } from "@/services/qwen";
import { generateId, sanitizeUserFacingText } from "@/utils";

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
- Prefer adjacent missions such as: meta research, tool comparison, skill breakdown, prerequisite learning, decision review, risk audit, practice system design, resource guide, setup optimization, champion/build analysis, market scan, competitor review, learning roadmap, or diagnostic audit.
- Do NOT restate the same primary outcome, timeline, and budget together.
- Do NOT copy more than a few words from the source mission.
- BAD example: source asks for a challenger climb plan with $100 -> suggestion asks for another challenger climb plan with $100.
- GOOD example: source asks for a challenger climb plan -> suggestion asks for the best champions on the current patch, or a vod review framework, or role-selection analysis.`;

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

function isDistinctSuggestion(sourceMission: string, prompt: string, excludePrompts: string[] = []) {
  if (jaccardSimilarity(sourceMission, prompt) >= SIMILARITY_THRESHOLD) return false;
  if (sharesConstraintBundle(sourceMission, prompt)) return false;
  if (excludePrompts.some((existing) => jaccardSimilarity(existing, prompt) >= 0.48)) return false;
  const sourceSnippet = sanitizeUserFacingText(sourceMission).toLowerCase().slice(0, 48);
  if (sourceSnippet.length >= 24 && sanitizeUserFacingText(prompt).toLowerCase().includes(sourceSnippet)) return false;
  return true;
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
      for (const item of group.suggestions) {
        const prompt = sanitizeUserFacingText(item.prompt ?? "").trim();
        const label = sanitizeUserFacingText(item.label ?? "").trim();
        if (prompt.length < 18 || label.length < 4) continue;
        if (!isDistinctSuggestion(entry.missionBrief, prompt, excludeByHistory[entry.id] ?? [])) continue;
        rows.push({
          id: generateId(),
          historyId: entry.id,
          historyBrief: entry.missionBrief,
          label: label.slice(0, 72),
          prompt: prompt.slice(0, 520),
        });
      }
    }
    return rows;
  }

  const entry = entries[0];
  if (!entry || !Array.isArray(parsed.suggestions)) return rows;
  for (const item of parsed.suggestions) {
    const prompt = sanitizeUserFacingText(item.prompt ?? "").trim();
    const label = sanitizeUserFacingText(item.label ?? "").trim();
    if (prompt.length < 18 || label.length < 4) continue;
    if (!isDistinctSuggestion(entry.missionBrief, prompt, excludeByHistory[entry.id] ?? [])) continue;
    rows.push({
      id: generateId(),
      historyId: entry.id,
      historyBrief: entry.missionBrief,
      label: label.slice(0, 72),
      prompt: prompt.slice(0, 520),
    });
  }
  return rows;
}

function buildFallbackSuggestions(
  entry: MissionHistoryEntry,
  count: number,
  excludePrompts: string[] = [],
): HistoryMissionSuggestion[] {
  const domain = sanitizeUserFacingText(entry.missionBrief).replace(/\s+/g, " ").trim();
  const recommendation = entry.finalReport?.finalRecommendations
    ?.split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .find((line) => line.length >= 18);

  const seedAngles = [
    `Analyze the latest tools, trends, and best current options in the same domain as this topic, then recommend the single most useful adjacent mission to run next: ${domain}`,
    `Compare the top 3 practical follow-up missions someone could run after exploring this topic area, then recommend the best one with clear deliverables: ${domain}`,
    `Identify the highest-leverage prerequisite knowledge, setup, or research gap related to this topic and turn it into a standalone mission: ${domain}`,
    `Review common mistakes, hidden risks, and optimization opportunities in this topic area and propose a focused diagnostic mission: ${domain}`,
    `Design a resource guide or decision framework that helps someone make better choices in this topic area without repeating the original mission goal: ${domain}`,
  ];

  if (recommendation) {
    seedAngles.unshift(
      `Turn this completed recommendation into a separate follow-up mission with its own deliverables and acceptance criteria: ${recommendation}`,
    );
  }

  const results: HistoryMissionSuggestion[] = [];
  for (const template of seedAngles) {
    if (results.length >= count) break;
    const prompt = sanitizeUserFacingText(template).slice(0, 520);
    if (!isDistinctSuggestion(entry.missionBrief, prompt, [...excludePrompts, ...results.map((item) => item.prompt)])) continue;
    results.push({
      id: generateId(),
      historyId: entry.id,
      historyBrief: entry.missionBrief,
      label: (prompt.split(/[.!?]/)[0] ?? prompt).slice(0, 72),
      prompt,
    });
  }

  return results;
}

async function callSuggestionModel(system: string, user: string) {
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
  return isMockMode()
    ? createMockClient().chat(messages)
    : createQwenClient().chat(messages, { temperature: 0.95, maxTokens: 1600 });
}

function fillMissingSuggestions(
  entries: MissionHistoryEntry[],
  current: HistoryMissionSuggestion[],
  suggestionsPerEntry: number,
) {
  const rows = [...current];
  for (const entry of entries) {
    const existing = rows.filter((item) => item.historyId === entry.id);
    const missing = suggestionsPerEntry - existing.length;
    if (missing <= 0) continue;
    const fallback = buildFallbackSuggestions(entry, missing, [
      ...existing.map((item) => item.prompt),
      entry.missionBrief,
    ]);
    rows.push(...fallback);
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
{"missions":[{"historyId":"id","suggestions":[{"label":"4-8 word title","prompt":"complete mission brief under 220 characters"}]}]}
Generate exactly ${suggestionsPerEntry} suggestions per mission.`;

  const user = contexts.map((context) => [
    `historyId: ${context.historyId}`,
    `sourceMission: ${context.missionBrief}`,
    context.recommendation ? `priorRecommendation: ${context.recommendation}` : "",
    context.roadmap ? `priorRoadmap: ${context.roadmap}` : "",
  ].filter(Boolean).join("\n")).join("\n\n---\n\n");

  try {
    const response = await callSuggestionModel(system, user);
    const parsed = parseSuggestionsPayload(response, recent);
    if (parsed.length) {
      return fillMissingSuggestions(recent, parsed, suggestionsPerEntry);
    }
  } catch {
    // Fall through to dynamic fallback below.
  }

  return recent.flatMap((entry) => buildFallbackSuggestions(entry, suggestionsPerEntry, [entry.missionBrief]));
}

export async function replaceHistoryMissionSuggestion(
  entry: MissionHistoryEntry,
  excludePrompts: string[] = [],
): Promise<HistoryMissionSuggestion | null> {
  const context = buildEntryContext(entry);
  const excludeBlock = excludePrompts.length
    ? `\nDo NOT repeat or closely paraphrase any of these excluded prompts:\n${excludePrompts.map((prompt) => `- ${prompt}`).join("\n")}`
    : "";

  const system = `You generate one fresh adjacent follow-up mission brief for an AI mission control product.
${DISTINCT_SUGGESTION_RULES}
Return ONLY JSON: {"suggestions":[{"label":"4-8 word title","prompt":"complete mission brief under 220 characters"}]}
Generate exactly 1 suggestion.${excludeBlock}`;

  const user = [
    `historyId: ${context.historyId}`,
    `sourceMission: ${context.missionBrief}`,
    context.recommendation ? `priorRecommendation: ${context.recommendation}` : "",
    context.roadmap ? `priorRoadmap: ${context.roadmap}` : "",
  ].filter(Boolean).join("\n");

  try {
    const response = await callSuggestionModel(system, user);
    const parsed = parseSuggestionsPayload(response, [entry], { [entry.id]: excludePrompts });
    if (parsed[0]) return parsed[0];
  } catch {
    // Fall through to dynamic fallback below.
  }

  return buildFallbackSuggestions(entry, 1, [...excludePrompts, entry.missionBrief])[0] ?? null;
}
