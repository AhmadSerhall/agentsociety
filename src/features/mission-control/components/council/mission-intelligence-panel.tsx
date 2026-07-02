"use client";

import { Activity, AlertTriangle, BrainCircuit, GitBranch, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { MissionContext } from "@/types";
import { sanitizeUserFacingText } from "@/utils";
import { normalizeDialogueEntry } from "./agent-output-formatter";

export function MissionIntelligencePanel({ context }: { context: MissionContext }) {
  const activeConflict = context.conflicts.find((conflict) => conflict.status !== "resolved" && !conflict.resolved) ?? context.conflicts.at(-1);
  const latest = context.dialogue.at(-1);
  const currentDecision = latest ? normalizeDialogueEntry(latest).summary : "Awaiting the Planner to create useful workstreams.";
  const conflictBody = activeConflict
    ? activeConflict.resolved || activeConflict.status === "resolved"
      ? "No active conflict."
      : sanitizeUserFacingText(activeConflict.summary ?? activeConflict.description)
    : "No active conflict.";
  const keyDecision = activeConflict?.finalAction ?? activeConflict?.resolvedAction ?? activeConflict?.mediatorDecision ?? "Key decision will appear after the first meaningful tradeoff is resolved.";
  const mediatorNotes = activeConflict?.resolved
    ? sanitizeUserFacingText(activeConflict.finalAction ?? activeConflict.resolvedAction ?? context.mediatorDecisions)
    : sanitizeUserFacingText(context.mediatorDecisions || "Mediator is standing by until a disagreement needs arbitration.");
  const blockedTasks = context.executionTasks.filter((task) => task.status === "blocked");
  const averageConfidence = Math.round(context.executionTasks.reduce((sum, task) => sum + (task.confidence ?? 0), 0) / Math.max(1, context.executionTasks.length));

  return (
    <aside data-mission-intelligence className="rounded-[1.35rem] border border-purple-200/10 bg-black/24 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Mission Intelligence</h3>
        <Badge className="bg-purple-300/10 text-purple-100 hover:bg-purple-300/10">{averageConfidence || 0}% confidence</Badge>
      </div>
      <div className="mt-4 space-y-3">
        <IntelCard icon={<BrainCircuit className="h-4 w-4" />} title="Current Decision" body={currentDecision} tone="cyan" />
        <IntelCard icon={<AlertTriangle className="h-4 w-4" />} title="Active Conflict" body={conflictBody} tone={activeConflict && !activeConflict.resolved ? "amber" : "emerald"} />
        <IntelCard
          icon={<Activity className="h-4 w-4" />}
          title="Key Decision"
          body={keyDecision}
          tone="purple"
        />
        <IntelCard
          icon={<GitBranch className="h-4 w-4" />}
          title="Blocked Tasks"
          body={blockedTasks.length ? blockedTasks.map((task) => task.title).join("; ") : "No blocked workstreams."}
          tone="cyan"
        />
        <IntelCard
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Mediator Notes"
          body={mediatorNotes}
          tone="emerald"
        />
      </div>
    </aside>
  );
}

function IntelCard({ icon, title, body, tone }: { icon: ReactNode; title: string; body: string; tone: "cyan" | "purple" | "amber" | "emerald" }) {
  const colors = {
    cyan: "border-cyan-200/12 bg-cyan-300/[0.045] text-cyan-100",
    purple: "border-purple-200/12 bg-purple-300/[0.045] text-purple-100",
    amber: "border-amber-200/18 bg-amber-300/[0.06] text-amber-100",
    emerald: "border-emerald-200/14 bg-emerald-300/[0.045] text-emerald-100",
  };
  return (
    <div className={`rounded-2xl border p-3 ${colors[tone]}`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">{title}</p>
      </div>
      <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-white/62">{sanitizeUserFacingText(body)}</p>
    </div>
  );
}
