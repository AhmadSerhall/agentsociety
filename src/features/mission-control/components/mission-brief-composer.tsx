"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Loader2, Rocket, Settings2, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  DEPTH_LABELS,
  MISSION_TYPE_LABELS,
  OUTPUT_FORMAT_LABELS,
  TIME_HORIZON_LABELS,
  type MissionConfiguration,
} from "@/types";

const EXAMPLE_PROMPTS = [
  {
    label: "Startup Launch",
    prompt: "Launch an AI SaaS startup for restaurants in 30 days with an MVP, pricing, launch plan, and risk review.",
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
] satisfies Array<{
  label: string;
  prompt: string;
  config: Partial<MissionConfiguration>;
}>;

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
          <div className="flex items-center gap-2">
            <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/10">
              Mission Brief
            </Badge>
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
                className="gap-2 rounded-full border-cyan-200/20 bg-white/[0.06] px-4 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.10)] hover:border-cyan-200/40 hover:bg-cyan-300/10 hover:text-white"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-200" />
                Mission Config
                <Settings2 className="h-3.5 w-3.5 text-purple-200" />
              </Button>
            </SheetTrigger>
            <SheetContent className="border-cyan-200/15 bg-[#07111f]/95 text-white shadow-[0_0_80px_rgba(34,211,238,0.18)] backdrop-blur-2xl">
              <SheetHeader>
                <SheetTitle className="text-white">Mission Configuration</SheetTitle>
              </SheetHeader>
              {configContent}
            </SheetContent>
          </Sheet>
        </div>

        <Textarea
          placeholder={
            '"Launch an AI SaaS startup for restaurants in 30 days..."\n' +
            '"Plan a full MVP and go-to-market strategy for an AI support platform..."\n' +
            '"Create an execution roadmap for a modern ERP system..."'
          }
          value={brief}
          onChange={(event) => onBriefChange(event.target.value)}
          disabled={isRunning}
          rows={8}
          className="min-h-[220px] resize-none rounded-2xl border-cyan-200/15 bg-[#08111f]/78 p-5 text-base leading-7 text-white shadow-inner shadow-black/30 placeholder:text-white/30 focus-visible:border-cyan-200/40 focus-visible:ring-cyan-300/25 md:text-lg"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((example) => (
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
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <ConfigChip label="Type" value={MISSION_TYPE_LABELS[config.missionType ?? "general-mission"]} />
          <ConfigChip label="Depth" value={DEPTH_LABELS[config.depth ?? "balanced"]} />
          <ConfigChip label="Horizon" value={TIME_HORIZON_LABELS[config.timeHorizon ?? "30-days"]} />
          <ConfigChip label="Format" value={OUTPUT_FORMAT_LABELS[config.outputFormat ?? "execution-roadmap"]} />
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

function ConfigChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-purple-300/15 bg-purple-400/10 px-3 py-1 text-[0.68rem] font-medium text-purple-100/85">
      <span className="text-white/40">{label}:</span> {value}
    </span>
  );
}
