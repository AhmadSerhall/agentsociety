/**
 * Agent Society — Mission Control
 *
 * The main experience. Single-page mission command center.
 */

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMissionEngine } from "@/hooks";
import { useMissionStore } from "@/store";
import { useFadeInUp, useStaggerContainer } from "@/hooks";
import { isMockMode } from "@/services/qwen";
import { MISSION_TYPE_LABELS, DEPTH_LABELS, TIME_HORIZON_LABELS, BUDGET_RANGE_LABELS, RISK_TOLERANCE_LABELS, OUTPUT_FORMAT_LABELS, MissionState, type MissionConfiguration, type MissionType, type Depth, type TimeHorizon, type BudgetRange, type RiskTolerance, type OutputFormat } from "@/types";
import {
  AgentWorkflowPanel, WorkstreamsPanel, DialoguePanel,
  ConflictPanel, ReportPanel, TimelinePanel, EfficiencyPanel,
  NetworkGraphPanel,
} from "@/panels";
import { SpaceBackground } from "@/components/space-background";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MissionBriefComposer } from "./components/mission-brief-composer";
import { MissionSidebar } from "./components/mission-sidebar";
import { MissionStatusBar } from "./components/mission-status-bar";

export function MissionControl() {
  const [brief, setBrief] = useState("");
  const [config, setConfig] = useState<Partial<MissionConfiguration>>({});
  const [showConfig, setShowConfig] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const { context, isRunning, launch, cancel } = useMissionEngine();
  const progress = useMissionStore((s) => s.context?.progress ?? 0);
  const status = useMissionStore((s) => s.context?.status);
  const activeAgents = useMissionStore((s) => s.context?.currentAgent ? 1 : 0);
  const fadeUp = useFadeInUp();
  const stagger = useStaggerContainer();
  const mockMode = isMockMode();

  const handleLaunch = () => {
    if (brief.trim().length < 10) {
      setValidationOpen(true);
      return;
    }
    launch(brief.trim(), config);
  };

  const isIdle = status === MissionState.Idle || !status;
  const isComplete = status === MissionState.Completed;
  const hasContent = context && !isIdle;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <SpaceBackground />

      <div className="relative z-10 flex min-h-screen">
        <MissionSidebar />

        <main className="min-w-0 flex-1 px-4 py-4 md:px-7 md:py-6">
          <motion.div
            className="mx-auto flex max-w-7xl flex-col gap-7"
            variants={stagger}
            initial="hidden"
            animate="visible"
          >
            <div className="flex items-center justify-between lg:hidden">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Agent Society</p>
                <p className="text-lg font-bold text-white">Mission Control</p>
              </div>
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.8)]" />
            </div>

            <MissionStatusBar
              activeAgents={activeAgents}
              status={status}
              mode={mockMode ? "Mock" : "Qwen"}
            />

            {/* Hero */}
            <motion.div variants={fadeUp} className="text-center">
              <div className="mx-auto inline-flex rounded-full border border-cyan-200/15 bg-white/[0.045] px-4 py-2 text-xs uppercase tracking-[0.26em] text-cyan-100/70 backdrop-blur-xl">
                Mission Control Dashboard
              </div>
              <h1 className="mt-5 bg-gradient-to-r from-white via-cyan-100 to-purple-200 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-6xl">
                Hello, Mission Operator
              </h1>
              <p className="mt-4 text-lg text-white/62 md:text-xl">
                What complex objective are we solving today?
              </p>
            </motion.div>

            <MissionBriefComposer
              brief={brief}
              isRunning={isRunning}
              isComplete={isComplete}
              mockMode={mockMode}
              showConfig={showConfig}
              configContent={<ConfigForm config={config} onChange={setConfig} />}
              onBriefChange={setBrief}
              onConfigOpenChange={setShowConfig}
              onLaunch={handleLaunch}
              onCancel={cancel}
            />

          {/* Progress Bar */}
          <AnimatePresence>
            {hasContent && (
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0 }}
                className="mx-auto w-full max-w-4xl rounded-2xl border border-cyan-200/10 bg-white/[0.045] p-4 backdrop-blur-2xl"
              >
                <div className="mb-2 flex items-center justify-between text-xs text-white/50">
                  <span className="capitalize">{status?.replace(/-/g, " ")}</span>
                  <span>{Math.round(progress * 100)}%</span>
                </div>
                <Progress value={progress * 100} className="h-2 bg-white/10" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Panels Grid */}
          <AnimatePresence>
            {hasContent && (
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0 }}
              >
                <Tabs defaultValue="workflow" className="w-full">
                  <TabsList className="h-auto w-full flex-wrap justify-start gap-1 overflow-x-auto border border-cyan-200/10 bg-white/[0.045] p-1 backdrop-blur-xl">
                    <TabsTrigger value="workflow">Workflow</TabsTrigger>
                    <TabsTrigger value="workstreams">Workstreams</TabsTrigger>
                    <TabsTrigger value="dialogue">Dialogue</TabsTrigger>
                    <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
                    <TabsTrigger value="report">Final Report</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
                    <TabsTrigger value="network">Network</TabsTrigger>
                  </TabsList>

                  <div className="mt-4 rounded-2xl border border-cyan-200/10 bg-white/[0.045] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl md:p-6">
                    <TabsContent value="workflow"><AgentWorkflowPanel /></TabsContent>
                    <TabsContent value="workstreams"><WorkstreamsPanel /></TabsContent>
                    <TabsContent value="dialogue"><DialoguePanel /></TabsContent>
                    <TabsContent value="conflicts"><ConflictPanel /></TabsContent>
                    <TabsContent value="report"><ReportPanel /></TabsContent>
                    <TabsContent value="timeline"><TimelinePanel /></TabsContent>
                    <TabsContent value="efficiency"><EfficiencyPanel /></TabsContent>
                    <TabsContent value="network"><NetworkGraphPanel /></TabsContent>
                  </div>
                </Tabs>
              </motion.div>
            )}
          </AnimatePresence>
          </motion.div>
        </main>
      </div>

      {/* Validation Dialog */}
      <Dialog open={validationOpen} onOpenChange={setValidationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mission Brief Required</DialogTitle>
            <DialogDescription>
              Please describe the complex objective you want the agent society to tackle.
              A good brief is at least a sentence or two — the more context you provide,
              the better the agents can collaborate.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Config Form ──────────────────────── */

function ConfigForm({ config, onChange }: { config: Partial<MissionConfiguration>; onChange: (c: Partial<MissionConfiguration>) => void }) {
  return (
    <div className="space-y-5 mt-4">
      <ConfigSelect label="Mission Type" value={config.missionType ?? "general-mission"} options={MISSION_TYPE_LABELS} onChange={(v) => onChange({ ...config, missionType: v as MissionType })} />
      <ConfigSelect label="Depth" value={config.depth ?? "balanced"} options={DEPTH_LABELS} onChange={(v) => onChange({ ...config, depth: v as Depth })} />
      <ConfigSelect label="Time Horizon" value={config.timeHorizon ?? "30-days"} options={TIME_HORIZON_LABELS} onChange={(v) => onChange({ ...config, timeHorizon: v as TimeHorizon })} />
      <ConfigSelect label="Budget Range" value={config.budgetRange ?? "none"} options={BUDGET_RANGE_LABELS} onChange={(v) => onChange({ ...config, budgetRange: v as BudgetRange })} />
      <ConfigSelect label="Risk Tolerance" value={config.riskTolerance ?? "balanced"} options={RISK_TOLERANCE_LABELS} onChange={(v) => onChange({ ...config, riskTolerance: v as RiskTolerance })} />
      <ConfigSelect label="Output Format" value={config.outputFormat ?? "execution-roadmap"} options={OUTPUT_FORMAT_LABELS} onChange={(v) => onChange({ ...config, outputFormat: v as OutputFormat })} />
    </div>
  );
}

function ConfigSelect<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-white/70">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className="border-white/10 bg-white/5 text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.entries(options) as [T, string][]).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
