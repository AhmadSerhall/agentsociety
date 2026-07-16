"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Loader2, RefreshCw, Rocket, Settings2, ShieldAlert, SlidersHorizontal, Sparkles, X } from "lucide-react";
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
import type { MissionHistoryEntry } from "@/types";

type ConfigSuggestion = ReturnType<MissionEngine["suggestMissionConfiguration"]>;
const MISSION_VALIDATOR = new MissionEngine();
const CONFIG_ENGINE = new MissionEngine();
const EMPTY_HISTORY: MissionHistoryEntry[] = [];

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
  onExampleSelect: (brief: string, config: Partial<MissionConfiguration>) => void;
  onConfigOpenChange: (open: boolean) => void;
  onLaunch: () => void;
  onCancel: () => void;
}) {
  const historyEntries = useHistoryStore((state) => state.entries);
  const rememberPreviousContext = getSavedSettingsOptions().preferences.rememberContext;
  const sourceHistory = rememberPreviousContext ? historyEntries : EMPTY_HISTORY;
  const hasMissionHistory = sourceHistory.length > 0;
  const quickPrompts = useMemo(() => buildRecommendedPrompts(sourceHistory), [sourceHistory]);
  const configNeedsAttention = brief.trim().length > 0 && !showConfig && !isRunning && !isValidating;
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);
  const [historySuggestions, setHistorySuggestions] = useState<HistoryMissionSuggestion[]>([]);
  const [historySuggestionsLoading, setHistorySuggestionsLoading] = useState(false);
  const [historySuggestionsError, setHistorySuggestionsError] = useState("");
  const [suggestion, setSuggestion] = useState<ConfigSuggestion | null>(null);
  const [dismissedText, setDismissedText] = useState("");
  const [appliedSuggestion, setAppliedSuggestion] = useState<ConfigSuggestion | null>(null);
  const [suggestionReviewed, setSuggestionReviewed] = useState(false);
  const [configReviewOpen, setConfigReviewOpen] = useState(false);
  const [launchAfterConfigApplied, setLaunchAfterConfigApplied] = useState(false);
  const trimmedBrief = brief.trim();
  const [understandingSnapshot, setUnderstandingSnapshot] = useState<{
    brief: string;
    result: ReturnType<MissionEngine["validateMissionBrief"]>;
  } | null>(null);
  const understanding = trimmedBrief.length > 0 && understandingSnapshot?.brief === trimmedBrief ? understandingSnapshot.result : null;
  const suggestionVisible = Boolean(suggestion && !showConfig && !isRunning && !isValidating && trimmedBrief.length >= 18 && trimmedBrief !== dismissedText);

  useEffect(() => {
    const text = trimmedBrief;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void (async () => {
        const localResult = MISSION_VALIDATOR.validateMissionBrief(text);
        const result = localResult.valid
          ? await MISSION_VALIDATOR.validateMissionBriefSemantically(text)
          : localResult;
        if (!cancelled) setUnderstandingSnapshot({ brief: text, result });
      })();
    }, 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [trimmedBrief]);

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

  const requestLaunch = () => {
    if (suggestionVisible && suggestion && !suggestionReviewed) {
      setLaunchAfterConfigApplied(true);
      setConfigReviewOpen(true);
      return;
    }
    onLaunch();
  };

  const selectHistorySuggestion = (prompt: string) => {
    const suggestedConfig = CONFIG_ENGINE.suggestMissionConfiguration(prompt).config;
    onExampleSelect(prompt, suggestedConfig);
    setRecommendationsOpen(false);
  };

  const openHistoryRecommendations = () => {
    if (!hasMissionHistory || isRunning || isValidating) return;
    setRecommendationsOpen(true);
    setHistorySuggestionsLoading(true);
    setHistorySuggestionsError("");
    void generateHistoryMissionSuggestions(sourceHistory)
      .then((result) => {
        setHistorySuggestions(result);
      })
      .catch((err) => {
        setHistorySuggestionsError(err instanceof Error ? err.message : "Could not generate recommendations.");
      })
      .finally(() => {
        setHistorySuggestionsLoading(false);
      });
  };

  const replaceHistorySuggestionItem = async (current: HistoryMissionSuggestion) => {
    const entry = sourceHistory.find((item) => item.id === current.historyId);
    if (!entry) return null;
    const excludePrompts = historySuggestions.filter((item) => item.historyId === entry.id).map((item) => item.prompt);
    const replacement = await replaceHistoryMissionSuggestion(entry, excludePrompts);
    if (replacement) {
      setHistorySuggestions((prev) => prev.map((item) => (item.id === current.id ? replacement : item)));
    }
    return replacement;
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
            <motion.button
              type="button"
              whileHover={hasMissionHistory ? { y: -2, scale: 1.02 } : undefined}
              whileTap={hasMissionHistory ? { scale: 0.98 } : undefined}
              onClick={openHistoryRecommendations}
              disabled={!hasMissionHistory || isRunning || isValidating}
              className="flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80 transition hover:border-cyan-200/40 hover:bg-cyan-300/15 hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Recommended for you
            </motion.button>
            {!hasMissionHistory && (
              <span className="text-xs text-white/38">Complete a mission to unlock AI recommendations.</span>
            )}
            {quickPrompts.map((example) => (
              <motion.button
                key={example.label}
                type="button"
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onExampleSelect(example.prompt, example.config)}
                disabled={isRunning || isValidating}
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

        <HistoryRecommendationsSheet
          open={recommendationsOpen}
          entries={sourceHistory}
          suggestions={historySuggestions}
          loading={historySuggestionsLoading}
          error={historySuggestionsError}
          onOpenChange={setRecommendationsOpen}
          onSelect={selectHistorySuggestion}
          onReplace={replaceHistorySuggestionItem}
        />

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
            if (!isRunning && !isValidating && brief.trim()) requestLaunch();
          }}
          disabled={isRunning || isValidating}
          rows={8}
          className="min-h-[220px] resize-none rounded-2xl border-cyan-200/15 bg-[#08111f]/78 p-5 text-base leading-7 text-white shadow-inner shadow-black/30 placeholder:text-white/30 focus-visible:border-cyan-200/40 focus-visible:ring-cyan-300/25 md:text-lg"
        />

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
          onLaunch={onLaunch}
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

        {understanding && (
          <div className={`mt-4 overflow-hidden rounded-2xl border p-3.5 ${understanding.valid ? "border-cyan-200/15 bg-cyan-300/[0.055]" : "border-amber-200/20 bg-amber-300/[0.055]"}`}>
            <div className="flex flex-wrap items-center gap-3">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border text-sm font-bold tabular-nums ${understanding.valid ? "border-cyan-200/30 bg-cyan-300/10 text-cyan-100" : "border-amber-200/30 bg-amber-300/10 text-amber-100"}`}>
                {understanding.score}%
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/58">Mission Understanding</p>
                  <span className={`text-xs capitalize ${understanding.valid ? "text-cyan-100/75" : "text-amber-100/75"}`}>{understanding.level}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    className={`h-full rounded-full ${understanding.valid ? "bg-gradient-to-r from-cyan-300 to-emerald-300" : "bg-gradient-to-r from-amber-300 to-orange-300"}`}
                    animate={{ width: `${understanding.score}%` }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/52">{understanding.summary}</p>
              </div>
            </div>
            {understanding.gaps.length > 0 && (
              <p className="mt-2 text-xs leading-relaxed text-white/44">Improve it: {understanding.gaps[0]}</p>
            )}
          </div>
        )}

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
              onClick={requestLaunch}
              disabled={isRunning || isValidating}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-purple-400 px-6 text-sm font-bold text-[#06101f] shadow-[0_0_32px_rgba(34,211,238,0.32),0_0_54px_rgba(168,85,247,0.18)] transition disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-44"
            >
              {isRunning || isValidating ? (
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

function HistoryRecommendationsSheet({
  open,
  entries,
  suggestions,
  loading,
  error,
  onOpenChange,
  onSelect,
  onReplace,
}: {
  open: boolean;
  entries: MissionHistoryEntry[];
  suggestions: HistoryMissionSuggestion[];
  loading: boolean;
  error: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (prompt: string) => void;
  onReplace: (current: HistoryMissionSuggestion) => Promise<HistoryMissionSuggestion | null>;
}) {
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [replaceError, setReplaceError] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, { entry: MissionHistoryEntry; items: HistoryMissionSuggestion[] }>();
    for (const entry of entries.slice(0, 5)) {
      map.set(entry.id, { entry, items: suggestions.filter((item) => item.historyId === entry.id) });
    }
    return Array.from(map.values());
  }, [entries, suggestions]);

  const replaceSuggestion = async (current: HistoryMissionSuggestion) => {
    setReplacingId(current.id);
    setReplaceError("");
    try {
      await onReplace(current);
    } catch (err) {
      setReplaceError(err instanceof Error ? err.message : "Could not replace this recommendation.");
    } finally {
      setReplacingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-hidden border-l border-cyan-200/20 bg-[#06101d]/92 p-0 text-white shadow-[0_0_110px_rgba(34,211,238,0.22)] backdrop-blur-2xl sm:max-w-2xl">
        <SheetHeader className="sticky top-0 z-10 border-b border-cyan-200/10 bg-[#06101d]/95 p-5 backdrop-blur-2xl">
          <SheetTitle className="flex items-center gap-3 text-white">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10">
              <Sparkles className="h-5 w-5 text-cyan-100" />
            </span>
            Recommended for you
          </SheetTitle>
          <p className="text-sm leading-relaxed text-white/55">
            AI-generated follow-up missions inspired by your mission history. Each suggestion stays on the same topic but explores a fresh angle.
          </p>
        </SheetHeader>

        <div className="h-full overflow-y-auto px-5 pb-10 [scrollbar-color:rgba(34,211,238,0.35)_transparent]">
          {loading && (
            <div className="flex items-center gap-3 rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.045] p-4 text-sm text-cyan-100/80">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating recommendations from your mission history...
            </div>
          )}

          {(error || replaceError) && (
            <div className="mb-4 rounded-2xl border border-amber-200/20 bg-amber-300/[0.06] p-4 text-sm text-amber-100/80">
              {error || replaceError}
            </div>
          )}

          {!loading && grouped.map(({ entry, items }) => (
            <div key={entry.id} className="mt-5 first:mt-0">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/38">Inspired by</p>
                <p className="mt-1 text-sm leading-relaxed text-white/72">{entry.missionBrief}</p>
              </div>

              <div className="mt-3 space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.045] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-cyan-50">{item.label}</p>
                        <p className="mt-2 text-xs leading-relaxed text-white/55">{item.prompt}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={replacingId === item.id}
                          onClick={() => void replaceSuggestion(item)}
                          className="gap-1.5 rounded-full border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                        >
                          {replacingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          Replace
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onSelect(item.prompt)}
                          className="rounded-full bg-cyan-300 text-[#06101f] hover:bg-cyan-200"
                        >
                          Use Mission
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {!loading && items.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">
                    No suggestions generated for this mission yet.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
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

function buildRecommendedPrompts(entries: MissionHistoryEntry[]) {
  const recent = entries.slice(0, 5);
  const latestCancelled = recent.find((entry) => !entry.finalReport);
  const latestCompleted = recent.find((entry) => Boolean(entry.finalReport));
  const candidates: Array<{ label: string; prompt: string; config: Partial<MissionConfiguration> } | null> = [];

  if (latestCancelled) {
    candidates.push({
      label: "Continue Cancelled Mission",
      prompt: compactPrompt(
        `Resume the cancelled mission "${latestCancelled.missionBrief}".${describeCancelledMissionState(latestCancelled)} Continue from the last reliable checkpoint, finish incomplete workstreams, and deliver the remaining outcome.`,
      ),
      config: latestCancelled.configuration,
    });
  }

  if (latestCompleted) {
    const recommendation = firstReportInsight(latestCompleted.finalReport?.finalRecommendations);
    const nextStep = firstReportInsight(latestCompleted.finalReport?.executionRoadmap);
    const risk = firstReportInsight(latestCompleted.finalReport?.riskAssessment);

    candidates.push({
      label: "Continue Last Mission",
      prompt: compactPrompt(
        `Continue the completed mission "${latestCompleted.missionBrief}" as its next executable phase.${recommendation ? ` Start from this recommendation: ${recommendation}` : " Identify the strongest unfinished outcome, then define concrete deliverables and acceptance criteria."}`,
      ),
      config: latestCompleted.configuration,
    });

    if (nextStep) {
      candidates.push({
        label: "Implement Next Step",
        prompt: compactPrompt(
          `Turn this next step from "${latestCompleted.missionBrief}" into an implementation mission with owners, dependencies, acceptance criteria, and a verification plan: ${nextStep}`,
        ),
        config: { ...latestCompleted.configuration, outputFormat: "execution-roadmap" },
      });
    }

    if (risk) {
      candidates.push({
        label: "Reduce Key Risk",
        prompt: compactPrompt(
          `Investigate and reduce the leading risk identified by "${latestCompleted.missionBrief}". Validate the underlying assumption, compare practical mitigations, and recommend the safest next decision: ${risk}`,
        ),
        config: { ...latestCompleted.configuration, riskTolerance: "conservative" as const },
      });
    }
  }

  const secondary = recent.find((entry) => entry.id !== latestCompleted?.id && entry.id !== latestCancelled?.id);
  if (secondary) {
    candidates.push({
      label: "Improve Recent Work",
      prompt: compactPrompt(
        `Review the result of "${secondary.missionBrief}" against its intended outcome. Identify what evidence, implementation detail, or decision is still missing, then produce an improved version.`,
      ),
      config: secondary.configuration,
    });
  }

  const seen = new Set<string>();
  return candidates
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter((item) => {
      if (seen.has(item.label)) return false;
      seen.add(item.label);
      return true;
    })
    .slice(0, 4);
}

function describeCancelledMissionState(entry: MissionHistoryEntry) {
  const completedWorkstreams = entry.workstreams.filter((workstream) => workstream.status === "completed").length;
  const totalWorkstreams = entry.workstreams.length;
  const latestDialogue = entry.dialogue.at(-1);
  const dialogueSummary = latestDialogue && "content" in latestDialogue
    ? latestDialogue.content
    : "";
  const progress = totalWorkstreams > 0
    ? ` Partial progress: ${completedWorkstreams}/${totalWorkstreams} workstreams completed.`
    : " The mission was cancelled before meaningful workstream completion.";
  const signal = dialogueSummary
    ? ` Latest agent signal: ${sanitizeBriefSnippet(dialogueSummary)}.`
    : "";
  return `${progress}${signal}`;
}

function firstReportInsight(value?: string) {
  return value
    ?.split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .find((line) => line.length >= 18 && !/^(none|no\s)/i.test(line));
}

function compactPrompt(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 520);
}

function sanitizeBriefSnippet(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

function ConfigChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-purple-300/15 bg-purple-400/10 px-3 py-1 text-[0.68rem] font-medium text-purple-100/85">
      <span className="text-white/40">{label}:</span> {value}
    </span>
  );
}
