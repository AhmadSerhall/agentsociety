"use client";

import { Progress } from "@/components/ui/progress";
import { useMissionStore } from "@/store";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

export function EfficiencyPanel() {
  const metrics = useMissionStore((s) => s.context?.efficiencyMetrics);

  if (!metrics) {
    return <p className="text-sm italic text-white/45">Efficiency comparison will appear after mission completion.</p>;
  }

  const data = [
    { name: "Quality", multi: metrics.qualityScore, single: metrics.singleAgentBaseline },
    { name: "Coverage", multi: metrics.taskCoverage, single: 60 },
    { name: "Confidence", multi: metrics.finalConfidenceScore, single: 52 },
    { name: "Perspectives", multi: metrics.perspectivesConsidered * 10, single: 10 },
  ];

  return (
    <div className="space-y-5">
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
