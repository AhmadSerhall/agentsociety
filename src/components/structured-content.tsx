"use client";

import { sanitizeMissionText } from "@/utils";
import type { DrilldownSource } from "@/types";
import { Telescope } from "lucide-react";

interface StructuredContentProps {
  text: string;
  className?: string;
  drilldownBase?: Omit<DrilldownSource, "id" | "sourceText" | "createdAt">;
  onDrilldown?: (source: DrilldownSource) => void;
}

type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "ordered"; items: string[] }
  | { type: "unordered"; items: string[] };

export function StructuredContent({ text, className = "", drilldownBase, onDrilldown }: StructuredContentProps) {
  const blocks = parseContentBlocks(text);
  if (blocks.length === 0) return null;

  return (
    <div className={`space-y-4 text-left ${className}`}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return <h4 key={`${block.type}-${index}`} className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/65">{block.text}</h4>;
        }
        if (block.type === "ordered") {
          return (
            <ol key={`${block.type}-${index}`} className="space-y-2">
              {block.items.map((item, itemIndex) => (
                <DrilldownListItem key={`${item}-${itemIndex}`} text={item} index={itemIndex} ordered drilldownBase={drilldownBase} onDrilldown={onDrilldown} />
              ))}
            </ol>
          );
        }
        if (block.type === "unordered") {
          return (
            <ul key={`${block.type}-${index}`} className="space-y-2">
              {block.items.map((item, itemIndex) => (
                <DrilldownListItem key={`${item}-${itemIndex}`} text={item} index={itemIndex} drilldownBase={drilldownBase} onDrilldown={onDrilldown} />
              ))}
            </ul>
          );
        }
        return <p key={`${block.type}-${index}`} className="text-sm leading-relaxed text-white/64">{block.text}</p>;
      })}
    </div>
  );
}

function DrilldownListItem({
  text,
  index,
  ordered,
  drilldownBase,
  onDrilldown,
}: {
  text: string;
  index: number;
  ordered?: boolean;
  drilldownBase?: Omit<DrilldownSource, "id" | "sourceText" | "createdAt">;
  onDrilldown?: (source: DrilldownSource) => void;
}) {
  const clickable = Boolean(drilldownBase && onDrilldown);
  const content = ordered ? (
    <>
      <span className="grid h-7 w-7 place-items-center rounded-full border border-cyan-200/20 bg-cyan-300/10 text-xs font-semibold text-cyan-100">{index + 1}</span>
      <span>{text}</span>
    </>
  ) : (
    <>
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.55)]" />
      <span>{text}</span>
    </>
  );
  const className = ordered
    ? "group grid grid-cols-[1.75rem_minmax(0,1fr)_auto] gap-3 rounded-xl border border-white/8 bg-white/[0.035] p-3 text-sm leading-relaxed text-white/68 transition hover:border-cyan-200/25 hover:bg-cyan-300/[0.07]"
    : "group flex gap-3 rounded-xl border border-white/8 bg-white/[0.028] p-3 text-sm leading-relaxed text-white/64 transition hover:border-cyan-200/25 hover:bg-cyan-300/[0.07]";

  const expand = clickable ? (
    <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan-200/15 bg-cyan-300/10 px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-cyan-100/70 opacity-0 transition group-hover:opacity-100">
      <Telescope className="h-3 w-3" />
      Expand
    </span>
  ) : null;

  return (
    <li
      className={`${className} ${clickable ? "cursor-pointer" : ""}`}
      onClick={() => {
        if (!drilldownBase || !onDrilldown) return;
        onDrilldown({
          ...drilldownBase,
          id: `${drilldownBase.parentMissionId}-${drilldownBase.sourceType}-${index}`,
          sourceText: text,
          createdAt: new Date().toISOString(),
        });
      }}
    >
      {content}
      {expand}
    </li>
  );
}

function parseContentBlocks(value: string): ContentBlock[] {
  const normalized = sanitizeMissionText(value)
    .replace(/^[A-Z][A-Za-z\s-]+ answer for "([^"]+)"\s*/i, "")
    .replace(/\s+(What to do:|Practical steps:|Key context:|Timing:|Watch-outs:)\s*/gi, "\n$1\n")
    .replace(/\s+-\s+(?=[A-Z0-9])/g, "\n- ")
    .replace(/\s+(\d+)\.\s+(?=[A-Z0-9])/g, "\n$1. ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return [];

  const blocks: ContentBlock[] = [];
  let unordered: string[] = [];
  let ordered: string[] = [];

  const flush = () => {
    if (ordered.length) {
      blocks.push({ type: "ordered", items: ordered });
      ordered = [];
    }
    if (unordered.length) {
      blocks.push({ type: "unordered", items: unordered });
      unordered = [];
    }
  };

  for (const rawLine of normalized.split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = line.match(/^(What to do|Practical steps|Key context|Timing|Watch-outs):$/i);
    if (heading) {
      flush();
      blocks.push({ type: "heading", text: heading[1] });
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      if (unordered.length) flush();
      ordered.push(orderedMatch[1].trim());
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      if (ordered.length) flush();
      unordered.push(unorderedMatch[1].trim());
      continue;
    }

    flush();
    blocks.push({ type: "paragraph", text: line });
  }

  flush();
  return blocks;
}
