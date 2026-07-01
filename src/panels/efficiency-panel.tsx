"use client";

import { useMissionStore } from "@/store";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";

export function EfficiencyPanel() {
  const metrics = useMissionStore((s) => s.context?.efficiencyMetrics);

  if (!metrics) {
    return <p className="text-sm text-muted-foreground italic">Efficiency comparison will appear after mission completion.</p>;
  }

  const data = [
    { name: "Quality Score", multi: metrics.qualityScore, single: metrics.singleAgentBaseline },
    { name: "Task Coverage", multi: metrics.taskCoverage, single: 60 },
    { name: "Confidence", multi: metrics.finalConfidenceScore, single: 50 },
    { name: "Perspectives", multi: metrics.perspectivesConsidered, single: 1 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Conflicts Resolved" value={String(metrics.conflictsResolved)} accent />
        <StatCard label="Revisions" value={String(metrics.revisionCount)} />
        <StatCard label="Est. Time" value={metrics.estimatedCompletionTime} />
        <StatCard label="Confidence" value={`${metrics.finalConfidenceScore}/100`} accent />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Multi-Agent vs Single-Agent
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#888" }} />
            <YAxis tick={{ fontSize: 10, fill: "#888" }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12, color: "#fff" }}
            />
            <Bar dataKey="single" fill="#374151" radius={[4, 4, 0, 0]} name="Single Agent" />
            <Bar dataKey="multi" radius={[4, 4, 0, 0]} name="Multi-Agent">
              {data.map((_, i) => (
                <Cell key={i} fill={["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b"][i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border p-2.5 text-center">
      <p className={`text-lg font-bold ${accent ? "text-emerald-400" : ""}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}