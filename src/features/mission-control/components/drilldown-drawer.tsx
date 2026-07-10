"use client";

import { useState } from "react";
import { Loader2, NotebookTabs, Play, Plus, Telescope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StructuredContent } from "@/components/structured-content";
import { createMockClient, createQwenClient, isMockMode } from "@/services/qwen";
import type { DrilldownSource, MissionConfiguration, MissionContext, QwenMessage } from "@/types";
import { sanitizeUserFacingText } from "@/utils";

interface DrilldownDrawerProps {
  source: DrilldownSource | null;
  parentContext: MissionContext | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLaunchSubMission: (prompt: string, config: Partial<MissionConfiguration>, source: DrilldownSource) => void;
  onAddBacklog: (source: DrilldownSource) => void;
}

export function DrilldownDrawer({ source, parentContext, open, onOpenChange, onLaunchSubMission, onAddBacklog }: DrilldownDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [expansion, setExpansion] = useState("");
  const [error, setError] = useState("");

  if (!source || !parentContext) return null;

  const prompt = buildSubMissionPrompt(parentContext, source);

  const quickExpand = async () => {
    setLoading(true);
    setError("");
    setExpansion("");
    try {
      const messages: QwenMessage[] = [
        {
          role: "system",
          content: "You are an Agent Society drilldown specialist. Execute exactly the selected action with concrete, decision-ready guidance. Do not repeat the parent mission or summarize unrelated report sections.",
        },
        {
          role: "user",
          content: `${prompt}\n\nReturn only the focused result for this selected action. Make the advice specific enough to act on immediately.`,
        },
      ];
      const result = isMockMode()
        ? await createMockClient().chat(messages)
        : await createQwenClient().chat(messages, { maxTokens: 1800, temperature: 0.35 });
      setExpansion(sanitizeUserFacingText(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drilldown expansion failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-l border-cyan-200/20 bg-[#06101d]/92 p-0 text-white shadow-[0_0_110px_rgba(34,211,238,0.22)] backdrop-blur-2xl sm:max-w-2xl">
        <SheetHeader className="sticky top-0 z-10 border-b border-cyan-200/10 bg-[#06101d]/95 p-5 backdrop-blur-2xl">
          <SheetTitle className="flex items-center gap-3 text-white">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10">
              <Telescope className="h-5 w-5 text-cyan-100" />
            </span>
            Drilldown Mission
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 p-5">
          <div className="rounded-2xl border border-purple-200/15 bg-purple-400/[0.055] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-purple-100/55">Sub-Mission of</p>
            <p className="mt-2 text-sm font-semibold text-white">{parentContext.missionBrief}</p>
          </div>

          <div className="rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.045] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/55">Selected Card</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/72">{source.sourceText}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/44">
              <span>Type: {source.sourceType.replace(/_/g, " ")}</span>
              {source.sourceAgentId && <span>Agent: {source.sourceAgentId.replace(/-/g, " ")}</span>}
              {source.sourceWorkstreamId && <span>Workstream: {source.sourceWorkstreamId}</span>}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/38">Suggested Sub-Mission Prompt</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/68">{prompt}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={quickExpand} disabled={loading} className="gap-2 rounded-full bg-cyan-300 text-[#06101f] hover:bg-cyan-200">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Telescope className="h-4 w-4" />}
              Quick Expand
            </Button>
            <Button onClick={() => onLaunchSubMission(prompt, parentContext.configuration, source)} className="gap-2 rounded-full bg-purple-400 text-white hover:bg-purple-300">
              <Play className="h-4 w-4" />
              Launch Sub-Mission
            </Button>
            <Button variant="outline" onClick={() => onAddBacklog(source)} className="gap-2 rounded-full border-white/10 bg-white/[0.04] text-white/72">
              <Plus className="h-4 w-4" />
              Add to Mission Backlog
            </Button>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>
          )}

          {expansion && (
            <div className="rounded-2xl border border-cyan-200/15 bg-black/24 p-4">
              <div className="mb-3 flex items-center gap-2">
                <NotebookTabs className="h-4 w-4 text-cyan-100" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/65">Focused Expansion</p>
              </div>
              <StructuredContent text={expansion} />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function buildSubMissionPrompt(parentContext: MissionContext, source: DrilldownSource) {
  const parentTitle = sanitizeUserFacingText(parentContext.missionBrief);
  const card = sanitizeUserFacingText(source.sourceText);
  const workstream = source.sourceWorkstreamId
    ? parentContext.workstreams.find((item) => item.id === source.sourceWorkstreamId)
    : undefined;
  const constraints = [
    parentContext.configuration.timeHorizon !== "none" ? `timeline: ${parentContext.configuration.timeHorizon.replace(/-/g, " ")}` : "",
    parentContext.configuration.budgetRange !== "none" ? `budget: ${parentContext.configuration.budgetRange}` : "",
    `output: ${parentContext.configuration.outputFormat.replace(/-/g, " ")}`,
  ].filter(Boolean).join(", ");
  return [
    `Selected action: ${card}`,
    "",
    `Parent objective for constraints only: ${parentTitle}`,
    `Mission constraints: ${constraints}`,
    workstream ? `Related workstream: ${sanitizeUserFacingText(workstream.title)} — ${sanitizeUserFacingText(workstream.description)}` : "",
    "",
    "Deliver a focused sub-mission result for the selected action only:",
    "1. The immediate decision or recommendation.",
    "2. Three to five concrete execution steps.",
    "3. Relevant tools, frameworks, or implementation details.",
    "4. A cost or timing guardrail when it matters.",
    "5. One clear success check.",
    "Do not restate the parent mission or repeat the selected action.",
  ].filter(Boolean).join("\n");
}
