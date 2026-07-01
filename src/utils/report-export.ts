import type { MissionHistoryEntry, MissionReport } from "@/types";

const REPORT_SECTIONS: Array<[string, keyof MissionReport]> = [
  ["Executive Summary", "executiveSummary"],
  ["Mission Objective", "missionObjective"],
  ["Selected Mission Configuration", "selectedMissionConfiguration"],
  ["Workstreams", "workstreams"],
  ["Role Assignments", "roleAssignments"],
  ["Agent Contributions", "agentContributions"],
  ["Key Disagreements", "keyDisagreements"],
  ["Mediator Decisions", "mediatorDecisions"],
  ["Execution Roadmap", "executionRoadmap"],
  ["Timeline", "timeline"],
  ["Budget / Resource Estimate", "budgetEstimate"],
  ["Risk Assessment", "riskAssessment"],
  ["Success Metrics", "successMetrics"],
  ["Single-Agent vs Multi-Agent Comparison", "singleAgentComparison"],
  ["Final Recommendations", "finalRecommendations"],
];

export function reportToMarkdown(report: MissionReport, title = "Agent Society Mission Report") {
  return [
    `# ${title}`,
    ...REPORT_SECTIONS
      .map(([heading, key]) => {
        const content = report[key];
        return content ? `## ${heading}\n\n${content}` : "";
      })
      .filter(Boolean),
  ].join("\n\n");
}

export function historyEntryToMarkdown(entry: MissionHistoryEntry) {
  if (!entry.finalReport) return `# ${entry.missionBrief}\n\nNo final report was generated.`;
  return reportToMarkdown(entry.finalReport, entry.missionBrief);
}

export function downloadText(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
