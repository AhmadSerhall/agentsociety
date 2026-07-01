"use client";

import { useMissionStore } from "@/store";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ReportPanel() {
  const report = useMissionStore((s) => s.context?.finalReport);

  if (!report) {
    return <p className="text-sm text-muted-foreground italic">The final report will appear once all agents finish.</p>;
  }

  const sections = [
    { title: "Executive Summary", content: report.executiveSummary },
    { title: "Mission Objective", content: report.missionObjective },
    { title: "Workstreams", content: report.workstreams },
    { title: "Execution Roadmap", content: report.executionRoadmap },
    { title: "Budget Estimate", content: report.budgetEstimate },
    { title: "Risk Assessment", content: report.riskAssessment },
    { title: "Success Metrics", content: report.successMetrics },
    { title: "Final Recommendations", content: report.finalRecommendations },
  ];

  return (
    <ScrollArea className="max-h-[500px] pr-2">
      <div className="space-y-4">
        {sections.filter((s) => s.content).map((s) => (
          <div key={s.title}>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.title}</h4>
            <div className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">{s.content}</div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}