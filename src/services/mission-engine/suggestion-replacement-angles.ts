import type { CouncilSuggestionIconKind } from "@/types/council.types";
import type { MissionHistoryEntry } from "@/types";
import { sanitizeUserFacingText } from "@/utils";
import { extractMissionTopic, humanBriefForTopic, type MissionTopic } from "./suggestion-label-utils";

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "give", "plan", "follow",
  "want", "need", "make", "create", "build", "design", "help", "into", "about", "have",
  "will", "should", "would", "could", "mission", "strategy", "budget", "days", "weeks",
]);

type ReplacementAngle = {
  label: string;
  prompt: (topic: MissionTopic) => string;
  iconKind: CouncilSuggestionIconKind;
  why: (topic: MissionTopic) => string;
};

const REPLACEMENT_ANGLES: ReplacementAngle[] = [
  {
    label: "Compare Best Tools",
    prompt: (topic) => `Compare the best tools, apps, and resources for ${topic.phrase}, then recommend what I should use next.`,
    iconKind: "research",
    why: (topic) => `Suggested because comparing tools will sharpen your next move on ${topic.phrase}.`,
  },
  {
    label: "Build Weekly Schedule",
    prompt: (topic) => `Create a practical weekly schedule for ${topic.phrase} with milestones I can actually follow.`,
    iconKind: "implement",
    why: (topic) => `Suggested because a concrete schedule turns ${topic.phrase} into steady progress.`,
  },
  {
    label: "Review Key Risks",
    prompt: (topic) => `Identify the biggest risks in my plan for ${topic.phrase} and propose a focused way to reduce them.`,
    iconKind: "reduce-risk",
    why: (topic) => `Suggested because catching risks early protects the work on ${topic.phrase}.`,
  },
  {
    label: "Validate The Plan",
    prompt: (topic) => `Stress-test my approach to ${topic.phrase}, challenge weak assumptions, and recommend the best correction.`,
    iconKind: "validate",
    why: (topic) => `Suggested because validating the plan for ${topic.phrase} catches blind spots early.`,
  },
  {
    label: "Estimate Costs",
    prompt: (topic) => `Break down the realistic costs for ${topic.phrase} and show where the budget should go first.`,
    iconKind: "estimate-cost",
    why: (topic) => `Suggested because a cost breakdown makes the next decision on ${topic.phrase} clearer.`,
  },
  {
    label: "Sharpen Strategy",
    prompt: (topic) => `Review my current strategy for ${topic.phrase} and propose a sharper version with clearer priorities.`,
    iconKind: "optimize",
    why: (topic) => `Suggested because refining the strategy for ${topic.phrase} creates a stronger follow-up mission.`,
  },
  {
    label: "Explore Next Angle",
    prompt: (topic) => `Suggest the highest-value next angle for ${topic.phrase} that I have not covered yet.`,
    iconKind: "expand",
    why: (topic) => `Suggested because a fresh angle on ${topic.phrase} opens new leverage.`,
  },
  {
    label: "Study Core Concepts",
    prompt: (topic) => `Identify the core concepts I still need for ${topic.phrase} and turn them into a short learning mission.`,
    iconKind: "research",
    why: (topic) => `Suggested because filling knowledge gaps will improve every later step on ${topic.phrase}.`,
  },
  {
    label: "Compare Top Approaches",
    prompt: (topic) => `Compare the top 3 approaches to ${topic.phrase} and tell me which one I should choose.`,
    iconKind: "research",
    why: (topic) => `Suggested because comparing approaches helps you commit to the right path for ${topic.phrase}.`,
  },
  {
    label: "Design Practice Routine",
    prompt: (topic) => `Design a focused practice routine for ${topic.phrase} that builds the skills I need most.`,
    iconKind: "implement",
    why: (topic) => `Suggested because deliberate practice will accelerate progress on ${topic.phrase}.`,
  },
  {
    label: "Audit Progress",
    prompt: (topic) => `Audit my progress on ${topic.phrase}, identify what is working, and recommend the next correction.`,
    iconKind: "validate",
    why: (topic) => `Suggested because a progress audit keeps ${topic.phrase} on track.`,
  },
  {
    label: "Create Action Checklist",
    prompt: (topic) => `Build a practical checklist for ${topic.phrase} so I know exactly what to do next.`,
    iconKind: "implement",
    why: (topic) => `Suggested because a checklist removes ambiguity from the next step on ${topic.phrase}.`,
  },
  {
    label: "Find Expert Guidance",
    prompt: (topic) => `Research the best mentors, communities, or guides for ${topic.phrase} and how I should use them.`,
    iconKind: "research",
    why: (topic) => `Suggested because the right guidance can shortcut trial and error on ${topic.phrase}.`,
  },
  {
    label: "Fix Main Bottleneck",
    prompt: (topic) => `Find the main bottleneck blocking progress on ${topic.phrase} and propose a mission to remove it.`,
    iconKind: "optimize",
    why: (topic) => `Suggested because removing the bottleneck unlocks the next stage of ${topic.phrase}.`,
  },
  {
    label: "Define Success Metrics",
    prompt: (topic) => `Define the key metrics I should track for ${topic.phrase} and how to improve them week by week.`,
    iconKind: "validate",
    why: (topic) => `Suggested because clear metrics make progress on ${topic.phrase} visible and actionable.`,
  },
  {
    label: "Map Next Milestones",
    prompt: (topic) => `Map the next 3 milestones for ${topic.phrase} with deliverables and acceptance criteria.`,
    iconKind: "implement",
    why: (topic) => `Suggested because milestone mapping turns ${topic.phrase} into executable steps.`,
  },
  {
    label: "Avoid Common Mistakes",
    prompt: (topic) => `Review common mistakes people make with ${topic.phrase} and help me avoid them in my next mission.`,
    iconKind: "reduce-risk",
    why: (topic) => `Suggested because learning from common mistakes prevents repeated setbacks on ${topic.phrase}.`,
  },
  {
    label: "Benchmark Good Results",
    prompt: (topic) => `Benchmark what good results look like for ${topic.phrase} and show me how to close the gap.`,
    iconKind: "validate",
    why: (topic) => `Suggested because benchmarking clarifies what success should look like for ${topic.phrase}.`,
  },
  {
    label: "Prioritize Next Tasks",
    prompt: (topic) => `Prioritize the most important tasks for ${topic.phrase} and explain why they should come first.`,
    iconKind: "optimize",
    why: (topic) => `Suggested because prioritizing tasks focuses effort where it matters most for ${topic.phrase}.`,
  },
  {
    label: "Tighten Mission Brief",
    prompt: (topic) => `Turn my goal around ${topic.phrase} into a tighter mission brief with a clearer outcome and constraints.`,
    iconKind: "expand",
    why: (topic) => `Suggested because a sharper brief improves every follow-up mission on ${topic.phrase}.`,
  },
];

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

function isExcluded(text: string, excludeTexts: string[]) {
  const normalized = sanitizeUserFacingText(text).trim().toLowerCase();
  return excludeTexts.some((existing) => {
    const prior = sanitizeUserFacingText(existing).trim().toLowerCase();
    if (!prior) return false;
    if (prior === normalized) return true;
    return jaccardSimilarity(prior, normalized) >= 0.62;
  });
}

export function buildGuaranteedHistoryReplacement(
  entry: MissionHistoryEntry,
  excludePrompts: string[] = [],
) {
  const topic = extractMissionTopic(entry.missionBrief);
  const offset = excludePrompts.length;

  for (let pass = 0; pass < REPLACEMENT_ANGLES.length; pass += 1) {
    const angle = REPLACEMENT_ANGLES[(offset + pass) % REPLACEMENT_ANGLES.length];
    const label = angle.label.slice(0, 72);
    const prompt = sanitizeUserFacingText(angle.prompt(topic)).slice(0, 520);
    if (!isExcluded(prompt, excludePrompts) && !isExcluded(label, excludePrompts)) {
      return { label, prompt };
    }
  }

  const serial = excludePrompts.length + 1;
  return {
    label: `Fresh Follow-Up ${serial}`.slice(0, 72),
    prompt: sanitizeUserFacingText(
      `Give me a fresh adjacent mission idea #${serial} for ${topic.phrase} with a clear deliverable and a practical outcome I can execute next.`,
    ).slice(0, 520),
  };
}

export function buildGuaranteedCouncilReplacement(
  entry: MissionHistoryEntry,
  exclude: { labels: string[]; briefs: string[] },
) {
  const topic = extractMissionTopic(entry.missionBrief);
  const excludeTexts = [...exclude.labels, ...exclude.briefs];
  const offset = excludeTexts.length;

  for (let pass = 0; pass < REPLACEMENT_ANGLES.length; pass += 1) {
    const angle = REPLACEMENT_ANGLES[(offset + pass) % REPLACEMENT_ANGLES.length];
    const label = angle.label.slice(0, 56);
    const visibleBrief = humanBriefForTopic(angle.prompt(topic), topic, entry.missionBrief).slice(0, 280);
    if (!isExcluded(visibleBrief, excludeTexts) && !isExcluded(label, excludeTexts)) {
      return {
        label,
        visibleBrief,
        why: angle.why(topic),
        iconKind: angle.iconKind,
      };
    }
  }

  const serial = excludeTexts.length + 1;
  return {
    label: `Fresh Follow-Up ${serial}`.slice(0, 56),
    visibleBrief: humanBriefForTopic(
      `explore a new angle for ${topic.phrase} with a clear outcome`,
      topic,
      entry.missionBrief,
    ).slice(0, 280),
    why: `Suggested because this is another fresh follow-up related to ${topic.phrase}.`,
    iconKind: "expand" as CouncilSuggestionIconKind,
  };
}

export { REPLACEMENT_ANGLES };
