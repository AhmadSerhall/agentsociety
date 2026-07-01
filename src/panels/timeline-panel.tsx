"use client";

import { useMissionStore } from "@/store";
import { formatDuration } from "@/utils";
import { AGENT_DEFINITIONS } from "@/agents";

export function TimelinePanel() {
  const timeline = useMissionStore((s) => s.context?.timeline ?? []);

  if (timeline.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Timeline entries appear as agents complete their work.</p>;
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
      {timeline.map((entry, i) => {
        const def = AGENT_DEFINITIONS.find((a) => a.role === entry.agent);
        const isLast = i === timeline.length - 1;
        return (
          <div key={i} className="flex items-start gap-3 pb-4">
            <div className="relative z-10 mt-0.5 h-[22px] w-[22px] shrink-0 rounded-full border-2 flex items-center justify-center text-[8px] font-bold text-white" style={{ borderColor: def?.color, backgroundColor: def?.color + "33" }}>
              {i + 1}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{entry.label}</span>
                {entry.duration != null && (
                  <span className="text-[10px] text-muted-foreground">{formatDuration(entry.duration)}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}