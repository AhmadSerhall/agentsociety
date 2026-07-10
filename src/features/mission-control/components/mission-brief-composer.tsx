"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Loader2, Rocket, Settings2, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { getSavedSettingsOptions } from "@/lib/settingsPreferences";
import { useHistoryStore } from "@/store";
import {
  BUDGET_RANGE_LABELS,
  DEPTH_LABELS,
  MISSION_TYPE_LABELS,
  OUTPUT_FORMAT_LABELS,
  RISK_TOLERANCE_LABELS,
  TIME_HORIZON_LABELS,
  type MissionConfiguration,
} from "@/types";
import { MissionEngine } from "@/services/mission-engine";

type PromptSuggestion = {
  label: string;
  prompt: string;
  config: Partial<MissionConfiguration>;
};

type MatchedPromptSuggestion = PromptSuggestion & { match: RegExp };

const EMPTY_HISTORY: ReturnType<typeof useHistoryStore.getState>["entries"] = [];
type ConfigSuggestion = ReturnType<MissionEngine["suggestMissionConfiguration"]>;

const EXAMPLE_PROMPTS: PromptSuggestion[] = [
  {
    label: "Startup Launch",
    prompt: "Launch an AI SaaS startup for restaurants with an MVP, pricing, launch plan, and risk review.",
    config: {
      missionType: "startup-launch",
      outputFormat: "execution-roadmap",
      timeHorizon: "30-days",
    },
  },
  {
    label: "Software Architecture",
    prompt: "Design a scalable software architecture for a multi-tenant AI operations platform with an execution roadmap.",
    config: {
      missionType: "software-architecture",
      outputFormat: "technical-plan",
    },
  },
  {
    label: "Marketing Campaign",
    prompt: "Create a multi-channel marketing campaign for a premium AI productivity product with budget and timeline.",
    config: {
      missionType: "marketing-campaign",
      outputFormat: "strategy-brief",
    },
  },
  {
    label: "Research Plan",
    prompt: "Build a rigorous research plan for validating a new AI agent product, including assumptions and deliverables.",
    config: {
      missionType: "research-plan",
      outputFormat: "executive-report",
    },
  },
];

export function MissionBriefComposer({
  brief,
  config,
  isRunning,
  isComplete,
  mockMode,
  showConfig,
  configContent,
  onBriefChange,
  onExampleSelect,
  onConfigOpenChange,
  onLaunch,
  onCancel,
}: {
  brief: string;
  config: Partial<MissionConfiguration>;
  isRunning: boolean;
  isComplete: boolean;
  mockMode: boolean;
  showConfig: boolean;
  configContent: ReactNode;
  onBriefChange: (brief: string) => void;
  onExampleSelect: (brief: string, config: Partial<MissionConfiguration>) => void;
  onConfigOpenChange: (open: boolean) => void;
  onLaunch: () => void;
  onCancel: () => void;
}) {
  const historyEntries = useHistoryStore((state) => state.entries);
  const rememberPreviousContext = getSavedSettingsOptions().preferences.rememberContext;
  const sourceHistory = rememberPreviousContext ? historyEntries : [];
  const recommendedPrompts = useMemo(() => buildRecommendedPrompts(sourceHistory), [sourceHistory]);
  const hasHistoryRecommendations = sourceHistory.length > 0 && recommendedPrompts.length > 0;
  const configNeedsAttention = brief.trim().length > 0 && !showConfig && !isRunning;
  const [suggestion, setSuggestion] = useState<ConfigSuggestion | null>(null);
  const [dismissedText, setDismissedText] = useState("");
  const [appliedSuggestion, setAppliedSuggestion] = useState<ConfigSuggestion | null>(null);
  const trimmedBrief = brief.trim();
  const suggestionVisible = Boolean(suggestion && !showConfig && !isRunning && trimmedBrief.length >= 18 && trimmedBrief !== dismissedText);

  useEffect(() => {
    const text = trimmedBrief;
    if (isRunning || text.length < 18 || text === dismissedText) {
      return;
    }
    const timeout = window.setTimeout(() => {
      const engine = new MissionEngine();
      setSuggestion(engine.suggestMissionConfiguration(text, config));
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [trimmedBrief, config, dismissedText, isRunning]);

  const applySuggestion = () => {
    if (!suggestion) return;
    onExampleSelect(brief, suggestion.config);
    setDismissedText(trimmedBrief);
    setAppliedSuggestion(suggestion);
    setSuggestion(null);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 24, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.48, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[1.75rem] border border-cyan-200/15 bg-white/[0.055] p-4 shadow-[0_30px_100px_rgba(6,182,212,0.14)] backdrop-blur-2xl md:p-6"
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-10 h-52 w-52 rounded-full bg-cyan-400/15 blur-3xl" />

      <div className="relative">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
              <Sparkles className="h-3.5 w-3.5" />
              {hasHistoryRecommendations ? "Recommended" : "Presets"}
            </span>
            {recommendedPrompts.map((example) => (
              <motion.button
                key={example.label}
                type="button"
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onExampleSelect(example.prompt, example.config)}
                disabled={isRunning}
                className="rounded-full border border-white/10 bg-white/[0.055] px-3.5 py-2 text-xs font-medium text-white/68 transition hover:border-cyan-200/35 hover:bg-cyan-300/10 hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {example.label}
              </motion.button>
            ))}
            {mockMode && (
              <Badge variant="outline" className="border-amber-400/30 bg-amber-400/10 text-amber-200">
                Mock Mode
              </Badge>
            )}
          </div>

          <Sheet open={showConfig} onOpenChange={onConfigOpenChange}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`gap-2 rounded-full border-cyan-200/20 bg-white/[0.06] px-4 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.10)] hover:border-cyan-200/40 hover:bg-cyan-300/10 hover:text-white ${
                  configNeedsAttention ? "animate-pulse border-cyan-200/55 shadow-[0_0_28px_rgba(34,211,238,0.40),0_0_54px_rgba(168,85,247,0.24)]" : ""
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-200" />
                Mission Config
                <Settings2 className="h-3.5 w-3.5 text-purple-200" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full overflow-hidden border-l border-cyan-200/20 bg-[#06101d]/88 p-0 text-white shadow-[0_0_100px_rgba(34,211,238,0.25)] backdrop-blur-2xl sm:max-w-lg">
              <SheetHeader className="sticky top-0 z-10 border-b border-cyan-200/10 bg-[#06101d]/92 p-5 backdrop-blur-2xl">
                <SheetTitle className="flex items-center gap-3 text-white">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10">
                    <SlidersHorizontal className="h-5 w-5 text-cyan-100" />
                  </span>
                  Mission Configuration
                </SheetTitle>
              </SheetHeader>
              <div className="h-full overflow-y-auto px-5 pb-28 [scrollbar-color:rgba(34,211,238,0.35)_transparent]">
                {configContent}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <Textarea
          placeholder={
            '"Launch an AI SaaS startup for restaurants..."\n' +
            '"Plan a full MVP and go-to-market strategy for an AI support platform..."\n' +
            '"Create an execution roadmap for a modern ERP system..."'
          }
          value={brief}
          onChange={(event) => onBriefChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            if (event.shiftKey) return;
            event.preventDefault();
            if (!isRunning && brief.trim()) onLaunch();
          }}
          disabled={isRunning}
          rows={8}
          className="min-h-[220px] resize-none rounded-2xl border-cyan-200/15 bg-[#08111f]/78 p-5 text-base leading-7 text-white shadow-inner shadow-black/30 placeholder:text-white/30 focus-visible:border-cyan-200/40 focus-visible:ring-cyan-300/25 md:text-lg"
        />

        {suggestionVisible && suggestion && (
          <MissionConfigSuggestionOverlay
            suggestion={suggestion}
            onApply={applySuggestion}
            onEdit={() => onConfigOpenChange(true)}
            onDismiss={() => {
              setDismissedText(brief.trim());
              setSuggestion(null);
            }}
          />
        )}

        <MissionConfigAppliedDialog
          suggestion={appliedSuggestion}
          onOpenChange={(open) => {
            if (!open) setAppliedSuggestion(null);
          }}
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <ConfigChip label="Type" value={MISSION_TYPE_LABELS[config.missionType ?? "general-mission"]} />
          <ConfigChip label="Depth" value={DEPTH_LABELS[config.depth ?? "balanced"]} />
          <ConfigChip label="Horizon" value={TIME_HORIZON_LABELS[config.timeHorizon ?? "30-days"]} />
          <ConfigChip label="Format" value={OUTPUT_FORMAT_LABELS[config.outputFormat ?? "direct-result"]} />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/42">
            Describe the objective, constraints, timeline, and what a winning outcome looks like.
          </p>

          <div className="flex items-center gap-2">
            {isRunning && (
              <Button
                variant="outline"
                size="lg"
                onClick={onCancel}
                className="gap-2 rounded-full border-white/10 bg-white/[0.04] text-white/74 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            )}
            <motion.button
              type="button"
              whileHover={{ y: -2, scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              onClick={onLaunch}
              disabled={isRunning}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-purple-400 px-6 text-sm font-bold text-[#06101f] shadow-[0_0_32px_rgba(34,211,238,0.32),0_0_54px_rgba(168,85,247,0.18)] transition disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-44"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mission Running...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  {isComplete ? "Launch New Mission" : "Launch Mission"}
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function MissionConfigAppliedDialog({ suggestion, onOpenChange }: { suggestion: ConfigSuggestion | null; onOpenChange: (open: boolean) => void }) {
  const config = suggestion?.config;
  const chips = config ? [
    ["Type", MISSION_TYPE_LABELS[config.missionType]],
    ["Depth", DEPTH_LABELS[config.depth]],
    ["Horizon", TIME_HORIZON_LABELS[config.timeHorizon]],
    ["Budget", BUDGET_RANGE_LABELS[config.budgetRange]],
    ["Risk", RISK_TOLERANCE_LABELS[config.riskTolerance]],
    ["Format", OUTPUT_FORMAT_LABELS[config.outputFormat]],
  ] : [];

  return (
    <Dialog open={Boolean(suggestion)} onOpenChange={onOpenChange}>
      <DialogContent className="border-emerald-200/20 bg-[#071424]/96 text-white shadow-[0_28px_100px_rgba(16,185,129,0.18)] backdrop-blur-2xl sm:max-w-lg">
        <DialogHeader>
          <div className="mb-2 grid h-11 w-11 place-items-center rounded-2xl border border-emerald-200/25 bg-emerald-300/10">
            <Sparkles className="h-5 w-5 text-emerald-100" />
          </div>
          <DialogTitle className="text-xl text-white">Agents updated this mission configuration</DialogTitle>
          <DialogDescription className="text-white/58">The suggested settings are now applied to this brief. You can continue refining the mission or launch it when ready.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {chips.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
              <p className="text-[0.62rem] uppercase tracking-[0.14em] text-white/35">{label}</p>
              <p className="mt-1 text-sm font-semibold text-emerald-50">{value}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)} className="rounded-full bg-emerald-300 text-[#06101f] hover:bg-emerald-200">Continue</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MissionConfigSuggestionOverlay({
  suggestion,
  onApply,
  onEdit,
  onDismiss,
}: {
  suggestion: ConfigSuggestion;
  onApply: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}) {
  const config = suggestion.config;
  const chips = [
    ["Type", MISSION_TYPE_LABELS[config.missionType]],
    ["Depth", DEPTH_LABELS[config.depth]],
    ["Horizon", TIME_HORIZON_LABELS[config.timeHorizon]],
    ["Budget", BUDGET_RANGE_LABELS[config.budgetRange]],
    ["Risk", RISK_TOLERANCE_LABELS[config.riskTolerance]],
    ["Format", OUTPUT_FORMAT_LABELS[config.outputFormat]],
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="mt-4 rounded-2xl border border-cyan-200/20 bg-[#071424]/92 p-4 shadow-[0_24px_80px_rgba(34,211,238,0.16)] backdrop-blur-2xl"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles className="h-4 w-4 text-cyan-200" />
            Agents suggest this mission configuration
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/50">Why? {suggestion.why}.</p>
        </div>
        <button type="button" onClick={onDismiss} className="rounded-full border border-white/10 bg-white/[0.04] p-1.5 text-white/45 hover:text-white">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {chips.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-2">
            <p className="text-[0.62rem] uppercase tracking-[0.14em] text-white/35">{label}</p>
            <p className="mt-1 text-sm font-semibold text-cyan-50">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onDismiss} className="rounded-full border-white/10 bg-white/[0.04] text-white/62">Dismiss</Button>
        <Button type="button" size="sm" variant="outline" onClick={onEdit} className="rounded-full border-purple-200/20 bg-purple-400/10 text-purple-100">Edit Manually</Button>
        <Button type="button" size="sm" onClick={onApply} className="rounded-full bg-cyan-300 text-[#06101f] hover:bg-cyan-200">Apply Suggestion</Button>
      </div>
    </motion.div>
  );
}

function buildRecommendedPrompts(entries: ReturnType<typeof useHistoryStore.getState>["entries"]) {
  if (entries.length === 0) return EXAMPLE_PROMPTS;

  const templates: MatchedPromptSuggestion[] = [
    {
      label: "TOEFL Study Plan",
      match: /toefl|exam|study|learn|course|practice/i,
      prompt: "Create a focused 30-day study plan with diagnostic assessment, daily practice, mock tests, and risk review.",
      config: { missionType: "research-plan", outputFormat: "execution-roadmap", timeHorizon: "30-days" },
    },
    {
      label: "React Optimization",
      match: /react|slow|performance|debug|frontend|latency|bundle/i,
      prompt: "Analyze why my React app is slow and propose a prioritized optimization plan with measurements and risks.",
      config: { missionType: "software-architecture", outputFormat: "technical-plan", riskTolerance: "balanced" },
    },
    {
      label: "Startup Launch",
      match: /startup|launch|saas|school|restaurant|business|customer|sales/i,
      prompt: "Create a launch strategy for a focused AI SaaS startup with positioning, roadmap, budget, and risk review.",
      config: { missionType: "startup-launch", outputFormat: "execution-roadmap", timeHorizon: "90-days" },
    },
    {
      label: "Software Architecture",
      match: /architecture|software|system|platform|api|database|scalable/i,
      prompt: "Design a scalable software architecture with tradeoffs, dependencies, implementation phases, and risk controls.",
      config: { missionType: "software-architecture", outputFormat: "technical-plan" },
    },
    {
      label: "Research Analysis",
      match: /research|analyze|compare|market|validation|report/i,
      prompt: "Build a research analysis plan with key questions, evidence standards, synthesis, risks, and final recommendations.",
      config: { missionType: "research-plan", outputFormat: "executive-report" },
    },
    {
      label: "Business Plan",
      match: /pricing|budget|finance|revenue|business plan|cost/i,
      prompt: "Create a practical business plan with pricing, resource assumptions, execution roadmap, and risk controls.",
      config: { missionType: "business-plan", outputFormat: "strategy-brief" },
    },
  ];

  const historyText = entries.map((entry) => `${entry.missionBrief} ${entry.configuration.missionType}`).join("\n");
  const matched = templates.filter((template) => template.match.test(historyText));
  const recentMission = entries[0];
  const recentPrompt = recentMission ? [{
    label: "Build on Last Mission",
    prompt: `Create the next-step plan for: ${recentMission.missionBrief}`,
    config: recentMission.configuration,
  }] : [];

  const unique = [...recentPrompt, ...matched, ...EXAMPLE_PROMPTS].filter((item, index, list) => list.findIndex((candidate) => candidate.label === item.label) === index);
  return unique.slice(0, 4);
}

function ConfigChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-purple-300/15 bg-purple-400/10 px-3 py-1 text-[0.68rem] font-medium text-purple-100/85">
      <span className="text-white/40">{label}:</span> {value}
    </span>
  );
}
