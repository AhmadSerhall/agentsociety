"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Calculator,
  ChevronRight,
  Hammer,
  Loader2,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Maximize2,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTypewriterText } from "@/hooks/use-typewriter-text";
import type { CouncilHiddenContext, CouncilSuggestionChip, CouncilSuggestionIconKind, MissionHistoryEntry } from "@/types";
import {
  generateTopicAwareSuggestions,
  replaceTopicAwareSuggestion,
  type TopicAwareSuggestion,
} from "./council-recommendations-sheet";

const ICONS: Record<CouncilSuggestionIconKind, typeof Sparkles> = {
  continue: PlayCircle,
  implement: Hammer,
  optimize: TrendingUp,
  validate: ShieldCheck,
  "reduce-risk": ShieldAlert,
  "estimate-cost": Calculator,
  expand: Maximize2,
  research: BookOpen,
};

const ANGLE_ICON: Record<string, CouncilSuggestionIconKind> = {
  "compare options within the topic": "research",
  "understand fundamentals": "research",
  "identify best choices": "research",
  "investigate common mistakes": "reduce-risk",
  "improve a particular skill": "optimize",
  "create a focused routine": "implement",
  "analyze recent changes": "expand",
  "review tools or resources": "research",
  "validate an assumption": "validate",
  "explore an advanced subtopic": "expand",
  "measure progress": "validate",
  "solve a likely obstacle": "reduce-risk",
};

function CouncilSuggestionIcon({ kind }: { kind: CouncilSuggestionIconKind }) {
  const Icon = ICONS[kind] ?? Search;
  return <Icon className="h-3.5 w-3.5 shrink-0 text-cyan-200" />;
}

function InlineReviewingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex min-w-0 max-w-full items-center gap-2.5 rounded-full border border-cyan-200/15 bg-cyan-300/[0.045] px-3.5 py-2"
    >
      <div className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full border border-cyan-200/25 bg-cyan-300/10">
        <Sparkles className="h-3.5 w-3.5 text-cyan-100" />
        <span className="absolute inset-0 animate-ping rounded-full border border-cyan-200/20" />
      </div>
      <p className="truncate text-xs font-medium text-cyan-50/90">
        The council is reviewing previous missions...
      </p>
    </motion.div>
  );
}

function iconForAngle(angle: string): CouncilSuggestionIconKind {
  const exact = ANGLE_ICON[angle.toLowerCase()];
  if (exact) return exact;
  const normalized = angle.toLowerCase();
  if (normalized.includes("mistake") || normalized.includes("obstacle") || normalized.includes("risk")) return "reduce-risk";
  if (normalized.includes("routine") || normalized.includes("practice") || normalized.includes("schedule")) return "implement";
  if (normalized.includes("measure") || normalized.includes("validate") || normalized.includes("progress")) return "validate";
  if (normalized.includes("cost") || normalized.includes("budget")) return "estimate-cost";
  if (normalized.includes("improve") || normalized.includes("skill")) return "optimize";
  if (normalized.includes("advanced") || normalized.includes("expand")) return "expand";
  return "research";
}

function toCouncilChip(entry: MissionHistoryEntry, suggestion: TopicAwareSuggestion): CouncilSuggestionChip {
  const iconKind = iconForAngle(suggestion.angle);
  return {
    id: suggestion.id,
    label: suggestion.label.slice(0, 56),
    visibleBrief: suggestion.prompt.slice(0, 280),
    why: suggestion.why,
    iconKind,
    config: entry.configuration ?? {},
    hidden: {
      parentMissionId: entry.id,
      sourceMissionBrief: entry.missionBrief,
      missionStatus: entry.finalReport ? "completed" : "cancelled",
      suggestionKind: iconKind,
      councilRationale: suggestion.why,
      replayAvailable: Boolean(entry.replayEvents?.length),
      completedWorkstreams: entry.workstreams?.filter((item) => item.status === "completed").length,
      totalWorkstreams: entry.workstreams?.length,
    },
  };
}

export function CouncilSuggestionsPanel({
  entries,
  disabled,
  onSelect,
  onOpenSheet,
  trailing,
}: {
  entries: MissionHistoryEntry[];
  disabled?: boolean;
  onSelect: (chip: CouncilSuggestionChip, visibleBrief: string) => void;
  onOpenSheet: () => void;
  trailing?: ReactNode;
}) {
  const hasHistory = entries.length > 0;
  const [reviewing, setReviewing] = useState(false);
  const [chips, setChips] = useState<CouncilSuggestionChip[]>([]);
  const [error, setError] = useState("");
  const [typingChipId, setTypingChipId] = useState<string | null>(null);
  const [replacingChipId, setReplacingChipId] = useState<string | null>(null);
  const seenCouncilByHistoryRef = useRef<Record<string, { labels: string[]; prompts: string[]; angles: string[] }>>({});
  const loadedRef = useRef(false);
  const activeChipRef = useRef<CouncilSuggestionChip | null>(null);
  const typewriter = useTypewriterText((value) => {
    if (activeChipRef.current) onSelect(activeChipRef.current, value);
  });

  const loadInlineChips = useCallback(() => {
    if (!hasHistory || disabled) return;
    setReviewing(true);
    setError("");
    seenCouncilByHistoryRef.current = {};
    void generateTopicAwareSuggestions(entries.slice(0, 2), 1)
      .then((result) => {
        const nextChips = result
          .map((suggestion) => {
            const entry = entries.find((item) => item.id === suggestion.historyId);
            if (!entry) return null;
            return toCouncilChip(entry, suggestion);
          })
          .filter((chip): chip is CouncilSuggestionChip => Boolean(chip))
          .slice(0, 2);

        setChips(nextChips);
        for (const chip of nextChips) {
          const historyId = chip.hidden.parentMissionId;
          const matched = result.find((item) => item.id === chip.id);
          const seen = seenCouncilByHistoryRef.current[historyId] ?? { labels: [], prompts: [], angles: [] };
          seenCouncilByHistoryRef.current[historyId] = {
            labels: [...seen.labels, chip.label],
            prompts: [...seen.prompts, chip.visibleBrief],
            angles: [...seen.angles, matched?.angle ?? chip.iconKind],
          };
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not generate council suggestions."))
      .finally(() => setReviewing(false));
  }, [disabled, entries, hasHistory]);

  useEffect(() => {
    if (!hasHistory || disabled || loadedRef.current) return;
    loadedRef.current = true;
    loadInlineChips();
  }, [disabled, hasHistory, loadInlineChips]);

  const handleChipClick = (chip: CouncilSuggestionChip) => {
    if (disabled || typingChipId || replacingChipId) return;
    activeChipRef.current = chip;
    setTypingChipId(chip.id);
    typewriter(chip.visibleBrief, () => {
      onSelect(chip, chip.visibleBrief);
      setTypingChipId(null);
      activeChipRef.current = null;
    });
  };

  const handleDeleteChip = (chipId: string) => {
    setChips((current) => current.filter((chip) => chip.id !== chipId));
  };

  const handleReplaceChip = async (chip: CouncilSuggestionChip) => {
    const entry = entries.find((item) => item.id === chip.hidden.parentMissionId);
    if (!entry) return;
    setReplacingChipId(chip.id);
    setError("");
    try {
      const historyId = entry.id;
      const seen = seenCouncilByHistoryRef.current[historyId] ?? { labels: [], prompts: [], angles: [] };
      const exclude = {
        labels: [...new Set([...seen.labels, ...chips.map((item) => item.label), chip.label])],
        prompts: [...new Set([...seen.prompts, ...chips.map((item) => item.visibleBrief), chip.visibleBrief])],
        angles: [...seen.angles],
      };
      const replacement = await replaceTopicAwareSuggestion(entry, exclude);
      const nextChip = toCouncilChip(entry, replacement);
      seenCouncilByHistoryRef.current[historyId] = {
        labels: [...exclude.labels, nextChip.label],
        prompts: [...exclude.prompts, nextChip.visibleBrief],
        angles: [...exclude.angles, replacement.angle],
      };
      setChips((current) => current.map((item) => (item.id === chip.id ? nextChip : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not replace this suggestion.");
    } finally {
      setReplacingChipId(null);
    }
  };

  const handleOpenSheet = () => {
    if (!hasHistory || disabled) return;
    onOpenSheet();
  };

  if (!hasHistory) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-white/38">Complete a mission to unlock council suggestions.</p>
        {trailing}
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-2">
      <div className="flex w-full flex-nowrap items-center gap-2">
        <motion.button
          type="button"
          whileHover={!disabled ? { y: -2, scale: 1.02 } : undefined}
          whileTap={!disabled ? { scale: 0.98 } : undefined}
          onClick={handleOpenSheet}
          disabled={disabled}
          className="flex shrink-0 items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/80 transition hover:border-cyan-200/40 hover:bg-cyan-300/15 hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Council Suggestions
          <ChevronRight className="h-3.5 w-3.5" />
        </motion.button>

        <div className="flex min-w-0 flex-1 items-center justify-start overflow-x-auto">
          <AnimatePresence mode="wait" initial={false}>
            {reviewing ? (
              <InlineReviewingState key="reviewing" />
            ) : chips.length > 0 ? (
              <motion.div
                key="chips"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-nowrap items-center gap-2"
              >
                {chips.map((chip) => (
                  <ContextMenu key={chip.id}>
                    <Tooltip>
                      <ContextMenuTrigger asChild>
                        <TooltipTrigger asChild>
                          <motion.button
                            type="button"
                            whileHover={{ y: -2, scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={disabled || Boolean(typingChipId) || replacingChipId === chip.id}
                            onClick={() => handleChipClick(chip)}
                            className="flex w-max max-w-[16rem] shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-3.5 py-2 text-left text-xs font-medium text-white/75 transition hover:border-cyan-200/35 hover:bg-cyan-300/10 hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <CouncilSuggestionIcon kind={chip.iconKind} />
                            <span className="truncate">{chip.label}</span>
                            {(typingChipId === chip.id || replacingChipId === chip.id) && (
                              <Loader2 className="h-3 w-3 animate-spin text-cyan-200" />
                            )}
                          </motion.button>
                        </TooltipTrigger>
                      </ContextMenuTrigger>
                      <TooltipContent
                        side="bottom"
                        className="max-w-xs border border-cyan-200/15 bg-[#07111f]/95 px-3 py-2 text-xs leading-relaxed text-white/80 shadow-[0_20px_60px_rgba(34,211,238,0.18)]"
                      >
                        <p className="font-semibold text-cyan-100">Why this suggestion?</p>
                        <p className="mt-1">{chip.why}</p>
                      </TooltipContent>
                    </Tooltip>
                    <ContextMenuContent className="w-44 border border-cyan-200/15 bg-[#07111f]/95 text-white">
                      <ContextMenuItem
                        disabled={Boolean(replacingChipId)}
                        onSelect={() => void handleReplaceChip(chip)}
                        className="gap-2 focus:bg-cyan-300/10 focus:text-cyan-50"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Replace
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => handleDeleteChip(chip.id)}
                        className="gap-2 text-rose-200 focus:bg-rose-400/10 focus:text-rose-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {trailing && (
          <div className="flex shrink-0 items-center">
            {trailing}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-200/20 bg-amber-300/[0.06] p-3 text-xs text-amber-100/80">
          {error}
        </div>
      )}
    </div>
  );
}

export type { CouncilHiddenContext };
