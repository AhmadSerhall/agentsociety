"use client";

import { useMissionStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function ConflictPanel() {
  const conflicts = useMissionStore(useShallow((s) => s.context?.conflicts ?? []));
  const decisions = useMissionStore((s) => s.context?.mediatorDecisions);

  if (conflicts.length === 0 && !decisions) {
    return <p className="text-sm text-muted-foreground italic">No conflicts detected yet.</p>;
  }

  return (
    <div className="space-y-3">
      {conflicts.map((c) => (
        <div key={c.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-amber-500">Conflict</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
              {c.resolved && (
                <div className="mt-2 flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <p className="text-xs text-emerald-600">{c.resolution}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      {decisions && (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
          <p className="text-xs font-medium text-cyan-500">Mediator&apos;s Full Decision</p>
          <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6">{decisions}</p>
        </div>
      )}
    </div>
  );
}