const PLACEHOLDER_PATTERNS = [
  /\[insert\s+[^\]]+\]/gi,
  /\[[^\]]*(date|mission id|agent id|workstream id|placeholder)[^\]]*\]/gi,
  /\bundefined\b/gi,
  /\bnull\b/gi,
  /Generated workstream derived from the mission brief and selected configuration\./gi,
  /\bMission Context\s*:?.*?(?=\n|$)/gi,
  /\b(ws|agent|task|group)-[a-z0-9-]+\b/gi,
];

export function sanitizeMissionText(value: unknown): string {
  if (typeof value !== "string") return "";

  const cleaned = PLACEHOLDER_PATTERNS.reduce((text, pattern) => text.replace(pattern, ""), value)
    .replace(/\r/g, "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .replace(/^-{3,}\s*$/gm, "")
    .split("\n")
    .map((line) => line
      .replace(/^\s*[-*]\s*(\*\*)?\s*$/g, "")
      .replace(/^\s*#{1,6}\s*/g, "")
      .replace(/^\s*\*\*\s*/g, "")
      .replace(/\s*\*\*\s*$/g, "")
      .replace(/\*\*/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^\s*[-*]\s+/g, "- ")
      .trimEnd())
    .filter((line) => {
      const cleaned = line.trim();
      return cleaned.length > 0 && cleaned !== "-" && cleaned !== "*" && cleaned !== "**";
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return dedupeAgentOutputSections(cleaned);
}

export function sanitizeUserFacingText(value: unknown): string {
  return sanitizeMissionText(value);
}

export function dedupeAgentOutputSections(value: unknown): string {
  if (typeof value !== "string") return "";
  const seen = new Set<string>();
  const sections = value
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean)
    .filter((section) => {
      const key = section.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return sections.join("\n\n").trim();
}

export function sanitizeMissionList(items: unknown[]): string[] {
  return items
    .map((item) => sanitizeUserFacingText(item))
    .map((item) => item.replace(/^-\s*/, "").trim())
    .filter((item, index, list) => item.length > 0 && item !== "**" && list.indexOf(item) === index);
}

export function extractActionItemsFromText(text: string, maxItems = 4): string[] {
  const sanitized = sanitizeMissionText(text);
  const bulletItems = sanitized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim());

  const sentences = sanitized
    .replace(/^#+\s.*$/gm, "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 28);

  return sanitizeMissionList([...bulletItems, ...sentences]).slice(0, maxItems);
}
