/**
 * Agent Society — Mission Control
 *
 * The main experience. Single-page mission command center.
 */

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeyRound, Menu, Settings } from "lucide-react";
import { useMissionEngine } from "@/hooks";
import { useMissionStore } from "@/store";
import { useHistoryStore, useRuntimeSettingsStore } from "@/store";
import { useFadeInUp, useStaggerContainer } from "@/hooks";
import { getQwenRuntimeInfo } from "@/services/qwen";
import { MISSION_TYPE_LABELS, DEPTH_LABELS, TIME_HORIZON_LABELS, BUDGET_RANGE_LABELS, RISK_TOLERANCE_LABELS, OUTPUT_FORMAT_LABELS, MissionState, type MissionConfiguration, type MissionType, type Depth, type TimeHorizon, type BudgetRange, type RiskTolerance, type OutputFormat } from "@/types";
import {
  AgentWorkflowPanel, WorkstreamsPanel, DialoguePanel,
  ConflictPanel, ReportPanel, TimelinePanel, EfficiencyPanel,
  NetworkGraphPanel,
} from "@/panels";
import { SpaceBackground } from "@/components/space-background";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MissionBriefComposer } from "./components/mission-brief-composer";
import { MissionSidebar, MissionSidebarContent, type MissionView } from "./components/mission-sidebar";
import { MissionStatusBar } from "./components/mission-status-bar";
import { SidebarPageView } from "./components/sidebar-pages";

export function MissionControl() {
  const [brief, setBrief] = useState("");
  const [config, setConfig] = useState<Partial<MissionConfiguration>>({});
  const [showConfig, setShowConfig] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [apiKeyRequiredOpen, setApiKeyRequiredOpen] = useState(false);
  const [activeView, setActiveView] = useState<MissionView>("mission-control");
  const { context, isRunning, launch, cancel } = useMissionEngine();
  const loadHistory = useHistoryStore((s) => s.load);
  const loadRuntimeSettings = useRuntimeSettingsStore((s) => s.load);
  const qwenApiKey = useRuntimeSettingsStore((s) => s.qwenApiKey);
  const progress = useMissionStore((s) => s.context?.progress ?? 0);
  const status = useMissionStore((s) => s.context?.status);
  const activeAgents = useMissionStore((s) => s.context?.currentAgent ? 1 : 0);
  const fadeUp = useFadeInUp();
  const stagger = useStaggerContainer();
  const runtimeInfo = getQwenRuntimeInfo();
  const mockMode = runtimeInfo.provider === "Mock";
  const hasUsableQwenKey = runtimeInfo.hasUsableApiKey && Boolean(qwenApiKey.trim() || process.env.NEXT_PUBLIC_QWEN_API_KEY);

  useEffect(() => {
    loadHistory();
    loadRuntimeSettings();
  }, [loadHistory, loadRuntimeSettings]);

  const handleLaunch = () => {
    if (brief.trim().length < 10) {
      setValidationOpen(true);
      return;
    }
    if (!hasUsableQwenKey) {
      setApiKeyRequiredOpen(true);
      return;
    }
    launch(brief.trim(), config);
  };

  const handleViewChange = (view: MissionView) => {
    setActiveView(view);
    setShowMobileNav(false);
  };

  const handleExampleSelect = (prompt: string, nextConfig: Partial<MissionConfiguration>) => {
    setBrief(prompt);
    setConfig((current) => ({ ...current, ...nextConfig }));
  };

  const isIdle = status === MissionState.Idle || !status;
  const isComplete = status === MissionState.Completed;
  const hasContent = context && !isIdle;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <SpaceBackground />

      <div className="relative z-10 flex min-h-screen">
        <MissionSidebar activeView={activeView} onViewChange={handleViewChange} />

        <main className="min-w-0 flex-1 px-4 py-4 md:px-7 md:py-6">
          <motion.div
            className="mx-auto flex max-w-7xl flex-col gap-7"
            variants={stagger}
            initial="hidden"
            animate="visible"
          >
            <div className="flex items-center justify-between lg:hidden">
              <Sheet open={showMobileNav} onOpenChange={setShowMobileNav}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="border-cyan-200/20 bg-white/[0.06] text-cyan-100">
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">Open navigation</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 border-cyan-200/15 bg-[#050914]/95 p-4 text-white backdrop-blur-2xl">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Agent Society Navigation</SheetTitle>
                  </SheetHeader>
                  <div className="flex h-full flex-col">
                    <MissionSidebarContent activeView={activeView} onViewChange={handleViewChange} />
                  </div>
                </SheetContent>
              </Sheet>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Agent Society</p>
                <p className="text-lg font-bold text-white">Mission Control</p>
              </div>
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.8)]" />
            </div>

            <MissionStatusBar
              activeAgents={activeAgents}
              status={status}
              mode={runtimeInfo.provider}
            />

            {activeView === "mission-control" ? (
              <>
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
                  config={config}
                  isRunning={isRunning}
                  isComplete={isComplete || status === MissionState.Cancelled}
                  mockMode={mockMode}
                  showConfig={showConfig}
                  configContent={(
                    <ConfigForm
                      config={config}
                      onChange={setConfig}
                      onApply={() => setShowConfig(false)}
                      onReset={() => setConfig({})}
                    />
                  )}
                  onBriefChange={setBrief}
                  onExampleSelect={handleExampleSelect}
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
                      <MissionTabs />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <SidebarPageView
                activeView={activeView}
                onDuplicate={(nextBrief, nextConfig) => {
                  setBrief(nextBrief);
                  setConfig(nextConfig);
                  setActiveView("mission-control");
                }}
                onOpenMissionControl={() => setActiveView("mission-control")}
              />
            )}
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

      <Dialog open={apiKeyRequiredOpen} onOpenChange={setApiKeyRequiredOpen}>
        <DialogContent className="border-cyan-200/15 bg-[#07111f]/95 text-white shadow-[0_30px_120px_rgba(34,211,238,0.18)] backdrop-blur-2xl">
          <DialogHeader>
            <div className="mb-2 grid h-12 w-12 place-items-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10">
              <KeyRound className="h-5 w-5 text-cyan-100" />
            </div>
            <DialogTitle className="text-xl text-white">Qwen API key required</DialogTitle>
            <DialogDescription className="leading-relaxed text-white/60">
              Agent Society is open source and does not ship with a shared API key. Add your own Qwen test or hackathon key in Settings before launching missions.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setApiKeyRequiredOpen(false)} className="border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white">
              Cancel
            </Button>
            <Button
              onClick={() => {
                setApiKeyRequiredOpen(false);
                setActiveView("settings");
              }}
              className="gap-2 bg-gradient-to-r from-cyan-300 to-purple-400 text-[#06101f] shadow-[0_0_34px_rgba(34,211,238,0.24)] hover:from-cyan-200 hover:to-purple-300"
            >
              <Settings className="h-4 w-4" />
              Open Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Config Form ──────────────────────── */

function MissionTabs() {
  return (
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

      <div className="mt-4 min-h-0 rounded-2xl border border-cyan-200/10 bg-white/[0.045] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl md:p-6">
        <TabsContent value="workflow" className="mt-0 min-h-0"><AgentWorkflowPanel /></TabsContent>
        <TabsContent value="workstreams" className="mt-0 min-h-0"><WorkstreamsPanel /></TabsContent>
        <TabsContent value="dialogue" className="mt-0 min-h-0"><DialoguePanel /></TabsContent>
        <TabsContent value="conflicts" className="mt-0 min-h-0"><ConflictPanel /></TabsContent>
        <TabsContent value="report" className="mt-0 min-h-0"><ReportPanel /></TabsContent>
        <TabsContent value="timeline" className="mt-0 min-h-0"><TimelinePanel /></TabsContent>
        <TabsContent value="efficiency" className="mt-0 min-h-0"><EfficiencyPanel /></TabsContent>
        <TabsContent value="network" className="mt-0 min-h-0"><NetworkGraphPanel /></TabsContent>
      </div>
    </Tabs>
  );
}

function ConfigForm({ config, onChange, onApply, onReset }: { config: Partial<MissionConfiguration>; onChange: (c: Partial<MissionConfiguration>) => void; onApply: () => void; onReset: () => void }) {
  return (
    <div className="mt-4 space-y-5 px-1">
      <ConfigSelect label="Mission Type" value={config.missionType ?? "general-mission"} options={MISSION_TYPE_LABELS} onChange={(v) => onChange({ ...config, missionType: v as MissionType })} />
      <ConfigSelect label="Depth" value={config.depth ?? "balanced"} options={DEPTH_LABELS} onChange={(v) => onChange({ ...config, depth: v as Depth })} />
      <ConfigSelect label="Time Horizon" value={config.timeHorizon ?? "30-days"} options={TIME_HORIZON_LABELS} onChange={(v) => onChange({ ...config, timeHorizon: v as TimeHorizon })} />
      <ConfigSelect label="Budget Range" value={config.budgetRange ?? "none"} options={BUDGET_RANGE_LABELS} onChange={(v) => onChange({ ...config, budgetRange: v as BudgetRange })} />
      <ConfigSelect label="Risk Tolerance" value={config.riskTolerance ?? "balanced"} options={RISK_TOLERANCE_LABELS} onChange={(v) => onChange({ ...config, riskTolerance: v as RiskTolerance })} />
      <ConfigSelect label="Output Format" value={config.outputFormat ?? "execution-roadmap"} options={OUTPUT_FORMAT_LABELS} onChange={(v) => onChange({ ...config, outputFormat: v as OutputFormat })} />
      <div className="flex gap-2 pt-3">
        <Button type="button" onClick={onApply} className="flex-1 rounded-full bg-cyan-300 text-[#06101f] hover:bg-cyan-200">
          Apply Settings
        </Button>
        <Button type="button" variant="outline" onClick={onReset} className="rounded-full border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white">
          Reset
        </Button>
      </div>
    </div>
  );
}

function ConfigSelect<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-white/70">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className="border-cyan-200/15 bg-white/[0.06] text-white hover:border-cyan-200/35">
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
