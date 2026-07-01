"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useMissionStore } from "@/store";

export function ReportPanel() {
  const report = useMissionStore((s) => s.context?.finalReport);

  if (!report) {
    return <p className="text-sm italic text-white/45">The final report will appear once all agents finish or the mission is synthesized.</p>;
  }

  const sections = [
    { title: "Executive Summary", content: report.executiveSummary },
    { title: "Mission Objective", content: report.missionObjective },
    { title: "Selected Mission Configuration", content: report.selectedMissionConfiguration },
    { title: "Workstreams", content: report.workstreams },
    { title: "Agent Contributions", content: report.agentContributions },
    { title: "Key Disagreements", content: report.keyDisagreements },
    { title: "Mediator Decisions", content: report.mediatorDecisions },
    { title: "Execution Roadmap", content: report.executionRoadmap },
    { title: "Timeline", content: report.timeline },
    { title: "Budget / Resource Estimate", content: report.budgetEstimate },
    { title: "Risk Assessment", content: report.riskAssessment },
    { title: "Success Metrics", content: report.successMetrics },
    { title: "Single-Agent vs Multi-Agent Comparison", content: report.singleAgentComparison },
    { title: "Final Recommendations", content: report.finalRecommendations },
  ];

  return (
    <ScrollArea className="max-h-[620px] pr-3">
      <div className="space-y-5">
        {sections.filter((section) => section.content).map((section) => (
          <section key={section.title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/60">{section.title}</h4>
            <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-white/68">{section.content}</div>
          </section>
        ))}
      </div>
    </ScrollArea>
  );
}
