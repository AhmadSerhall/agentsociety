"use client";

import ReactMarkdown from "react-markdown";
import { AGENT_DEFINITIONS } from "@/agents";
import { Badge } from "@/components/ui/badge";
import { useMissionStore } from "@/store";
import { formatRelativeTime, sanitizeMissionText } from "@/utils";
import { useShallow } from "zustand/react/shallow";

export function DialoguePanel() {
  const dialogue = useMissionStore(useShallow((s) => s.context?.dialogue ?? []));

  if (dialogue.length === 0) {
    return <p className="text-sm italic text-white/45">Agent dialogue will stream here during the mission.</p>;
  }

  return (
    <div className="min-h-[260px]">
      <div className="space-y-4">
        {dialogue.map((entry, index) => {
          const def = AGENT_DEFINITIONS.find((agent) => agent.id === entry.agentId);
          const color = def?.color ?? "#22d3ee";
          return (
            <article key={`${entry.agentId}-${entry.timestamp}-${index}`} className="flex min-w-0 gap-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-4">
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
                <div className="mt-3 max-w-none whitespace-pre-wrap break-words text-sm leading-relaxed text-white/68 [&_*]:max-w-full [&_*]:break-words [&_h1]:mb-3 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-white [&_h2]:mb-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-white [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:mb-3 [&_p]:last:mb-0 [&_strong]:font-semibold [&_strong]:text-white">
                  <ReactMarkdown>{sanitizeMissionText(entry.content)}</ReactMarkdown>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
