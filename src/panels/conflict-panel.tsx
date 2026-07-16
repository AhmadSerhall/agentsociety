"use client";

import { Badge } from "@/components/ui/badge";
import { renderConflict, renderStructuredText } from "@/features/mission-control/components/council/presentation-renderer";
import { useMissionStore } from "@/store";
import { AlertTriangle, CheckCircle2, Scale } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

export function ConflictPanel() {
  const conflicts = useMissionStore(useShallow((s) => s.context?.conflicts ?? []));
  const decisions = useMissionStore((s) => s.context?.mediatorDecisions);
  const status = useMissionStore((s) => s.context?.status);

  if (conflicts.length === 0 && !decisions) {
    const completed = status === "completed";
    return (
      <div className="rounded-2xl border border-emerald-200/10 bg-emerald-300/[0.035] p-5">
        <p className="text-sm font-semibold text-white">{completed ? "Consensus formed without mediation" : "No decision conflict has surfaced yet"}</p>
        <p className="mt-2 text-sm leading-relaxed text-white/48">
          {completed
            ? "The specialists reached compatible recommendations naturally, so the Mediator had no genuine disagreement to resolve."
            : "This panel activates only when agents produce materially incompatible assumptions or recommendations—not for routine differences in wording."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {conflicts.map((conflict) => (
        <div key={conflict.id} className="rounded-2xl border border-amber-300/20 bg-amber-400/5 p-4">
          {(() => {
            const rendered = renderConflict(conflict);
            return (
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-300/10">
              <AlertTriangle className="h-5 w-5 text-amber-200" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-semibold text-white">{rendered.title}</h4>
                <Badge className="bg-amber-400/15 text-amber-200 hover:bg-amber-400/15">
                  {rendered.risk} risk
                </Badge>
                {conflict.resolved && (
                  <Badge className="bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/15">
                    Resolved
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-sm leading-6 text-white/62">{rendered.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {rendered.participants.map((agent) => (
                  <span key={agent} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/62">
                    {agent}
                  </span>
                ))}
              </div>
              {rendered.arguments.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-white/54">
                  {rendered.arguments.map((argument) => <li key={argument}>- {argument}</li>)}
                </ul>
              )}

              {rendered.decision && (
                <div className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-400/5 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                    <CheckCircle2 className="h-4 w-4" />
                    {rendered.status === "Resolved" ? "Final resolved action" : "Mediator direction"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/62">{rendered.decision}</p>
                </div>
              )}
            </div>
          </div>
            );
          })()}
        </div>
      ))}

      {decisions && (
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
            <Scale className="h-4 w-4" />
            Mediator Decision
          </div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-white/64">{renderStructuredText(decisions, { fallbackSummary: "Mediator decision captured." }).summary}</p>
        </div>
      )}
    </div>
  );
}
