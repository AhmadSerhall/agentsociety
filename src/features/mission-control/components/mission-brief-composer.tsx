"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BrainCircuit, FileOutput, Loader2, Network, Rocket, Settings2, ShieldAlert, SlidersHorizontal, Sparkles, UsersRound, X } from "lucide-react";
import { getAgentByRole } from "@/agents/definitions";
import { useTypewriterText } from "@/hooks/use-typewriter-text";
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
  getTimeHorizonLabel,
  type MissionConfiguration,
} from "@/types";
import { MissionEngine, generateHistoryMissionSuggestions, replaceHistoryMissionSuggestion, type HistoryMissionSuggestion } from "@/services/mission-engine";
import type { CouncilHiddenContext, CouncilSuggestionChip, MissionHistoryEntry } from "@/types";
import { CouncilRecommendationsSheet } from "./council-recommendations-sheet";
import { CouncilSuggestionsPanel } from "./council-suggestions-panel";

type ConfigSuggestion = ReturnType<MissionEngine["suggestMissionConfiguration"]>;
const MISSION_VALIDATOR = new MissionEngine();
const CONFIG_ENGINE = new MissionEngine();
const EMPTY_HISTORY: MissionHistoryEntry[] = [];
const ROTATING_EXAMPLES = [
  "Plan a focused product launch with a clear budget and timeline.",
  "Compare practical approaches to an important decision and recommend the strongest next step.",
  "Design a validation plan for a new idea, including evidence, risks, and a go or no-go decision.",
];
const LAUNCH_SEQUENCE = ["Mission accepted", "Dispatching Planner", "Initializing specialists", "Building Mission Graph", "Entering War Room"];

export function MissionBriefComposer({
  brief,
  config,
  isRunning,
  isValidating,
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
  isValidating: boolean;
  isComplete: boolean;
  mockMode: boolean;
  showConfig: boolean;
  configContent: ReactNode;
  onBriefChange: (brief: string) => void;
  onExampleSelect: (brief: string, config: Partial<MissionConfiguration>, hidden?: CouncilHiddenContext) => void;
  onConfigOpenChange: (open: boolean) => void;
  onLaunch: () => void;
  onCancel: () => void;
}) {
  const historyEntries = useHistoryStore((state) => state.entries);
  const rememberPreviousContext = getSavedSettingsOptions().preferences.rememberContext;
  const sourceHistory = rememberPreviousContext ? historyEntries : EMPTY_HISTORY;
  const hasMissionHistory = sourceHistory.length > 0;
  const configNeedsAttention = brief.trim().length > 0 && !showConfig && !isRunning && !isValidating;
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);
  const [historySuggestions, setHistorySuggestions] = useState<HistoryMissionSuggestion[]>([]);
  const [historySuggestionsLoading, setHistorySuggestionsLoading] = useState(false);
  const [historySuggestionsError, setHistorySuggestionsError] = useState("");
  const [typingSheetMission, setTypingSheetMission] = useState(false);
  const seenPromptsByHistoryRef = useRef<Record<string, string[]>>({});
  const [suggestion, setSuggestion] = useState<ConfigSuggestion | null>(null);
  const [dismissedText, setDismissedText] = useState("");
  const [appliedSuggestion, setAppliedSuggestion] = useState<ConfigSuggestion | null>(null);
  const [suggestionReviewed, setSuggestionReviewed] = useState(false);
  const [configReviewOpen, setConfigReviewOpen] = useState(false);
  const [launchAfterConfigApplied, setLaunchAfterConfigApplied] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [understandingPending, setUnderstandingPending] = useState(false);
  const [activityIndex, setActivityIndex] = useState(0);
  const [launchStage, setLaunchStage] = useState<number | null>(null);
  const launchTimersRef = useRef<number[]>([]);
  const trimmedBrief = brief.trim();
  const [understandingSnapshot, setUnderstandingSnapshot] = useState<{
    brief: string;
    result: ReturnType<MissionEngine["validateMissionBrief"]>;
  } | null>(null);
  const understanding = trimmedBrief.length > 0 && understandingSnapshot?.brief === trimmedBrief ? understandingSnapshot.result : null;
  const suggestionVisible = Boolean(suggestion && !showConfig && !isRunning && !isValidating && trimmedBrief.length >= 18 && trimmedBrief !== dismissedText);
  const councilIntake = useMemo(() => {
    if (!trimmedBrief) return null;
    const recommendation = CONFIG_ENGINE.suggestMissionConfiguration(trimmedBrief, config);
    const strategy = recommendation.classification;
    return {
      domain: MISSION_TYPE_LABELS[recommendation.config.missionType],
      objective: compactObjective(trimmedBrief),
      complexity: strategy.complexity,
      specialists: strategy.recommendedAgents.slice(0, 4).map((role) => getAgentByRole(role)?.name ?? role.replace(/-/g, " ")),
      deliverable: OUTPUT_FORMAT_LABELS[recommendation.config.outputFormat],
      workstreams: strategy.estimatedWorkstreams,
    };
  }, [config, trimmedBrief]);
  const activityMessages = councilIntake ? [
    `Planner is framing the ${councilIntake.deliverable.toLocaleLowerCase()}...`,
    `Research is identifying the ${councilIntake.domain.toLocaleLowerCase()} domain...`,
    `Architect is estimating ${councilIntake.workstreams} workstreams...`,
  ] : [];

  useEffect(() => {
    const text = trimmedBrief;
    let cancelled = false;
    if (!text) {
      const resetTimer = window.setTimeout(() => {
        setUnderstandingSnapshot(null);
        setUnderstandingPending(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    const pendingTimer = window.setTimeout(() => setUnderstandingPending(true), 0);
    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setUnderstandingSnapshot({ brief: text, result: MISSION_VALIDATOR.validateMissionBrief(text) });
        setUnderstandingPending(false);
      }
    }, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(pendingTimer);
      window.clearTimeout(timeout);
    };
  }, [trimmedBrief]);

  useEffect(() => {
    if (trimmedBrief) return;
    const interval = window.setInterval(() => setPlaceholderIndex((index) => (index + 1) % ROTATING_EXAMPLES.length), 4200);
    return () => window.clearInterval(interval);
  }, [trimmedBrief]);

  useEffect(() => {
    if (!activityMessages.length || isRunning || isValidating) return;
    const interval = window.setInterval(() => setActivityIndex((index) => (index + 1) % activityMessages.length), 1350);
    return () => window.clearInterval(interval);
  }, [activityMessages.length, isRunning, isValidating]);

  useEffect(() => () => {
    launchTimersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (!isRunning && !isValidating) return;
    const clearSequence = window.setTimeout(() => setLaunchStage(null), 0);
    return () => window.clearTimeout(clearSequence);
  }, [isRunning, isValidating]);

  useEffect(() => {
    const text = trimmedBrief;
    if (isRunning || isValidating || !understanding?.valid || text === dismissedText) {
      return;
    }
    const timeout = window.setTimeout(() => {
      const engine = new MissionEngine();
      setSuggestion(engine.suggestMissionConfiguration(text, config));
      setSuggestionReviewed(false);
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [trimmedBrief, config, dismissedText, isRunning, isValidating, understanding?.valid]);

  const applySuggestion = (options?: { launchAfterConfirm?: boolean }) => {
    if (!suggestion) return;
    onExampleSelect(brief, suggestion.config);
    setDismissedText(trimmedBrief);
    setAppliedSuggestion(suggestion);
    setSuggestionReviewed(true);
    setSuggestion(null);
    setConfigReviewOpen(false);
    if (options?.launchAfterConfirm) {
      setLaunchAfterConfigApplied(true);
    }
  };

  const dismissSuggestion = () => {
    setDismissedText(brief.trim());
    setSuggestionReviewed(true);
    setSuggestion(null);
    setConfigReviewOpen(false);
  };

  const editSuggestionManually = () => {
    if (suggestion) {
      onExampleSelect(brief, suggestion.config);
    }
    setSuggestionReviewed(true);
    setConfigReviewOpen(false);
    onConfigOpenChange(true);
  };

  const startLaunchSequence = () => {
    if (launchStage !== null || isRunning || isValidating || typingSheetMission) return;
    const localValidation = MISSION_VALIDATOR.validateMissionBrief(trimmedBrief);
    if (!localValidation.valid) {
      onLaunch();
      return;
    }
    setLaunchStage(0);
    launchTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    launchTimersRef.current = [
      360,
      720,
      1080,
      1440,
    ].map((delay, index) => window.setTimeout(() => setLaunchStage(index + 1), delay));
    launchTimersRef.current.push(window.setTimeout(() => onLaunch(), 1800));
  };

  const requestLaunch = () => {
    if (suggestionVisible && suggestion && !suggestionReviewed) {
      setLaunchAfterConfigApplied(true);
      setConfigReviewOpen(true);
      return;
    }
    startLaunchSequence();
  };

  const handleCouncilSuggestionSelect = (chip: CouncilSuggestionChip, visibleBrief: string) => {
    onBriefChange(visibleBrief);
    if (visibleBrief.trim() !== chip.visibleBrief.trim()) return;
    const suggestedConfig = CONFIG_ENGINE.suggestMissionConfiguration(chip.visibleBrief).config;
    onExampleSelect(chip.visibleBrief, suggestedConfig, chip.hidden);
  };

  const sheetTypewriter = useTypewriterText((value) => onBriefChange(value));

  const selectHistorySuggestion = (prompt: string) => {
    setRecommendationsOpen(false);
    setTypingSheetMission(true);
    sheetTypewriter(prompt, () => {
      const suggestedConfig = CONFIG_ENGINE.suggestMissionConfiguration(prompt).config;
      onExampleSelect(prompt, suggestedConfig);
      setTypingSheetMission(false);
    });
  };

  const openCouncilRecommendationsSheet = () => {
    if (!hasMissionHistory || isRunning || isValidating) return;
    setRecommendationsOpen(true);
    setHistorySuggestionsLoading(true);
    setHistorySuggestionsError("");
    seenPromptsByHistoryRef.current = {};
    void generateHistoryMissionSuggestions(sourceHistory)
      .then((result) => {
        setHistorySuggestions(result);
        for (const item of result) {
          const seen = seenPromptsByHistoryRef.current[item.historyId] ?? [];
          seenPromptsByHistoryRef.current[item.historyId] = [...seen, item.prompt];
        }
      })
      .catch((err) => setHistorySuggestionsError(err instanceof Error ? err.message : "Could not generate recommendations."))
      .finally(() => setHistorySuggestionsLoading(false));
  };

  const replaceHistorySuggestionItem = async (current: HistoryMissionSuggestion) => {
    const entry = sourceHistory.find((item) => item.id === current.historyId);
    if (!entry) return null;
    const seen = seenPromptsByHistoryRef.current[entry.id] ?? [];
    const excludePrompts = [...new Set([...seen, current.prompt])];
    const replacement = await replaceHistoryMissionSuggestion(entry, excludePrompts);
    seenPromptsByHistoryRef.current[entry.id] = [...excludePrompts, replacement.prompt];
    setHistorySuggestions((items) => items.map((item) => (item.id === current.id ? replacement : item)));
    return replacement;
  };

  const missionConfigControl = (
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
  );

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
        <CouncilSuggestionsPanel
          entries={sourceHistory}
          disabled={isRunning || isValidating || typingSheetMission}
          onSelect={handleCouncilSuggestionSelect}
          onOpenSheet={openCouncilRecommendationsSheet}
          trailing={
            <>
              {/* {mockMode && (
                <Badge variant="outline" className="mr-2 border-amber-400/30 bg-amber-400/10 text-amber-200">
                  Mock Mode
                </Badge>
              )} */}
              {missionConfigControl}
            </>
          }
        />

        <CouncilRecommendationsSheet
          open={recommendationsOpen}
          entries={sourceHistory}
          suggestions={historySuggestions}
          loading={historySuggestionsLoading}
          error={historySuggestionsError}
          onOpenChange={setRecommendationsOpen}
          onSelect={selectHistorySuggestion}
          onReplace={replaceHistorySuggestionItem}
        />

        <div className="relative">
          <Textarea
            aria-label="Mission objective"
            placeholder=""
            value={brief}
            onChange={(event) => onBriefChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              if (event.shiftKey) return;
              event.preventDefault();
              if (!isRunning && !isValidating && !typingSheetMission && brief.trim()) requestLaunch();
            }}
            disabled={isRunning || isValidating || typingSheetMission || launchStage !== null}
            rows={8}
            className="min-h-[220px] resize-none rounded-2xl border-cyan-200/15 bg-[#08111f]/78 p-5 text-base leading-7 text-white shadow-inner shadow-black/30 focus-visible:border-cyan-200/40 focus-visible:ring-cyan-300/25 md:text-lg"
          />
          <AnimatePresence mode="wait">
            {!brief && launchStage === null && (
              <motion.div
                key={placeholderIndex}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.34, ease: "easeOut" }}
                className="pointer-events-none absolute inset-x-5 top-5 max-w-2xl text-base leading-7 text-white/34 md:text-lg"
              >
                <span className="mb-2 block text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">Ask the council to</span>
                {ROTATING_EXAMPLES[placeholderIndex]}
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {launchStage !== null && (
              <LaunchSequence stage={launchStage} />
            )}
          </AnimatePresence>
        </div>

        {suggestionVisible && suggestion && (
          <MissionConfigSuggestionOverlay
            suggestion={suggestion}
            onApply={applySuggestion}
            onEdit={editSuggestionManually}
            onDismiss={dismissSuggestion}
          />
        )}

        <MissionConfigReviewDialog
          open={configReviewOpen}
          suggestion={suggestion}
          onOpenChange={setConfigReviewOpen}
          onApply={() => applySuggestion({ launchAfterConfirm: true })}
          onEdit={editSuggestionManually}
        />

        <MissionConfigAppliedDialog
          suggestion={appliedSuggestion}
          launchAfterConfirm={launchAfterConfigApplied}
          onLaunch={startLaunchSequence}
          onOpenChange={(open) => {
            if (!open) {
              setAppliedSuggestion(null);
              setLaunchAfterConfigApplied(false);
            }
          }}
        />

        {!suggestionVisible && (
          <div className="mt-4 flex flex-wrap gap-2">
            <ConfigChip label="Type" value={MISSION_TYPE_LABELS[config.missionType ?? "general-mission"]} />
            <ConfigChip label="Depth" value={DEPTH_LABELS[config.depth ?? "balanced"]} />
            <ConfigChip label="Horizon" value={getTimeHorizonLabel({ timeHorizon: config.timeHorizon ?? "none", customTimeHorizon: config.customTimeHorizon })} />
            <ConfigChip label="Format" value={OUTPUT_FORMAT_LABELS[config.outputFormat ?? "direct-result"]} />
          </div>
        )}

        {(understanding || understandingPending) && councilIntake && (
          <motion.div layout className={`mt-4 overflow-hidden rounded-2xl border p-3.5 ${understanding?.valid ? "border-cyan-200/15 bg-cyan-300/[0.055]" : "border-amber-200/20 bg-amber-300/[0.055]"}`}>
            <div className="flex flex-wrap items-center gap-3">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border text-sm font-bold tabular-nums ${understanding?.valid ? "border-cyan-200/30 bg-cyan-300/10 text-cyan-100" : "border-amber-200/30 bg-amber-300/10 text-amber-100"}`}>
                {understandingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `${understanding?.score ?? 0}%`}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/58">Council Understanding</p>
                  <span className={`text-xs capitalize ${understanding?.valid ? "text-cyan-100/75" : "text-amber-100/75"}`}>{understandingPending ? "reading" : understanding?.level}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    className={`h-full rounded-full ${understanding?.valid ? "bg-gradient-to-r from-cyan-300 to-emerald-300" : "bg-gradient-to-r from-amber-300 to-orange-300"}`}
                    animate={{ width: `${understanding?.score ?? 16}%` }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/52">{understandingPending ? "The council is reading intent, constraints, and the expected outcome locally." : understanding?.summary}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <ConsoleSignal icon={BrainCircuit} label="Detected domain" value={councilIntake.domain} />
              <ConsoleSignal icon={Network} label="Complexity" value={`${complexityLabel(councilIntake.complexity)} · ${councilIntake.complexity}/10`} />
              <ConsoleSignal icon={UsersRound} label="Specialists" value={councilIntake.specialists.join(", ")} />
              <ConsoleSignal icon={FileOutput} label="Deliverable" value={councilIntake.deliverable} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-white/52"><span className="font-semibold text-white/72">Objective:</span> {councilIntake.objective}</p>
            {!understandingPending && understanding?.gaps.length ? <p className="mt-2 text-xs leading-relaxed text-white/44">Refine when ready: {understanding.gaps[0]}</p> : null}
          </motion.div>
        )}

        {activityMessages.length > 0 && !isRunning && !isValidating && launchStage === null && (
          <div className="mt-3 flex items-center gap-2.5 overflow-hidden rounded-xl border border-white/8 bg-black/15 px-3 py-2 text-xs text-white/55">
            <span className="relative grid h-6 w-6 shrink-0 place-items-center rounded-full border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
              <span className="absolute inset-0 animate-ping rounded-full border border-cyan-200/20" />
              <Sparkles className="relative h-3.5 w-3.5" />
            </span>
            <AnimatePresence mode="wait">
              <motion.p key={activityMessages[activityIndex]} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.24 }} className="truncate">
                {activityMessages[activityIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/42">
          Brief the council on your objective, constraints, timeline, and ideal outcome.</p>

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
              onClick={requestLaunch}
              disabled={isRunning || isValidating || launchStage !== null}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-purple-400 px-6 text-sm font-bold text-[#06101f] shadow-[0_0_32px_rgba(34,211,238,0.32),0_0_54px_rgba(168,85,247,0.18)] transition disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-44"
            >
              {launchStage !== null ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {LAUNCH_SEQUENCE[launchStage]}
                </>
              ) : isRunning || isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isValidating ? "Understanding Mission..." : "Mission Running..."}
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

function MissionConfigReviewDialog({
  open,
  suggestion,
  onOpenChange,
  onApply,
  onEdit,
}: {
  open: boolean;
  suggestion: ConfigSuggestion | null;
  onOpenChange: (open: boolean) => void;
  onApply: () => void;
  onEdit: () => void;
}) {
  const config = suggestion?.config;
  const chips = config ? [
    ["Type", MISSION_TYPE_LABELS[config.missionType]],
    ["Depth", DEPTH_LABELS[config.depth]],
    ["Horizon", getTimeHorizonLabel(config)],
    ["Budget", BUDGET_RANGE_LABELS[config.budgetRange]],
    ["Risk", RISK_TOLERANCE_LABELS[config.riskTolerance]],
    ["Format", OUTPUT_FORMAT_LABELS[config.outputFormat]],
  ] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-cyan-200/20 bg-[radial-gradient(circle_at_80%_0%,rgba(34,211,238,0.14),transparent_42%),linear-gradient(145deg,rgba(7,17,31,0.98),rgba(15,23,42,0.96))] text-white shadow-[0_30px_120px_rgba(34,211,238,0.20)] backdrop-blur-2xl sm:max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10">
              <ShieldAlert className="h-5 w-5 text-cyan-100" />
            </div>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-cyan-100/60">Mission preflight</p>
              <DialogTitle className="mt-1 text-xl text-white">Review the suggested configuration</DialogTitle>
            </div>
          </div>
          <DialogDescription className="leading-relaxed text-white/58">
            The agents prepared a mission configuration for this brief. Validate the suggestion or edit it manually for better results before launch.
          </DialogDescription>
        </DialogHeader>
        {suggestion && (
          <div className="rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.045] p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="h-4 w-4 text-cyan-200" />
              Suggested configuration
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/48">Why? {suggestion.why}.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {chips.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                  <p className="text-[0.62rem] uppercase tracking-[0.14em] text-white/35">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-cyan-50">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-full border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
          >
            Not yet
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onEdit}
            className="gap-2 rounded-full border-purple-200/20 bg-purple-400/10 text-purple-100 hover:bg-purple-400/15 hover:text-purple-50"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Edit Manually
          </Button>
          <Button
            type="button"
            onClick={onApply}
            className="gap-2 rounded-full bg-cyan-300 text-[#06101f] hover:bg-cyan-200"
          >
            <Sparkles className="h-4 w-4" />
            Apply Suggestion
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MissionConfigAppliedDialog({
  suggestion,
  launchAfterConfirm,
  onLaunch,
  onOpenChange,
}: {
  suggestion: ConfigSuggestion | null;
  launchAfterConfirm?: boolean;
  onLaunch?: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const config = suggestion?.config;
  const chips = config ? [
    ["Type", MISSION_TYPE_LABELS[config.missionType]],
    ["Depth", DEPTH_LABELS[config.depth]],
    ["Horizon", getTimeHorizonLabel(config)],
    ["Budget", BUDGET_RANGE_LABELS[config.budgetRange]],
    ["Risk", RISK_TOLERANCE_LABELS[config.riskTolerance]],
    ["Format", OUTPUT_FORMAT_LABELS[config.outputFormat]],
  ] : [];

  const handleContinue = () => {
    onOpenChange(false);
    if (launchAfterConfirm) onLaunch?.();
  };

  return (
    <Dialog open={Boolean(suggestion)} onOpenChange={onOpenChange}>
      <DialogContent className="border-emerald-200/20 bg-[#071424]/96 text-white shadow-[0_28px_100px_rgba(16,185,129,0.18)] backdrop-blur-2xl sm:max-w-lg">
        <DialogHeader>
          <div className="mb-2 grid h-11 w-11 place-items-center rounded-2xl border border-emerald-200/25 bg-emerald-300/10">
            <Sparkles className="h-5 w-5 text-emerald-100" />
          </div>
          <DialogTitle className="text-xl text-white">Agents updated this mission configuration</DialogTitle>
          <DialogDescription className="text-white/58">
            {launchAfterConfirm
              ? "The suggested settings are applied. Continue to launch this mission immediately."
              : "The suggested settings are now applied to this brief. You can continue refining the mission or launch it when ready."}
          </DialogDescription>
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
          <Button onClick={handleContinue} className="gap-2 rounded-full bg-emerald-300 text-[#06101f] hover:bg-emerald-200">
            {launchAfterConfirm ? (
              <>
                <Rocket className="h-4 w-4" />
                Launch Mission
              </>
            ) : (
              "Continue"
            )}
          </Button>
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
    ["Horizon", getTimeHorizonLabel(config)],
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

function ConfigChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-purple-300/15 bg-purple-400/10 px-3 py-1 text-[0.68rem] font-medium text-purple-100/85">
      <span className="text-white/40">{label}:</span> {value}
    </span>
  );
}

function ConsoleSignal({ icon: Icon, label, value }: { icon: typeof BrainCircuit; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/8 bg-black/15 px-2.5 py-2">
      <p className="flex items-center gap-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.13em] text-white/38"><Icon className="h-3 w-3 text-cyan-200/75" />{label}</p>
      <p className="mt-1 truncate text-xs font-medium text-white/76" title={value}>{value}</p>
    </div>
  );
}

function LaunchSequence({ stage }: { stage: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.01 }}
      className="absolute inset-0 z-10 grid place-items-center overflow-hidden rounded-2xl border border-cyan-200/20 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.18),transparent_42%),rgba(4,12,24,0.94)] p-6 backdrop-blur-xl"
    >
      <div className="w-full max-w-md">
        {/* <div className="mb-5 flex items-center justify-center">
          <motion.span animate={{ scale: [1, 1.12, 1], rotate: [0, 8, 0] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }} className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-200/30 bg-cyan-300/10 shadow-[0_0_34px_rgba(34,211,238,0.22)]">
            <Rocket className="h-6 w-6 text-cyan-100" />
          </motion.span>
        </div> */}
        <p className="text-center text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-cyan-100/60">Council launch sequence</p>
        <AnimatePresence mode="wait">
          <motion.p key={LAUNCH_SEQUENCE[stage]} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-2 text-center text-xl font-semibold text-white">
            {LAUNCH_SEQUENCE[stage]}
          </motion.p>
        </AnimatePresence>
        <div className="mt-6 flex gap-2">
          {LAUNCH_SEQUENCE.map((label, index) => (
            <span key={label} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <motion.span animate={{ width: index <= stage ? "100%" : "0%" }} transition={{ duration: 0.32, ease: "easeOut" }} className="block h-full rounded-full bg-gradient-to-r from-cyan-300 to-purple-300" />
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function compactObjective(brief: string) {
  const normalized = brief.replace(/\s+/g, " ").trim();
  return normalized.length > 132 ? `${normalized.slice(0, 129).trimEnd()}…` : normalized;
}

function complexityLabel(complexity: number) {
  if (complexity >= 8) return "High";
  if (complexity >= 5) return "Focused";
  return "Light";
}
