"use client";

import { Activity, AlertTriangle, BrainCircuit, Gauge, GitBranch, Route, Settings2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  BUDGET_RANGE_LABELS,
  DEPTH_LABELS,
  MISSION_TYPE_LABELS,
  OUTPUT_FORMAT_LABELS,
  RISK_TOLERANCE_LABELS,
  TIME_HORIZON_LABELS,
  type MissionContext,
} from "@/types";
import { sanitizeUserFacingText } from "@/utils";
import { normalizeDialogueEntry } from "./agent-output-formatter";

export function MissionIntelligencePanel({ context }: { context: MissionContext }) {
  const activeConflict = context.conflicts.find((conflict) => conflict.status !== "resolved" && !conflict.resolved) ?? context.conflicts.at(-1);
  const latest = context.dialogue.at(-1);
  const classification = context.missionClassification;
  const isDirectAnswer = classification?.deliverableMode === "direct_answer";
  const currentDecision = summarizeCurrentDecision(context, latest ? normalizeDialogueEntry(latest).summary : "");
  const conflictBody = activeConflict
    ? activeConflict.resolved || activeConflict.status === "resolved"
      ? "No active conflict."
      : sanitizeUserFacingText(activeConflict.summary ?? activeConflict.description)
    : "No active conflict.";
  const keyDecision = isDirectAnswer
    ? "No mission decision was required."
    : activeConflict?.finalAction ?? activeConflict?.resolvedAction ?? activeConflict?.mediatorDecision ?? "Key decision will appear after the first meaningful tradeoff is resolved.";
  const mediatorNotes = activeConflict?.resolved
    ? sanitizeUserFacingText(activeConflict.finalAction ?? activeConflict.resolvedAction ?? context.mediatorDecisions)
    : sanitizeUserFacingText(isDirectAnswer ? "No mediation was required for this direct answer." : context.mediatorDecisions || "Mediator is standing by until a disagreement needs arbitration.");
  const blockedTasks = context.executionTasks.filter((task) => task.status === "blocked");
  const averageConfidence = Math.round(context.executionTasks.reduce((sum, task) => sum + (task.confidence ?? 0), 0) / Math.max(1, context.executionTasks.length));
  const metrics = context.efficiencyMetrics;
  const completedTasks = context.executionTasks.filter((task) => task.status === "completed").length;
  const durationMs = metrics?.executionDurationMs ?? (context.startedAt ? Math.max(0, new Date(context.completedAt ?? new Date()).getTime() - new Date(context.startedAt).getTime()) : 0);

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
        <InfoBlock icon={<Settings2 className="h-4 w-4" />} title="Mission Configuration">
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <InfoLine label="Type" value={MISSION_TYPE_LABELS[context.configuration.missionType]} />
            <InfoLine label="Depth" value={DEPTH_LABELS[context.configuration.depth]} />
            <InfoLine label="Format" value={OUTPUT_FORMAT_LABELS[context.configuration.outputFormat]} />
            <InfoLine label="Horizon" value={TIME_HORIZON_LABELS[context.configuration.timeHorizon]} />
            <InfoLine label="Budget" value={BUDGET_RANGE_LABELS[context.configuration.budgetRange]} />
            <InfoLine label="Risk" value={RISK_TOLERANCE_LABELS[context.configuration.riskTolerance]} />
          </dl>
        </InfoBlock>
        <InfoBlock icon={<Gauge className="h-4 w-4" />} title="Mission Metrics">
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <InfoLine label="Progress" value={`${Math.round((context.progress ?? 0) * 100)}%`} />
            <InfoLine label="Tasks" value={`${completedTasks}/${Math.max(1, context.executionTasks.length)}`} />
            <InfoLine label="Agents" value={String(new Set(context.dialogue.map((entry) => entry.agentRole)).size)} />
            <InfoLine label="Duration" value={formatDuration(durationMs)} />
            <InfoLine label="Confidence" value={`${metrics?.finalConfidenceScore ?? (averageConfidence || 0)}%`} />
            <InfoLine label="Strategy" value={classification?.selectedStrategy.replace(/_/g, " ") ?? "pending"} />
          </dl>
        </InfoBlock>
        {classification && (
          <div className="rounded-2xl border border-cyan-200/12 bg-cyan-300/[0.035] p-3 text-cyan-100">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.16em]">Developer Debug</p>
            </div>
            <dl className="mt-3 grid gap-2 text-xs text-white/62">
              <DebugLine label="Mission Type" value={classification.missionType.replace(/_/g, " ")} />
              <DebugLine label="Deliverable" value={classification.deliverableMode.replace(/_/g, " ")} />
              <DebugLine label="Complexity" value={`${classification.complexity}/10`} />
              <DebugLine label="Strategy" value={classification.selectedStrategy.replace(/_/g, " ")} />
              <DebugLine label="Selected Agents" value={classification.recommendedAgents.join(", ")} />
              <DebugLine label="Planning Enabled" value={classification.requiresPlanning ? "Yes" : "No"} />
              <DebugLine label="Planning Reason" value={classification.planningReason} />
              <DebugLine label="Confidence" value={`${classification.classificationConfidence}%`} />
            </dl>
          </div>
        )}
      </div>
    </aside>
  );
}

function summarizeCurrentDecision(context: MissionContext, latestSummary: string) {
  const reportText = context.finalReport?.finalAnswer || context.finalReport?.executiveSummary || "";
  const source = reportText || latestSummary || "Awaiting the next useful mission update.";
  const clean = sanitizeUserFacingText(source)
    .replace(/^[A-Z][A-Za-z\s-]+ answer for "[^"]+"\s*/i, "")
    .replace(/\s+(What to do:|Practical steps:|Key context:|Timing:|Watch-outs:)\s*/gi, " ")
    .replace(/\s+-\s+/g, "; ")
    .replace(/\s+\d+\.\s+/g, "; ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g)?.map((item) => item.trim()) ?? [];
  const summary = sentences.length ? sentences.slice(0, 2).join(" ") : clean.split(/[;\n]/).slice(0, 2).join("; ");
  return sanitizeUserFacingText(summary || clean || "Awaiting the next useful mission update.");
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function DebugLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-xl border border-white/8 bg-black/14 p-2">
      <dt className="text-[0.62rem] uppercase tracking-[0.12em] text-white/34">{label}</dt>
      <dd className="break-words text-white/70">{sanitizeUserFacingText(value)}</dd>
    </div>
  );
}

function InfoBlock({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-cyan-200/12 bg-cyan-300/[0.035] p-3 text-cyan-100">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">{title}</p>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/14 p-2">
      <dt className="text-[0.62rem] uppercase tracking-[0.12em] text-white/34">{label}</dt>
      <dd className="mt-1 break-words text-white/72">{sanitizeUserFacingText(value)}</dd>
    </div>
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
      <p className="mt-2 text-sm leading-relaxed text-white/62">{sanitizeUserFacingText(body)}</p>
    </div>
  );
}
