"use client";

import { Badge } from "@/components/ui/badge";
import { useMissionStore } from "@/store";
import { AlertTriangle, CheckCircle2, Scale } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

export function ConflictPanel() {
  const conflicts = useMissionStore(useShallow((s) => s.context?.conflicts ?? []));
  const decisions = useMissionStore((s) => s.context?.mediatorDecisions);

  if (conflicts.length === 0 && !decisions) {
    return <p className="text-sm italic text-white/45">Conflicts will appear after the Risk Critic reviews the mission.</p>;
  }

  return (
    <div className="space-y-4">
      {conflicts.map((conflict) => (
        <div key={conflict.id} className="rounded-2xl border border-amber-300/20 bg-amber-400/5 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-300/10">
              <AlertTriangle className="h-5 w-5 text-amber-200" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-semibold text-white">{conflict.title ?? "Mission conflict"}</h4>
                <Badge className="bg-amber-400/15 text-amber-200 hover:bg-amber-400/15">
                  {conflict.riskLevel ?? "moderate"} risk
                </Badge>
                {conflict.resolved && (
                  <Badge className="bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/15">
                    Resolved
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-sm leading-6 text-white/62">{conflict.disagreementSummary ?? conflict.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {conflict.agents.map((agent) => (
                  <span key={agent} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/62">
                    {agent}
                  </span>
                ))}
              </div>

              {conflict.resolved && (
                <div className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-400/5 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                    <CheckCircle2 className="h-4 w-4" />
                    Final resolved action
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/62">{conflict.finalAction ?? conflict.resolution}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {decisions && (
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
            <Scale className="h-4 w-4" />
            Mediator Decision
          </div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-white/64">{decisions}</p>
        </div>
      )}
    </div>
  );
}
