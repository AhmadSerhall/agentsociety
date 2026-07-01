"use client";

import ReactMarkdown from "react-markdown";
import { AGENT_DEFINITIONS } from "@/agents";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMissionStore } from "@/store";
import { formatRelativeTime } from "@/utils";
import { useShallow } from "zustand/react/shallow";

export function DialoguePanel() {
  const dialogue = useMissionStore(useShallow((s) => s.context?.dialogue ?? []));

  if (dialogue.length === 0) {
    return <p className="text-sm italic text-white/45">Agent dialogue will stream here during the mission.</p>;
  }

  return (
    <ScrollArea className="min-h-[260px] max-h-[70vh] pr-3">
      <div className="space-y-4">
        {dialogue.map((entry, index) => {
          const def = AGENT_DEFINITIONS.find((agent) => agent.id === entry.agentId);
          const color = def?.color ?? "#22d3ee";
          return (
            <article key={`${entry.agentId}-${entry.timestamp}-${index}`} className="flex min-w-0 gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold text-white shadow-[0_0_24px_rgba(255,255,255,0.08)]"
                style={{ backgroundColor: color }}
              >
                {entry.agentName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color }}>{entry.agentName}</span>
                  <span className="text-xs text-white/38">{formatRelativeTime(entry.timestamp)}</span>
                  <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-[0.65rem] text-white/60">
                    Complete
                  </Badge>
                  {entry.isConflict && (
                    <Badge className="bg-amber-400/15 text-amber-200 hover:bg-amber-400/15">Conflict</Badge>
                  )}
                </div>
                <div className="prose prose-invert prose-sm mt-3 max-w-none whitespace-pre-wrap break-words leading-relaxed prose-headings:text-white prose-p:text-white/68 prose-li:text-white/68 prose-strong:text-white">
                  <ReactMarkdown>{entry.content}</ReactMarkdown>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </ScrollArea>
  );
}
