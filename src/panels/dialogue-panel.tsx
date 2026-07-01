"use client";

import { AGENT_DEFINITIONS } from "@/agents";
import { useMissionStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/utils";

export function DialoguePanel() {
  const dialogue = useMissionStore(useShallow((s) => s.context?.dialogue ?? []));

  if (dialogue.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Agent dialogue will stream here during the mission.</p>;
  }

  return (
    <ScrollArea className="max-h-[400px] pr-2">
      <div className="space-y-3">
        {dialogue.map((entry, i) => {
          const def = AGENT_DEFINITIONS.find((a) => a.id === entry.agentId);
          const color = def?.color ?? "#888";
          return (
            <div key={i} className="flex gap-2.5">
              <div
                className="mt-1 h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {def?.name.slice(0, 2).toUpperCase() ?? "??"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color }}>{entry.agentName}</span>
                  <span className="text-[10px] text-muted-foreground">{formatRelativeTime(entry.timestamp)}</span>
                  {entry.isConflict && (
                    <span className="text-[10px] font-medium text-amber-500">CONFLICT</span>
                  )}
                </div>
                <div className={cn(
                  "mt-1 rounded-lg p-2.5 text-xs leading-relaxed whitespace-pre-wrap",
                  entry.isConflict ? "bg-amber-500/10 border border-amber-500/20" : "bg-card border"
                )}>
                  {entry.content.length > 600 ? entry.content.slice(0, 600) + "\n..." : entry.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}