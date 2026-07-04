"use client";

import { AGENT_DEFINITIONS } from "@/agents";
import { Badge } from "@/components/ui/badge";
import { normalizeDialogueEntry } from "@/features/mission-control/components/council/agent-output-formatter";
import { AgentIconGlyph } from "@/features/mission-control/components/agent-icons";
import { useMissionStore } from "@/store";
import { AgentRole } from "@/types";
import { formatRelativeTime } from "@/utils";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

export function DialoguePanel() {
  const dialogue = useMissionStore(useShallow((s) => s.context?.dialogue ?? []));
  const displayDialogue = useMemo(() => {
    const seen = new Set<string>();
    const lastFinalizerIndex = dialogue.findLastIndex((entry) => entry.agentRole === AgentRole.Finalizer);
    return dialogue.filter((entry, index) => {
      const output = normalizeDialogueEntry(entry);
      if (entry.agentRole === AgentRole.Finalizer && index !== lastFinalizerIndex) return false;
      const key = `${entry.agentRole}:${output.summary.toLowerCase()}:${output.bullets.join("|").toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [dialogue]);

  if (displayDialogue.length === 0) {
    return <p className="text-sm italic text-white/45">Agent dialogue will stream here during the mission.</p>;
  }

  return (
    <div className="min-h-[260px]">
      <div className="space-y-4">
        {displayDialogue.map((entry, index) => {
          const def = AGENT_DEFINITIONS.find((agent) => agent.id === entry.agentId || agent.role === entry.agentRole);
          const color = def?.color ?? "#22d3ee";
          const output = normalizeDialogueEntry(entry);
          return (
            <article key={`${entry.agentId}-${entry.timestamp}-${index}`} className="flex min-w-0 gap-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-4">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold text-white shadow-[0_0_24px_rgba(255,255,255,0.08)]"
                style={{ backgroundColor: color }}
              >
                <AgentIconGlyph agentId={def?.id} className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color }}>{entry.agentName}</span>
                  <span className="text-xs text-white/38">{formatRelativeTime(entry.timestamp)}</span>
                  {output.type !== "answer" && (
                    <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-[0.65rem] text-white/60">
                      {output.type}
                    </Badge>
                  )}
                  {entry.isConflict && (
                    <Badge className="bg-amber-400/15 text-amber-200 hover:bg-amber-400/15">Conflict</Badge>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/68">{output.summary}</p>
                {output.bullets.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-white/56">
                    {output.bullets.map((bullet) => <li key={bullet}>- {bullet}</li>)}
                  </ul>
                )}
                {output.workstreams.length > 0 && (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {output.workstreams.map((stream) => (
                      <div key={stream.title} className="rounded-xl border border-cyan-200/10 bg-cyan-300/[0.045] p-3">
                        <p className="text-sm font-medium text-white">{stream.title}</p>
                        {stream.description && <p className="mt-1 text-xs leading-relaxed text-white/50">{stream.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
