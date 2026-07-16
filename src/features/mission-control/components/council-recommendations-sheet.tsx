"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { createMockClient, createQwenClient, isMockMode } from "@/services/qwen";
import { generateId, sanitizeUserFacingText } from "@/utils";
import type { MissionHistoryEntry } from "@/types";

export type TopicAwareSuggestion = {
  id: string;
  historyId: string;
  historyBrief: string;
  label: string;
  prompt: string;
  why: string;
  angle: string;
};

type SuggestionContext = {
  primaryTopic: string;
  userGoal: string;
  importantEntities: string[];
  constraints: string[];
  sourceBrief: string;
};

type SeenSuggestionState = {
  labels: string[];
  prompts: string[];
  angles: string[];
};

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "to", "of", "in", "on", "for", "with", "from",
  "my", "me", "i", "am", "is", "are", "be", "as", "at", "by", "it", "that", "this",
  "give", "me", "help", "please", "want", "need", "can", "you", "plan", "follow",
  "strategy", "mission", "budget", "days", "day", "week", "weeks", "month", "months",
  "create", "make", "build", "get", "have", "do", "how", "what", "which", "should",
]);

const GENERIC_PATTERNS = [
  /map next milestones/i,
  /sharpen strategy/i,
  /prioritize next/i,
  /compare top approaches/i,
  /objective constraints/i,
  /evidence baseline/i,
  /give plan requirements/i,
  /improve recent work/i,
  /continue last mission/i,
  /implement next step/i,
  /where we left off/i,
  /the best current options/i,
  /source mission/i,
  /previous mission/i,
  /workstream/i,
  /checkpoint/i,
  /execution phase/i,
  /parent mission/i,
  /agent signal/i,
  /finalizer/i,
  /mission graph/i,
  /latest recommendation/i,
];

const ANGLE_STRATEGIES = [
  "compare options within the topic",
  "understand fundamentals",
  "identify best choices",
  "investigate common mistakes",
  "improve a particular skill",
  "create a focused routine",
  "analyze recent changes",
  "review tools or resources",
  "validate an assumption",
  "explore an advanced subtopic",
  "measure progress",
  "solve a likely obstacle",
] as const;

function cleanText(value: string) {
  return sanitizeUserFacingText(value).replace(/\s+/g, " ").trim();
}

export function normalizeSuggestion(text: string) {
  return cleanText(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string) {
  return normalizeSuggestion(text)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

function jaccard(left: string, right: string) {
  const a = new Set(tokenize(left));
  const b = new Set(tokenize(right));
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap / (a.size + b.size - overlap);
}

export function isNearDuplicate(left: string, right: string) {
  const a = normalizeSuggestion(left);
  const b = normalizeSuggestion(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return jaccard(a, b) >= 0.55;
}

export function isGenericSuggestion(text: string) {
  const value = cleanText(text);
  if (!value) return true;
  return GENERIC_PATTERNS.some((pattern) => pattern.test(value));
}

export function extractSuggestionContext(brief: string): SuggestionContext {
  const sourceBrief = cleanText(brief);
  const withoutNoise = sourceBrief
    .replace(/\$\s?\d[\d,]*(?:\.\d+)?/gi, " ")
    .replace(/\b\d{1,3}\s*(?:day|days|week|weeks|month|months)\b/gi, " ")
    .replace(/\b(?:budget|spend|cost|timeline|deadline)\b[^,.!?]*/gi, " ")
    .replace(/^(?:give me|help me|i want|i need|please|can you)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const goalMatch = sourceBrief.match(
    /\b(?:to|for|toward|towards)\s+([a-z][\w\s'-]{3,60}?)(?:\s+and\b|\s+with\b|\s+in\b|\s+on\b|,|\.|$)/i,
  );
  const userGoal = cleanText(goalMatch?.[1] ?? "").slice(0, 80);

  const money = sourceBrief.match(/\$\s?\d[\d,]*(?:\.\d+)?/gi) ?? [];
  const durations = sourceBrief.match(/\b\d{1,3}\s*(?:day|days|week|weeks|month|months)\b/gi) ?? [];
  const constraints = [...money, ...durations].map(cleanText).filter(Boolean);

  const entities = tokenize(withoutNoise);
  const importantEntities = [...new Set(entities)].slice(0, 8);

  // Prefer linguistically marked subject phrases (no domain hardcoding).
  const subjectPatterns = [
    /\bas\s+(?:a|an)\s+([A-Za-z][\w\s'-]{2,48}?)(?:\s+to\b|\s+in\b|\s+and\b|,|\.|$)/i,
    /\b(?:about|for|on|in)\s+([A-Za-z][\w\s'-]{2,48}?)(?:\s+and\b|\s+with\b|\s+to\b|,|\.|$)/i,
    /\b(?:learning|studying|playing|practicing|preparing for)\s+([A-Za-z][\w\s'-]{2,48}?)(?:\s+for\b|\s+in\b|\s+and\b|,|\.|$)/i,
  ];

  let primaryTopic = "";
  for (const pattern of subjectPatterns) {
    const match = withoutNoise.match(pattern);
    if (!match?.[1]) continue;
    primaryTopic = cleanText(match[1])
      .replace(/\b(?:and|with|my|a|an|the|that|i|can|follow)\b.*$/i, "")
      .trim();
    if (primaryTopic.split(/\s+/).filter(Boolean).length >= 1) break;
    primaryTopic = "";
  }

  if (!primaryTopic || primaryTopic.split(/\s+/).length < 2) {
    // Take the densest contiguous meaningful tokens (up to 4).
    const words = withoutNoise
      .split(/\s+/)
      .map((word) => word.replace(/[^\w'-]/g, ""))
      .filter((word) => word.length > 2 && !STOPWORDS.has(word.toLowerCase()));
    primaryTopic = words.slice(0, 4).join(" ");
  }

  if (!primaryTopic) {
    primaryTopic = importantEntities.slice(0, 3).join(" ") || "this topic";
  }

  // Title-case lightly for display.
  primaryTopic = primaryTopic
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .slice(0, 64);

  return {
    primaryTopic,
    userGoal,
    importantEntities,
    constraints,
    sourceBrief,
  };
}

export function isTopicRelevant(text: string, context: SuggestionContext) {
  if (isGenericSuggestion(text)) return false;
  const normalized = normalizeSuggestion(text);
  const topicTokens = tokenize(context.primaryTopic);
  const entityHits = context.importantEntities.filter((entity) =>
    normalized.includes(normalizeSuggestion(entity)),
  ).length;
  const topicHits = topicTokens.filter((token) => normalized.includes(token)).length;

  // Must mention the topic or enough distinctive entities from the source.
  if (topicHits >= Math.min(2, topicTokens.length) || entityHits >= 2) return true;
  if (topicTokens.length === 1 && topicHits === 1) return true;
  if (context.primaryTopic.length >= 4 && normalized.includes(normalizeSuggestion(context.primaryTopic))) {
    return true;
  }
  return false;
}

function selectUnusedAngle(usedAngles: string[]) {
  const unused = ANGLE_STRATEGIES.filter(
    (angle) => !usedAngles.some((used) => normalizeSuggestion(used) === normalizeSuggestion(angle)),
  );
  if (unused.length) return unused[0];
  return ANGLE_STRATEGIES[usedAngles.length % ANGLE_STRATEGIES.length];
}

export function buildFallbackSuggestion(
  context: SuggestionContext,
  used: SeenSuggestionState,
): Omit<TopicAwareSuggestion, "id" | "historyId" | "historyBrief"> {
  const topic = context.primaryTopic;
  const angle = selectUnusedAngle(used.angles);
  const templates: Array<{ label: string; prompt: string; why: string; angle: string }> = [
    {
      angle: "compare options within the topic",
      label: `Compare options for ${topic}`.slice(0, 72),
      prompt: `What are the best options I should consider for ${topic}?`,
      why: "The completed work leaves a decision open; comparing options makes the next move clearer.",
    },
    {
      angle: "investigate common mistakes",
      label: `Avoid pitfalls in ${topic}`.slice(0, 72),
      prompt: `What common mistakes should I avoid when working on ${topic}?`,
      why: "This follows naturally from the work so far by protecting the plan from avoidable setbacks.",
    },
    {
      angle: "create a focused routine",
      label: `Build a practical routine for ${topic}`.slice(0, 72),
      prompt: `Create a focused daily practice routine for ${topic}.`,
      why: "A repeatable routine turns the council's recommendations into steady progress.",
    },
    {
      angle: "improve a particular skill",
      label: `Strengthen the key skills for ${topic}`.slice(0, 72),
      prompt: `Which skills matter most for ${topic}, and how should I improve them?`,
      why: "This focuses effort on the capabilities most likely to improve the outcome.",
    },
    {
      angle: "review tools or resources",
      label: `Choose the right tools for ${topic}`.slice(0, 72),
      prompt: `What tools or resources should I use to get better at ${topic}?`,
      why: "The right tools and resources can shorten the path from intent to execution.",
    },
    {
      angle: "solve a likely obstacle",
      label: `Clear likely blockers in ${topic}`.slice(0, 72),
      prompt: `What obstacles usually block progress on ${topic}, and how do I solve them?`,
      why: "This addresses the obstacles most likely to slow down the next phase of work.",
    },
    {
      angle: "measure progress",
      label: `Measure progress on ${topic}`.slice(0, 72),
      prompt: `How should I measure progress on ${topic} week by week?`,
      why: "Clear signals make it easier to see whether the next step is working.",
    },
    {
      angle: "explore an advanced subtopic",
      label: `Explore the next strategic angle for ${topic}`.slice(0, 72),
      prompt: `Explore the most important advanced strategies for ${topic}.`,
      why: "The current result creates a clear opportunity to go deeper where it will matter most.",
    },
  ];

  for (const template of templates) {
    if (used.angles.some((item) => normalizeSuggestion(item) === normalizeSuggestion(template.angle))) continue;
    if (used.labels.some((item) => isNearDuplicate(item, template.label))) continue;
    if (used.prompts.some((item) => isNearDuplicate(item, template.prompt))) continue;
    if (!isTopicRelevant(template.prompt, context) || isGenericSuggestion(template.label)) continue;
    return template;
  }

  return {
    angle,
    label: `Take the next practical step for ${topic}`.slice(0, 72),
    prompt: `Explore another useful angle of ${topic} that I have not covered yet.`,
    why: "This keeps momentum by turning the completed work into a focused next decision.",
  };
}

function isAcceptableSuggestion(
  label: string,
  prompt: string,
  context: SuggestionContext,
  used: SeenSuggestionState,
) {
  if (label.length < 4 || prompt.length < 18) return false;
  if (isGenericSuggestion(label) || isGenericSuggestion(prompt)) return false;
  if (!isTopicRelevant(prompt, context) && !isTopicRelevant(label, context)) return false;
  if (used.labels.some((item) => isNearDuplicate(item, label))) return false;
  if (used.prompts.some((item) => isNearDuplicate(item, prompt))) return false;
  return true;
}

async function callSuggestionModel(system: string, user: string) {
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
  return isMockMode()
    ? createMockClient().chat(messages)
    : createQwenClient().chat(messages, { temperature: 0.85, maxTokens: 1400 });
}

function parseSuggestionPayload(raw: string): Array<{ label?: string; prompt?: string; why?: string; angle?: string }> {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as {
      suggestions?: Array<{ label?: string; prompt?: string; why?: string; angle?: string }>;
    };
    return Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  } catch {
    return [];
  }
}

async function generateSuggestionsForEntry(
  entry: MissionHistoryEntry,
  count: number,
  used: SeenSuggestionState,
): Promise<TopicAwareSuggestion[]> {
  const context = extractSuggestionContext(entry.missionBrief);
  const results: TopicAwareSuggestion[] = [];
  const localUsed: SeenSuggestionState = {
    labels: [...used.labels],
    prompts: [...used.prompts],
    angles: [...used.angles],
  };

  const system = `You generate topic-aware follow-up missions for a mission control product.
Identify the central subject of the source mission, then invent natural sibling missions about that same subject.

Rules:
- primaryTopic must stay obvious in every title or mission text.
- Titles must be specific and self-explanatory (e.g. "Best Champions for Ranked Climbing"), never abstract workflow labels.
- Mission text must sound like something a human would type.
- Never use: Map Next Milestones, Sharpen Strategy, Compare Top Approaches, Objective Constraints, Evidence Baseline, source mission, workstream, checkpoint, parent mission.
- Each suggestion must use a different semantic angle.
- Return ONLY JSON:
{"suggestions":[{"label":"specific title","prompt":"natural human mission under 220 chars","why":"one short reason","angle":"short angle name"}]}`;

  const user = [
    `sourceMission: ${context.sourceBrief}`,
    `primaryTopic: ${context.primaryTopic}`,
    context.userGoal ? `userGoal: ${context.userGoal}` : "",
    context.importantEntities.length ? `importantEntities: ${context.importantEntities.join(", ")}` : "",
    context.constraints.length ? `constraints: ${context.constraints.join(", ")}` : "",
    `neededCount: ${count}`,
    `angleStrategies: ${ANGLE_STRATEGIES.join("; ")}`,
    localUsed.labels.length ? `excludeLabels: ${localUsed.labels.join(" | ")}` : "",
    localUsed.prompts.length ? `excludePrompts: ${localUsed.prompts.join(" | ")}` : "",
    localUsed.angles.length ? `excludeAngles: ${localUsed.angles.join(" | ")}` : "",
  ].filter(Boolean).join("\n");

  try {
    const response = await callSuggestionModel(system, user);
    for (const item of parseSuggestionPayload(response)) {
      if (results.length >= count) break;
      const label = cleanText(item.label ?? "").slice(0, 72);
      const prompt = cleanText(item.prompt ?? "").slice(0, 280);
      const why = cleanText(item.why ?? `Suggested because this explores another useful angle of ${context.primaryTopic}.`).slice(0, 180);
      const angle = cleanText(item.angle ?? selectUnusedAngle(localUsed.angles)).slice(0, 80);
      if (!isAcceptableSuggestion(label, prompt, context, localUsed)) continue;
      const suggestion: TopicAwareSuggestion = {
        id: generateId(),
        historyId: entry.id,
        historyBrief: entry.missionBrief,
        label,
        prompt,
        why,
        angle,
      };
      results.push(suggestion);
      localUsed.labels.push(label);
      localUsed.prompts.push(prompt);
      localUsed.angles.push(angle);
    }
  } catch {
    // Fall through to topic-aware fallbacks.
  }

  while (results.length < count) {
    const fallback = buildFallbackSuggestion(context, localUsed);
    if (!isAcceptableSuggestion(fallback.label, fallback.prompt, context, localUsed)) {
      // Force a unique prompt if filters reject everything.
      const serial = localUsed.prompts.length + 1;
      fallback.label = `${context.primaryTopic} Idea ${serial}`.slice(0, 72);
      fallback.prompt = `What else should I learn about ${context.primaryTopic} that I have not covered yet (angle ${serial})?`;
      fallback.angle = `fallback-${serial}`;
    }
    const suggestion: TopicAwareSuggestion = {
      id: generateId(),
      historyId: entry.id,
      historyBrief: entry.missionBrief,
      ...fallback,
    };
    results.push(suggestion);
    localUsed.labels.push(suggestion.label);
    localUsed.prompts.push(suggestion.prompt);
    localUsed.angles.push(suggestion.angle);
  }

  return results;
}

export async function generateTopicAwareSuggestions(
  entries: MissionHistoryEntry[],
  perEntry = 2,
): Promise<TopicAwareSuggestion[]> {
  const recent = entries.slice(0, 5);
  const all: TopicAwareSuggestion[] = [];
  for (const entry of recent) {
    const generated = await generateSuggestionsForEntry(entry, perEntry, {
      labels: [],
      prompts: [],
      angles: [],
    });
    all.push(...generated);
  }
  return all;
}

export async function replaceTopicAwareSuggestion(
  entry: MissionHistoryEntry,
  used: SeenSuggestionState,
): Promise<TopicAwareSuggestion> {
  const [replacement] = await generateSuggestionsForEntry(entry, 1, used);
  return replacement;
}

export function CouncilRecommendationsSheet({
  open,
  entries,
  suggestions: _legacySuggestions,
  loading: _legacyLoading,
  error: legacyError,
  onOpenChange,
  onSelect,
  onReplace: _legacyReplace,
}: {
  open: boolean;
  entries: MissionHistoryEntry[];
  suggestions: Array<{ id: string; historyId: string; historyBrief: string; label: string; prompt: string }>;
  loading: boolean;
  error: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (prompt: string) => void;
  onReplace: (current: { id: string; historyId: string; historyBrief: string; label: string; prompt: string }) => Promise<unknown>;
}) {
  const [suggestions, setSuggestions] = useState<TopicAwareSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [replaceError, setReplaceError] = useState("");
  const seenByHistoryRef = useRef<Record<string, SeenSuggestionState>>({});
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    setReplaceError("");
    seenByHistoryRef.current = {};
    void generateTopicAwareSuggestions(entries, 2)
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setSuggestions(result);
        for (const item of result) {
          const seen = seenByHistoryRef.current[item.historyId] ?? { labels: [], prompts: [], angles: [] };
          seenByHistoryRef.current[item.historyId] = {
            labels: [...seen.labels, item.label],
            prompts: [...seen.prompts, item.prompt],
            angles: [...seen.angles, item.angle],
          };
        }
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : "Could not generate recommendations.");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [open, entries]);

  const grouped = useMemo(() => {
    const map = new Map<string, { entry: MissionHistoryEntry; items: TopicAwareSuggestion[] }>();
    for (const entry of entries.slice(0, 5)) {
      map.set(entry.id, { entry, items: suggestions.filter((item) => item.historyId === entry.id) });
    }
    return Array.from(map.values());
  }, [entries, suggestions]);

  const replaceSuggestion = async (current: TopicAwareSuggestion) => {
    const entry = entries.find((item) => item.id === current.historyId);
    if (!entry) return;
    setReplacingId(current.id);
    setReplaceError("");
    try {
      const seen = seenByHistoryRef.current[entry.id] ?? { labels: [], prompts: [], angles: [] };
      const exclude = {
        labels: [...seen.labels, current.label],
        prompts: [...seen.prompts, current.prompt],
        angles: [...seen.angles, current.angle],
      };
      const replacement = await replaceTopicAwareSuggestion(entry, exclude);
      seenByHistoryRef.current[entry.id] = {
        labels: [...exclude.labels, replacement.label],
        prompts: [...exclude.prompts, replacement.prompt],
        angles: [...exclude.angles, replacement.angle],
      };
      setSuggestions((items) => items.map((item) => (item.id === current.id ? replacement : item)));
    } catch (err) {
      setReplaceError(err instanceof Error ? err.message : "Could not replace this recommendation.");
    } finally {
      setReplacingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-hidden border-l border-cyan-200/20 bg-[#06101d]/92 p-0 text-white shadow-[0_0_110px_rgba(34,211,238,0.22)] backdrop-blur-2xl sm:max-w-2xl">
        <SheetHeader className="sticky top-0 z-10 border-b border-cyan-200/10 bg-[#06101d]/95 p-5 backdrop-blur-2xl">
          <SheetTitle className="flex items-center gap-3 text-white">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10">
              <Sparkles className="h-5 w-5 text-cyan-100" />
            </span>
            Council Suggestions
          </SheetTitle>
          <p className="text-sm leading-relaxed text-white/55">
            AI-generated follow-up missions inspired by your mission history. Each suggestion stays on the same topic but explores a fresh angle.
          </p>
        </SheetHeader>

        <div className="h-full overflow-y-auto px-5 pb-10 [scrollbar-color:rgba(34,211,238,0.35)_transparent]">
          {loading && (
            <div className="flex items-center gap-3 rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.045] p-4 text-sm text-cyan-100/80">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating recommendations from your mission history...
            </div>
          )}

          {(error || replaceError || legacyError) && (
            <div className="mb-4 rounded-2xl border border-amber-200/20 bg-amber-300/[0.06] p-4 text-sm text-amber-100/80">
              {error || replaceError || legacyError}
            </div>
          )}

          {!loading && grouped.map(({ entry, items }) => (
            <div key={entry.id} className="mt-5 first:mt-0">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/38">Inspired by</p>
                <p className="mt-1 text-sm leading-relaxed text-white/72">{entry.missionBrief}</p>
              </div>

              <div className="mt-3 space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.045] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-cyan-50">{item.label}</p>
                        <p className="mt-2 text-xs leading-relaxed text-white/55">{item.prompt}</p>
                        {item.why && (
                          <p className="mt-2 text-[0.68rem] leading-relaxed text-white/40">Why this? {item.why}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={replacingId === item.id}
                          onClick={() => void replaceSuggestion(item)}
                          className="gap-1.5 rounded-full border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                        >
                          {replacingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          Replace
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onSelect(item.prompt)}
                          className="rounded-full bg-cyan-300 text-[#06101f] hover:bg-cyan-200"
                        >
                          Use Mission
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {!loading && items.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">
                    No suggestions generated for this mission yet.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
