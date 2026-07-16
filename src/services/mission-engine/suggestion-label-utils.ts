import { sanitizeUserFacingText } from "@/utils";

export interface MissionTopic {
  name: string;
  phrase: string;
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "give", "plan", "follow",
  "want", "need", "make", "create", "build", "design", "help", "into", "about", "have",
  "will", "should", "would", "could", "mission", "strategy", "budget", "days", "weeks",
  "spend", "willing", "learning", "study", "school", "comp", "competition", "can", "day",
  "hit", "stay", "relevant", "follow", "please", "just", "really", "very", "also",
]);

const GENERIC_LABEL_PATTERNS = [
  /^where we left off$/i,
  /^the best current options$/i,
  /^smart requirements/i,
  /^next council task$/i,
  /^continue last mission$/i,
  /^implement next step$/i,
  /^reduce key risk$/i,
  /^improve recent work$/i,
  /^analyze the latest tools/i,
  /^compare the top/i,
  /^identify the highest/i,
  /^review common mistakes/i,
  /^design a resource guide/i,
  /^turn this completed recommendation/i,
];

const DOMAIN_TOPICS: Array<{ test: RegExp; topic: MissionTopic }> = [
  {
    test: /league of legends|\blol\b|challenger|ranked climb|ranked/i,
    topic: { name: "LoL Challenger Climb", phrase: "reaching Challenger in League of Legends on a budget" },
  },
  {
    test: /software engineer|developer career|stay relevant|engineering career/i,
    topic: { name: "Software Career", phrase: "staying relevant as a software engineer" },
  },
  {
    test: /piano|competition repertoire|music competition/i,
    topic: { name: "Piano Competition", phrase: "learning piano for your school competition" },
  },
  {
    test: /smart city|citizen privacy|urban privacy/i,
    topic: { name: "Smart City Privacy", phrase: "designing a smart city with citizen privacy" },
  },
  {
    test: /startup|saas|go-to-market|mvp/i,
    topic: { name: "Startup Launch", phrase: "launching and growing your startup" },
  },
  {
    test: /erp|enterprise resource/i,
    topic: { name: "ERP Rollout", phrase: "planning and rolling out an ERP system" },
  },
  {
    test: /restaurant|hospitality/i,
    topic: { name: "Restaurant Tech", phrase: "using technology in restaurants" },
  },
];

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function cleanBrief(brief: string) {
  return sanitizeUserFacingText(brief).replace(/\s+/g, " ").trim();
}

function detectDomainTopic(brief: string): MissionTopic | null {
  for (const rule of DOMAIN_TOPICS) {
    if (rule.test.test(brief)) return rule.topic;
  }
  return null;
}

function extractGoalPhrase(brief: string): string | null {
  const patterns = [
    /\bto\s+([a-z][\w\s'-]{4,50}?)(?:\s+and\b|\s+with\b|\s+in\b|\s+on\b|\s+for\b|$)/i,
    /\b(?:help me|i want to|i need to|please)\s+([a-z][\w\s'-]{4,50}?)(?:\s+and\b|\s+with\b|\s+for\b|$)/i,
  ];
  for (const pattern of patterns) {
    const match = brief.match(pattern);
    if (match?.[1]) {
      const phrase = match[1].replace(/^(a|an|the)\s+/i, "").trim();
      if (phrase.length >= 6) return phrase;
    }
  }
  return null;
}

function readableWords(brief: string) {
  return cleanBrief(brief)
    .replace(/\$\S+/g, " ")
    .replace(/\b\d[\d,]*\s*(?:dollars?|usd|day|days|week|weeks|month|months)?\b/gi, " ")
    .replace(/^(give me|help me|i am|i'm|i want to|please|can you)\s+/i, "")
    .split(/\s+/)
    .map((word) => word.replace(/[^\w'-]/g, ""))
    .filter((word) => word.length > 2 && !STOPWORDS.has(word.toLowerCase()));
}

function buildNameFromPhrase(phrase: string) {
  const words = phrase
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word.toLowerCase()))
    .slice(0, 3);
  return titleCase(words.join(" "));
}

export function isReadableTopicName(name: string) {
  const normalized = sanitizeUserFacingText(name).trim();
  if (normalized.length < 4 || normalized.split(/\s+/).length > 4) return false;
  if (/\b(day can|hit challenger league|give day|plan hit|can software)\b/i.test(normalized)) return false;
  const words = normalized.split(/\s+/);
  if (words.filter((word) => word.length <= 3).length >= 2 && words.length >= 3) return false;
  return !GENERIC_LABEL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function extractMissionTopic(brief: string): MissionTopic {
  const cleaned = cleanBrief(brief);
  const domain = detectDomainTopic(cleaned);
  if (domain) return domain;

  const goalPhrase = extractGoalPhrase(cleaned);
  if (goalPhrase) {
    const name = buildNameFromPhrase(goalPhrase);
    if (isReadableTopicName(name)) {
      return { name, phrase: goalPhrase.toLowerCase() };
    }
  }

  const words = readableWords(cleaned);
  if (words.length >= 2) {
    const name = titleCase(words.slice(0, 3).join(" "));
    if (isReadableTopicName(name)) {
      return { name, phrase: words.slice(0, 6).join(" ").toLowerCase() };
    }
  }

  return {
    name: "This Mission",
    phrase: cleaned.slice(0, 100).toLowerCase(),
  };
}

export function isGenericSuggestionLabel(label: string) {
  const normalized = sanitizeUserFacingText(label).trim();
  if (normalized.length < 4) return true;
  if (!isReadableTopicName(normalized) && /^(reduce|validate|plan|research|improve|estimate|build|continue|review|compare)\b/i.test(normalized)) {
    return false;
  }
  return GENERIC_LABEL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isAwkwardSuggestionLabel(label: string) {
  const normalized = sanitizeUserFacingText(label).trim();
  if (!normalized) return true;
  if (/\b(day can|can software|hit challenger league|plan hit|give day|software risk|league risk)\b/i.test(normalized)) return true;
  if (/^(reduce|validate|plan|research|improve|estimate|build)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s+(Risk|Plan|Steps)$/i.test(normalized)) {
    const middle = normalized.replace(/^(Reduce|Validate|Plan|Research|Improve|Estimate|Build)\s+/i, "").replace(/\s+(Risk|Plan|Steps)$/i, "");
    if (!isReadableTopicName(middle)) return true;
  }
  return false;
}

export function polishSuggestionLabel(label: string, prompt: string, topic: MissionTopic) {
  const cleaned = sanitizeUserFacingText(label).trim();
  if (cleaned.length >= 4 && !isGenericSuggestionLabel(cleaned) && !isAwkwardSuggestionLabel(cleaned)) {
    return cleaned.slice(0, 72);
  }
  return labelFromMissionPrompt(prompt, topic).slice(0, 72);
}

export function labelFromMissionPrompt(prompt: string, topic: MissionTopic) {
  const cleaned = sanitizeUserFacingText(prompt).replace(/\s+/g, " ").trim();
  const firstSentence = cleaned.split(/[.!?]/)[0]?.trim() ?? cleaned;
  if (firstSentence.length <= 56 && !isGenericSuggestionLabel(firstSentence) && !isAwkwardSuggestionLabel(firstSentence)) {
    return firstSentence.slice(0, 56);
  }

  const words = firstSentence
    .replace(/^(help me|i need help with|create|build|design|implement|improve|validate|estimate|research|compare|reduce|continue|identify|prioritize)\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");

  const derived = titleCase(words);
  if (derived.length >= 4 && !isAwkwardSuggestionLabel(derived)) return derived.slice(0, 56);
  if (isReadableTopicName(topic.name)) return `${topic.name} Follow-Up`.slice(0, 56);
  return "Related Follow-Up Mission".slice(0, 56);
}

export function councilLabelForKind(
  iconKind: string,
  topic: MissionTopic,
  missionStatus?: "completed" | "cancelled",
): string {
  const named = isReadableTopicName(topic.name);
  const labels: Record<string, string> = {
    continue: missionStatus === "cancelled"
      ? (named ? `Continue ${topic.name}` : "Continue This Mission")
      : (named ? `Resume ${topic.name}` : "Resume This Mission"),
    implement: named ? `Plan ${topic.name} Steps` : "Plan Next Steps",
    optimize: named ? `Improve ${topic.name}` : "Sharpen The Strategy",
    validate: "Validate The Plan",
    "reduce-risk": "Review Key Risks",
    "estimate-cost": "Estimate Costs",
    expand: named ? `Expand ${topic.name}` : "Explore Next Angle",
    research: named ? `Research ${topic.name}` : "Research Best Options",
  };
  const label = labels[iconKind] ?? (named ? `Improve ${topic.name}` : "Improve The Plan");
  return isAwkwardSuggestionLabel(label) ? labelFromMissionPrompt(topic.phrase, topic) : label;
}

export function humanBriefForTopic(action: string, topic: MissionTopic, sourceBrief: string) {
  const cleaned = sanitizeUserFacingText(action).replace(/\s+/g, " ").trim();
  if (/^(i |help me|can you|please)/i.test(cleaned)) return cleaned.slice(0, 280);
  if (/^(design|build|create|improve|validate|estimate|research|compare|continue|implement|plan|study|identify|prioritize)/i.test(cleaned)) {
    return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)} for ${topic.phrase}.`.slice(0, 280);
  }
  return `Help me ${cleaned.toLowerCase()} related to ${sourceBrief.slice(0, 120)}.`.slice(0, 280);
}

export function standaloneActionLabel(action: string) {
  return action.slice(0, 56);
}
