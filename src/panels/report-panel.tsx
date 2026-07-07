"use client";

import { Button } from "@/components/ui/button";
import { composeReportSections } from "@/features/mission-control/components/council/presentation-renderer";
import { toast } from "@/hooks/use-toast";
import { useMissionStore } from "@/store";
import { CheckCircle2, Copy, Download } from "lucide-react";
import { downloadText, reportToMarkdown } from "@/utils";

export function ReportPanel() {
  const report = useMissionStore((s) => s.context?.finalReport);

  if (!report) {
    return <p className="text-sm italic text-white/45">The final report will appear once all agents finish or the mission is synthesized.</p>;
  }

  const sections = composeReportSections(report);
  const markdown = reportToMarkdown(report);
  const isDirectAnswer = report.deliverableMode === "direct_answer";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(markdown);
            toast({
              title: "Copied to clipboard",
              description: isDirectAnswer ? "The answer is ready to paste." : "The final mission report markdown is ready to paste.",
            });
          }}
          className="gap-1 border-white/10 bg-white/[0.04] text-white/70 hover:border-cyan-200/30 hover:bg-cyan-300/10 hover:text-cyan-50"
        >
          <Copy className="h-3.5 w-3.5" />
          {isDirectAnswer ? "Copy Answer" : "Copy Report"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => downloadText("agent-society-report.md", markdown, "text/markdown")} className="gap-1 border-white/10 bg-white/[0.04] text-white/70">
          <Download className="h-3.5 w-3.5" />
          Export Markdown
        </Button>
      </div>
      <div className="min-h-[320px]">
        <div className="space-y-5">
          {sections.map((section) => (
            <section key={section.title} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-4">
              <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/60">
                <CheckCircle2 className="h-3.5 w-3.5 text-cyan-200/60" />
                <span className="text-cyan-100/45">{section.kicker}</span>
              </h4>
              <h3 className="mt-2 text-lg font-semibold text-white">
                {section.title}
              </h3>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/68">{section.body}</p>
              {section.bullets.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-sm text-white/58">
                  {section.bullets.map((bullet) => <li key={bullet} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-300" />{bullet}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
