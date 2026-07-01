"use client";

import { AGENT_DEFINITIONS } from "@/agents";
import { Badge } from "@/components/ui/badge";
import { useMissionStore } from "@/store";
import { formatDuration } from "@/utils";

export function TimelinePanel() {
  const timeline = useMissionStore((s) => s.context?.timeline ?? []);

  if (timeline.length === 0) {
    return <p className="text-sm italic text-white/45">Timeline entries appear as the mission unfolds.</p>;
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute bottom-3 left-[13px] top-3 w-px bg-cyan-200/15" />
      {timeline.map((entry, index) => {
        const def = AGENT_DEFINITIONS.find((agent) => agent.role === entry.agent);
        return (
          <div key={`${entry.timestamp}-${index}`} className="flex items-start gap-3 pb-5">
            <div
              className="relative z-10 mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[0.65rem] font-bold text-white"
              style={{ borderColor: def?.color ?? "#22d3ee", backgroundColor: `${def?.color ?? "#22d3ee"}33` }}
            >
              {index + 1}
            </div>
            <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/15 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-white">{entry.label}</span>
                <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-[0.65rem] capitalize text-white/55">
                  {entry.kind ?? "agent"}
                </Badge>
                {entry.duration != null && (
                  <span className="text-xs text-white/35">{formatDuration(entry.duration)}</span>
                )}
              </div>
              {entry.description && (
                <p className="mt-2 text-sm leading-6 text-white/58">{entry.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
