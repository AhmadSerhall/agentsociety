const PLACEHOLDER_PATTERNS = [
  /\[insert\s+[^\]]+\]/gi,
  /\bundefined\b/gi,
  /\bnull\b/gi,
  /Generated workstream derived from the mission brief and selected configuration\./gi,
];

export function sanitizeMissionText(value: unknown): string {
  if (typeof value !== "string") return "";

  return PLACEHOLDER_PATTERNS.reduce((text, pattern) => text.replace(pattern, ""), value)
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line
      .replace(/^\s*[-*]\s*(\*\*)?\s*$/g, "")
      .replace(/^\s*#{1,6}\s*/g, "")
      .replace(/^\s*\*\*\s*/g, "")
      .replace(/\s*\*\*\s*$/g, "")
      .replace(/\*\*/g, "")
      .replace(/^\s*[-*]\s+/g, "- ")
      .trimEnd())
    .filter((line) => {
      const cleaned = line.trim();
      return cleaned.length > 0 && cleaned !== "-" && cleaned !== "*" && cleaned !== "**";
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeMissionList(items: unknown[]): string[] {
  return items
    .map((item) => sanitizeMissionText(item))
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
