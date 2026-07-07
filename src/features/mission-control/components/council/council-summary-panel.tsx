"use client";

import { CheckCircle2, GitMerge, ShieldCheck, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { StructuredContent } from "@/components/structured-content";
import { AgentRole, type MissionContext } from "@/types";
import { sanitizeUserFacingText } from "@/utils";
import { normalizeAgentOutputForDisplay } from "./agent-output-formatter";

export function CouncilSummaryPanel({ context }: { context: MissionContext }) {
  const report = context.finalReport;
  const confidence = context.efficiencyMetrics?.finalConfidenceScore ?? Math.round(context.executionTasks.reduce((sum, task) => sum + task.confidence, 0) / Math.max(1, context.executionTasks.length));
  const resolvedConflicts = context.conflicts.filter((conflict) => conflict.resolved || conflict.status === "resolved").length;
  const keyDecision = formatKeyDecision(context);
  const summary = sanitizeUserFacingText(report?.executiveSummary || "The agent society completed the workstreams, resolved required coordination points, and synthesized the final execution plan.");

  return (
    <section className="relative overflow-hidden rounded-[1.6rem] border border-emerald-300/20 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.15),transparent_38%),linear-gradient(135deg,rgba(3,7,18,0.9),rgba(15,23,42,0.72))] p-6 shadow-[0_26px_100px_rgba(16,185,129,0.12)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-emerald-300/35 bg-emerald-300/10 shadow-[0_0_40px_rgba(16,185,129,0.25)]">
        <CheckCircle2 className="h-8 w-8 text-emerald-200" />
      </div>
      <div className="mt-5 text-center">
        <Badge className="bg-emerald-300/15 text-emerald-100 hover:bg-emerald-300/15">Saved to history</Badge>
        <h3 className="mt-3 text-2xl font-bold text-white">{sanitizeUserFacingText(report?.missionObjective || "Council Synchronized")}</h3>
        <div className="mx-auto mt-4 max-w-3xl">
          <StructuredContent text={summary} />
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <SummaryMetric icon={<GitMerge className="h-4 w-4" />} label="Workstreams" value={String(context.executionTasks.length || context.workstreams.length)} />
        <SummaryMetric icon={<ShieldCheck className="h-4 w-4" />} label="Resolved conflicts" value={String(resolvedConflicts)} />
        <SummaryMetric icon={<Sparkles className="h-4 w-4" />} label="Confidence" value={`${confidence || 0}%`} />
      </div>
      <div className="mt-5 rounded-2xl border border-cyan-200/10 bg-cyan-300/[0.045] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">Key decision</p>
        <p className="mt-2 line-clamp-5 text-sm leading-relaxed text-white/62">{sanitizeUserFacingText(keyDecision)}</p>
      </div>
    </section>
  );
}

function formatKeyDecision(context: MissionContext) {
  const conflictDecision = context.conflicts.find((conflict) => conflict.finalAction || conflict.resolvedAction || conflict.mediatorDecision || conflict.resolution);
  const raw = conflictDecision?.finalAction ?? conflictDecision?.resolvedAction ?? conflictDecision?.mediatorDecision ?? conflictDecision?.resolution ?? context.mediatorDecisions;
  if (!raw) return "The mission completed without a pending mediator decision.";

  const normalized = normalizeAgentOutputForDisplay(raw, { agentRole: AgentRole.Mediator, maxLength: 220 });
  const usefulBullet = normalized.bullets.find((bullet) => /use|reduce|keep|reserve|choose|start|measure|validate|schedule|review/i.test(bullet));
  return sanitizeUserFacingText(usefulBullet ?? normalized.summary);
}

function SummaryMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
      <div className="mx-auto grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/20 text-cyan-100">{icon}</div>
      <p className="mt-2 text-[0.68rem] uppercase tracking-[0.16em] text-white/38">{label}</p>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
    </div>
  );
}
