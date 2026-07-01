"use client";

import { Button } from "@/components/ui/button";
import { useMissionStore } from "@/store";
import { Copy, Download } from "lucide-react";
import { downloadText, reportToMarkdown } from "@/utils";

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
  const markdown = reportToMarkdown(report);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(markdown)} className="gap-1 border-white/10 bg-white/[0.04] text-white/70">
          <Copy className="h-3.5 w-3.5" />
          Copy Report
        </Button>
        <Button size="sm" variant="outline" onClick={() => downloadText("agent-society-report.md", markdown, "text/markdown")} className="gap-1 border-white/10 bg-white/[0.04] text-white/70">
          <Download className="h-3.5 w-3.5" />
          Export Markdown
        </Button>
      </div>
      <div className="min-h-[320px]">
        <div className="space-y-5">
          {sections.filter((section) => section.content).map((section) => (
            <section key={section.title} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/60">{section.title}</h4>
              <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/68">{section.content}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
