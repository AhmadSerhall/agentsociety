"use client";

import { Progress } from "@/components/ui/progress";
import { AGENT_DEFINITIONS } from "@/agents";
import { useMissionStore } from "@/store";
import { AgentRole, type MissionContext } from "@/types";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

export function EfficiencyPanel() {
  const context = useMissionStore((s) => s.context);
  const metrics = context?.efficiencyMetrics;

  if (!metrics || !context) {
    return <p className="text-sm italic text-white/45">Efficiency comparison will appear after mission completion.</p>;
  }
  const analytics = buildMissionAnalytics(context);

  const data = [
    { name: "Quality", multi: metrics.qualityScore, single: metrics.singleAgentBaseline },
    { name: "Coverage", multi: metrics.taskCoverage, single: 60 },
    { name: "Confidence", multi: metrics.finalConfidenceScore, single: 52 },
    { name: "Perspectives", multi: metrics.perspectivesConsidered * 10, single: 10 },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-cyan-200/10 bg-cyan-300/[0.045] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-white">Mission Analytics</p>
            <p className="mt-1 text-xs text-white/45">Execution telemetry from agent events, workstreams, conflicts, and replay records.</p>
          </div>
          <span className="rounded-full border border-cyan-200/15 bg-black/25 px-3 py-1 text-xs text-cyan-100">{analytics.eventCount} events tracked</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Execution Duration" value={formatDuration(analytics.executionDurationMs)} progress={durationProgress(analytics.executionDurationMs)} />
          <Metric label="Tokens Consumed" value={analytics.tokensConsumed.toLocaleString()} progress={Math.min(100, analytics.tokensConsumed / 30)} />
          <Metric label="Average Latency" value={formatDuration(analytics.averageLatencyMs)} progress={durationProgress(analytics.averageLatencyMs)} />
          <Metric label="Retries" value={String(analytics.retryCount)} progress={Math.min(100, analytics.retryCount * 24)} />
          <Metric label="Failures" value={String(analytics.failureCount)} progress={analytics.failureCount ? Math.min(100, analytics.failureCount * 35) : 4} />
          <Metric label="Parallelism" value={`${analytics.parallelismPercent}%`} progress={analytics.parallelismPercent} />
          <Metric label="Consensus" value={`${analytics.consensusPercent}%`} progress={analytics.consensusPercent} />
          <Metric label="Agent Utilization" value={`${analytics.agentUtilizationPercent}%`} progress={analytics.agentUtilizationPercent} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-sm font-semibold text-white">Agent Utilization</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {analytics.agentUtilization.map((agent) => (
            <div key={agent.role} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{agent.name}</p>
                  <p className="text-xs text-white/40">{agent.workstreams} workstreams - {agent.events} events</p>
                </div>
                <span className="text-sm font-semibold" style={{ color: agent.color }}>{agent.percent}%</span>
              </div>
              <Progress value={agent.percent} className="mt-3 h-1.5 bg-white/10" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label="Task Coverage" value={`${metrics.taskCoverage}%`} progress={metrics.taskCoverage} />
        <Metric label="Perspectives Considered" value={String(metrics.perspectivesConsidered)} progress={100} />
        <Metric label="Conflict Resolution" value={`${metrics.conflictsResolved} resolved`} progress={metrics.conflictsResolved > 0 ? 100 : 30} />
        <Metric label="Estimated Completion Time" value={metrics.estimatedCompletionTime} progress={75} />
        <Metric label="Confidence Score" value={`${metrics.finalConfidenceScore}%`} progress={metrics.finalConfidenceScore} />
        <Metric label="Revision Count" value={String(metrics.revisionCount)} progress={Math.min(100, metrics.revisionCount * 28)} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Single Agent vs Agent Society</p>
          <p className="text-xs text-white/45">{metrics.singleAgentBaseline}% baseline to {metrics.qualityScore}% society score</p>
        </div>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={data} barCategoryGap="22%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.48)" }} />
            <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.48)" }} domain={[0, 100]} />
            <Tooltip cursor={{ fill: "rgba(34,211,238,0.06)" }} content={<EfficiencyTooltip />} />
            <Bar dataKey="single" fill="#334155" radius={[6, 6, 0, 0]} name="Single Agent" />
            <Bar dataKey="multi" radius={[6, 6, 0, 0]} name="Agent Society">
              {data.map((_, index) => (
                <Cell key={index} fill={["#22d3ee", "#8b5cf6", "#10b981", "#f59e0b"][index]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function buildMissionAnalytics(context: MissionContext) {
  const metrics = context.efficiencyMetrics;
  const replayDurationMs = Math.max(0, ...context.replayEvents.map((event) => event.relativeTimestamp));
  const storedDurationMs = metrics?.executionDurationMs ?? (
    context.startedAt ? Math.max(0, new Date(context.completedAt ?? Date.now()).getTime() - new Date(context.startedAt).getTime()) : 0
  );
  const executionDurationMs = storedDurationMs || replayDurationMs;
  const replayEvents = context.replayEvents ?? [];
  const tokenText = [
    context.dialogue.map((entry) => entry.content).join("\n"),
    context.researchSummary,
    context.productStrategy,
    context.technicalArchitecture,
    context.marketingStrategy,
    context.financialPlan,
    context.riskReview,
    context.mediatorDecisions,
  ].join("\n");
  const tokensConsumed = metrics?.tokensConsumed ?? Math.round(tokenText.length / 4);
  const averageLatencyMs = metrics?.averageLatencyMs ?? estimateAverageLatency(replayEvents);
  const retryCount = metrics?.retryCount ?? replayEvents.filter((event) => event.type === "PLANNER_REVISED_PLAN" || event.type === "TASK_REASSIGNED").length;
  const failureCount = metrics?.failureCount ?? context.executionTasks.filter((task) => task.status === "blocked" || task.status === "cancelled").length;
  const independentWorkstreams = context.executionTasks.filter((task) => task.dependencies.length === 0).length || context.workstreams.filter((workstream) => !workstream.dependencies?.length).length;
  const parallelismPercent = metrics?.parallelismPercent ?? Math.round((independentWorkstreams / Math.max(1, context.executionTasks.length || context.workstreams.length)) * 100);
  const consensusPercent = metrics?.consensusPercent ?? (context.conflicts.length ? Math.round((context.conflicts.filter((conflict) => conflict.resolved || conflict.status === "resolved").length / context.conflicts.length) * 100) : 100);
  const participatingAgents = new Set(context.dialogue.map((entry) => entry.agentRole));
  const requiredAgents = new Set([ ...context.executionTasks.map((task) => task.agent), ...context.workstreams.map((workstream) => workstream.assignedAgent).filter((role): role is AgentRole => Boolean(role)) ]);
  const agentUtilizationPercent = Math.min(100, metrics?.agentUtilizationPercent ?? Math.round((participatingAgents.size / Math.max(1, requiredAgents.size || participatingAgents.size)) * 100));
  const maxEvents = Math.max(1, ...AGENT_DEFINITIONS.map((agent) => replayEvents.filter((event) => event.agentRole === agent.role).length + context.dialogue.filter((entry) => entry.agentRole === agent.role).length));
  const agentUtilization = AGENT_DEFINITIONS.map((agent) => {
    const events = replayEvents.filter((event) => event.agentRole === agent.role).length + context.dialogue.filter((entry) => entry.agentRole === agent.role).length;
    const workstreams = context.workstreams.filter((workstream) => workstream.assignedAgent === agent.role).length || context.executionTasks.filter((task) => task.agent === agent.role).length;
    return {
      role: agent.role,
      name: agent.name,
      color: agent.color,
      events,
      workstreams,
      percent: Math.round((events / maxEvents) * 100),
    };
  }).filter((agent) => agent.events > 0 || agent.workstreams > 0);

  return {
    executionDurationMs,
    tokensConsumed,
    averageLatencyMs,
    retryCount,
    failureCount,
    parallelismPercent,
    consensusPercent,
    agentUtilizationPercent,
    agentUtilization,
    eventCount: replayEvents.length,
  };
}

function estimateAverageLatency(events: MissionContext["replayEvents"]) {
  const finished = events.filter((event) => /FINISHED$/.test(event.type) && event.agentRole);
  const started = events.filter((event) => /STARTED$/.test(event.type) && event.agentRole);
  const latencies = finished.map((finish) => {
    const start = [...started].reverse().find((event) => event.agentRole === finish.agentRole && event.relativeTimestamp <= finish.relativeTimestamp);
    return start ? finish.relativeTimestamp - start.relativeTimestamp : 0;
  }).filter((value) => value > 0);
  return latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0;
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

function durationProgress(ms: number) {
  return Math.max(4, Math.min(100, Math.round(ms / 900)));
}

function EfficiencyTooltip({ active, payload, label }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-cyan-200/20 bg-[#07111f]/95 px-4 py-3 text-xs text-white shadow-[0_20px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <p className="mb-2 font-semibold text-cyan-100">{label}</p>
      <div className="space-y-1.5">
        {payload.map((item) => (
          <div key={String(item.dataKey)} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-2 text-white/60">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-semibold text-white">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, progress }: { label: string; value: string; progress: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-white/38">{label}</p>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
      <Progress value={progress} className="mt-3 h-1.5 bg-white/10" />
    </div>
  );
}
