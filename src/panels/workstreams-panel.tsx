"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AGENT_DEFINITIONS } from "@/agents";
import { useMissionStore } from "@/store";
import { CheckCircle2, CircleDashed, Loader2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

export function WorkstreamsPanel() {
  const workstreams = useMissionStore(useShallow((s) => s.context?.workstreams ?? []));

  if (workstreams.length === 0) {
    return <p className="text-sm italic text-white/45">Workstreams will appear once the Planner finishes.</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {workstreams.map((ws) => {
        const owner = AGENT_DEFINITIONS.find((agent) => agent.role === ws.assignedAgent);
        const confidence = ws.confidence ?? 78;
        const StatusIcon = ws.status === "completed" ? CheckCircle2 : ws.status === "in_progress" ? Loader2 : CircleDashed;
        return (
          <div key={ws.id} className="rounded-2xl border border-cyan-200/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-white">{ws.title}</h4>
                <p className="mt-1 text-xs text-cyan-100/55">{owner?.name ?? "Unassigned owner"}</p>
              </div>
              <Badge variant="outline" className="shrink-0 gap-1 border-white/10 bg-white/[0.04] text-xs capitalize text-white/70">
                <StatusIcon className={ws.status === "in_progress" ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
                {ws.status.replace("_", " ")}
              </Badge>
            </div>

            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/62">{ws.description}</p>

            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[0.68rem] text-white/45">
                <span>Confidence</span>
                <span>{confidence}%</span>
              </div>
              <Progress value={confidence} className="h-1.5 bg-white/10" />
            </div>

            {ws.deliverables.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {ws.deliverables.map((deliverable) => (
                  <li key={deliverable} className="flex gap-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-white/55">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-300" />
                    {deliverable}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
