/**
 * Agent Society — Mission Control
 *
 * The main experience. Single-page mission command center.
 */

"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Clock3, Download, FileText, KeyRound, Menu, RotateCcw, Save, Settings, ShieldAlert, SlidersHorizontal, Target, WalletCards, Zap } from "lucide-react";
import { useMissionEngine } from "@/hooks";
import { useMissionStore } from "@/store";
import { useHistoryStore, useRuntimeSettingsStore, useReplayStore } from "@/store";
import { useFadeInUp, useStaggerContainer } from "@/hooks";
import { hasUsableQwenKey, hideApiKeyOnboardingPermanently, isApiKeyOnboardingHidden } from "@/lib/qwenConfig";
import { getQwenRuntimeInfo } from "@/services/qwen";
import { MISSION_TYPE_LABELS, DEPTH_LABELS, TIME_HORIZON_LABELS, BUDGET_RANGE_LABELS, RISK_TOLERANCE_LABELS, OUTPUT_FORMAT_LABELS, MissionState, AgentRole, type MissionConfiguration, type MissionType, type Depth, type TimeHorizon, type BudgetRange, type RiskTolerance, type OutputFormat } from "@/types";
import {
  AgentWorkflowPanel, WorkstreamsPanel, DialoguePanel,
  ConflictPanel, ReportPanel, TimelinePanel, EfficiencyPanel,
  NetworkGraphPanel,
} from "@/panels";
import { SpaceBackground } from "@/components/space-background";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MissionBriefComposer } from "./components/mission-brief-composer";
import { MissionSidebar, MissionSidebarContent, type MissionView } from "./components/mission-sidebar";
import { SidebarPageView } from "./components/sidebar-pages";
import { ReplayControlBar } from "./components/replay-control-bar";
import { AgentCouncilRoom } from "./components/council/agent-council-room";
import { CompactMissionHeader } from "./components/council/compact-mission-header";
import { downloadText, generateId, reportToMarkdown } from "@/utils";
import { toast } from "@/hooks/use-toast";

const AGENT_ORDER: AgentRole[] = [
  AgentRole.Planner,
  AgentRole.Researcher,
  AgentRole.ProductStrategist,
  AgentRole.TechnicalArchitect,
  AgentRole.MarketingStrategist,
  AgentRole.Finance,
  AgentRole.RiskCritic,
  AgentRole.Mediator,
  AgentRole.Finalizer,
];

export function MissionControl() {
  const [brief, setBrief] = useState("");
  const [config, setConfig] = useState<Partial<MissionConfiguration>>({});
  const [showConfig, setShowConfig] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [apiKeyRequiredOpen, setApiKeyRequiredOpen] = useState(false);
  const [apiKeyOnboardingDismissed, setApiKeyOnboardingDismissed] = useState(false);
  const [replayComingOpen, setReplayComingOpen] = useState(false);
  const [highlightReportTab, setHighlightReportTab] = useState(false);
  const [completionToastOpen, setCompletionToastOpen] = useState(false);
  const [activeView, setActiveView] = useState<MissionView>("mission-control");
  const [activeMissionTab, setActiveMissionTab] = useState("workflow");
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const previousStatus = useRef<MissionState | undefined>(undefined);
  const { context, isRunning, launch, cancel } = useMissionEngine();
  const loadHistory = useHistoryStore((s) => s.load);
  const loadRuntimeSettings = useRuntimeSettingsStore((s) => s.load);
  const qwenApiKey = useRuntimeSettingsStore((s) => s.qwenApiKey);
  const progress = useMissionStore((s) => s.context?.progress ?? 0);
  const status = useMissionStore((s) => s.context?.status);
  const resetMission = useMissionStore((s) => s.reset);
  const replayMode = useReplayStore((s) => s.mode);
  const replayEvents = useReplayStore((s) => s.replayEvents);
  const replayTime = useReplayStore((s) => s.replayTime);
  const autoFollow = useReplayStore((s) => s.autoFollowEnabled);
  const tickReplay = useReplayStore((s) => s.tick);
  const startReplay = useReplayStore((s) => s.startReplay);
  const involvedAgents = useMemo(() => {
    const roles = new Set<AgentRole>();
    const currentContext = context;

    if (replayMode === "replay") {
      currentContext?.replayEvents.forEach((event) => {
        if (
          event.agentRole &&
          event.relativeTimestamp > 0 &&
          event.relativeTimestamp <= replayTime &&
          (event.type === "PLANNER_STARTED" ||
            event.type === "AGENT_STARTED" ||
            event.type === "MEDIATOR_STARTED" ||
            event.type === "MEDIATION_STARTED" ||
            event.type === "FINALIZER_STARTED")
        ) {
          roles.add(event.agentRole);
        }
      });
      return Array.from(roles).sort((left, right) => {
        const leftIndex = AGENT_ORDER.indexOf(left);
        const rightIndex = AGENT_ORDER.indexOf(right);
        return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
      });
    }

    if (currentContext && currentContext.status !== MissionState.Idle) roles.add(AgentRole.Planner);
    currentContext?.workstreams.forEach((workstream) => {
      if (workstream.assignedAgent) roles.add(workstream.assignedAgent);
    });
    currentContext?.executionTasks.forEach((task) => {
      roles.add(task.agent);
    });
    currentContext?.replayEvents.forEach((event) => {
      if (
        event.agentRole &&
        (event.type === "PLANNER_STARTED" ||
          event.type === "AGENT_STARTED" ||
          event.type === "MEDIATOR_STARTED" ||
          event.type === "MEDIATION_STARTED" ||
          event.type === "FINALIZER_STARTED")
      ) {
        roles.add(event.agentRole);
      }
    });
    if (currentContext?.currentAgent) roles.add(currentContext.currentAgent);
    if (currentContext?.finalReport || currentContext?.status === MissionState.Completed || currentContext?.status === MissionState.Finalizing) {
      roles.add(AgentRole.Finalizer);
    }
    return Array.from(roles).sort((left, right) => {
      const leftIndex = AGENT_ORDER.indexOf(left);
      const rightIndex = AGENT_ORDER.indexOf(right);
      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
    });
  }, [context, replayMode, replayTime]);
  const previousReplayMode = useRef(replayMode);
  const fadeUp = useFadeInUp();
  const stagger = useStaggerContainer();
  const runtimeInfo = getQwenRuntimeInfo();
  const mockMode = runtimeInfo.provider === "Mock";
  const hasResolvedQwenKey = hasUsableQwenKey();
  const shouldShowApiKeyOnboarding = !hasResolvedQwenKey && !apiKeyOnboardingDismissed && !isApiKeyOnboardingHidden();

  useEffect(() => {
    loadHistory();
    loadRuntimeSettings();
  }, [loadHistory, loadRuntimeSettings]);

  useEffect(() => {
    const resetSessionDismissal = () => setApiKeyOnboardingDismissed(false);
    window.addEventListener("agentSociety:qwenKeyCleared", resetSessionDismissal);
    return () => window.removeEventListener("agentSociety:qwenKeyCleared", resetSessionDismissal);
  }, []);

  useEffect(() => {
    if (previousStatus.current && previousStatus.current !== MissionState.Completed && status === MissionState.Completed && replayMode === "live") {
      setCompletionToastOpen(true);
      const timeout = window.setTimeout(() => setCompletionToastOpen(false), 3600);
      previousStatus.current = status;
      return () => window.clearTimeout(timeout);
    }
    previousStatus.current = status;
  }, [replayMode, status]);

  useEffect(() => {
    if (replayMode !== "replay") return;
    let last = performance.now();
    const interval = window.setInterval(() => {
      const current = performance.now();
      tickReplay(current - last);
      last = current;
    }, 120);
    return () => window.clearInterval(interval);
  }, [replayMode, tickReplay]);

  useEffect(() => {
    if (previousReplayMode.current === "replay" && replayMode === "live") {
      setBrief("");
      setConfig({});
      setActiveMissionTab("workflow");
      setActiveView("mission-control");
    }
    previousReplayMode.current = replayMode;
  }, [replayMode]);

  const autoFollowTab = useMemo(() => {
    if (replayMode !== "replay" || !autoFollow) return;
    const currentEvent = [...replayEvents].reverse().find((event) => event.relativeTimestamp <= replayTime);
    if (!currentEvent) return undefined;
    if (currentEvent.type.includes("CONFLICT") || currentEvent.type.includes("MEDIATOR")) return "conflicts";
    if (currentEvent.type.includes("DIALOGUE") || currentEvent.type.includes("STREAM")) return "dialogue";
    if (currentEvent.type.includes("WORKSTREAM") || currentEvent.type === "AGENT_STARTED") return "workstreams";
    if (currentEvent.type.includes("FINALIZER") || currentEvent.type === "REPORT_GENERATED") return "report";
    if (currentEvent.type === "MISSION_COMPLETED") return "efficiency";
    if (currentEvent.type.includes("PLANNER")) return "workflow";
    return undefined;
  }, [autoFollow, replayEvents, replayMode, replayTime]);

  const handleLaunch = () => {
    if (brief.trim().length < 10) {
      setValidationOpen(true);
      return;
    }
    if (replayMode !== "replay" && !hasResolvedQwenKey) {
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
  const hasContent = context && !isIdle;
  const isComplete = status === MissionState.Completed;
  const isCancelled = status === MissionState.Cancelled;
  const isFailed = status === MissionState.Failed;
  const isLiveMission = Boolean(hasContent && !isComplete && !isCancelled && !isFailed);

  const handleStartNewMission = () => {
    resetMission();
    setBrief("");
    setConfig({});
    setActiveMissionTab("workflow");
  };

  const handleViewFullReport = () => {
    setActiveMissionTab("report");
    window.setTimeout(() => {
      tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setHighlightReportTab(true);
      window.setTimeout(() => setHighlightReportTab(false), 1400);
    }, 50);
  };

  const handleReplayMission = () => {
    if (context?.replayEvents?.length) {
      startReplay(context.replayEvents);
      window.setTimeout(() => document.querySelector("[data-compact-mission-header]")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      return;
    }
    setReplayComingOpen(true);
  };

  return (
    <div className="relative h-screen overflow-hidden">
      <SpaceBackground />

      <div className="relative z-10 flex h-full">
        <MissionSidebar activeView={activeView} onViewChange={handleViewChange} />

        <main className="h-screen min-w-0 flex-1 overflow-y-auto px-4 py-4 [scrollbar-color:rgba(34,211,238,0.65)_transparent] [scrollbar-width:thin] md:px-7 md:py-6">
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
                <SheetContent side="left" className="w-80 border-cyan-200/20 bg-[#050914]/88 p-4 text-white shadow-[0_0_90px_rgba(34,211,238,0.22)] backdrop-blur-2xl">
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

            {activeView === "mission-control" ? (
              <>
                <AnimatePresence>
                  {!hasContent && (
                    <motion.div
                      variants={fadeUp}
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0 }}
                    >
                      <div className="text-center">
                        <div className="mx-auto inline-flex rounded-full border border-cyan-200/15 bg-white/[0.045] px-4 py-2 text-xs uppercase tracking-[0.26em] text-cyan-100/70 backdrop-blur-xl">
                          Mission Control Dashboard
                        </div>
                        <h1 className="mt-5 bg-gradient-to-r from-white via-cyan-100 to-purple-200 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-6xl">
                          Hello, Mission Operator
                        </h1>
                        <p className="mt-4 mb-4 text-lg text-white/62 md:text-xl">
                          What complex objective are we solving today?
                        </p>
                      </div>

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
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {hasContent && (
                    <motion.div
                      variants={fadeUp}
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      <CompactMissionHeader involvedAgents={involvedAgents} onCancel={cancel} onStartNew={handleStartNewMission} />
                      <AgentCouncilRoom onViewReport={handleViewFullReport} onReplayMission={handleReplayMission} onStartNew={handleStartNewMission} />
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {hasContent && isComplete && (
                    <motion.div
                      ref={tabsRef}
                      data-mission-tabs
                      variants={fadeUp}
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0 }}
                      className={highlightReportTab ? "rounded-3xl ring-2 ring-cyan-300/70 ring-offset-4 ring-offset-[#050914] transition-shadow duration-500" : "transition-shadow duration-500"}
                    >
                      <MissionTabs value={activeMissionTab} onValueChange={setActiveMissionTab} />
                    </motion.div>
                  )}
                  {hasContent && (isCancelled || isFailed) && (
                    <motion.div
                      variants={fadeUp}
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0 }}
                    >
                      <MissionOutcomeCard type={isCancelled ? "cancelled" : "failed"} onStartNew={handleStartNewMission} onViewReport={() => setActiveMissionTab("report")} />
                      <MissionTabs value={autoFollowTab ?? activeMissionTab} onValueChange={setActiveMissionTab} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <SidebarPageView
                activeView={activeView}
                onOpenMissionControl={() => setActiveView("mission-control")}
                onReplay={(events) => {
                  startReplay(events);
                  setActiveView("mission-control");
                  setActiveMissionTab("workflow");
                  window.setTimeout(() => document.querySelector("[data-compact-mission-header]")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                }}
              />
            )}
            <ReplayControlBar />
          </motion.div>
        </main>
      </div>

      <AnimatePresence>
        {completionToastOpen && (
          <motion.div
            initial={{ opacity: 0, x: 36, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 36, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            className="fixed right-5 top-5 z-[80] overflow-hidden rounded-2xl border border-emerald-200/25 bg-[#07111f]/92 px-4 py-3 text-white shadow-[0_24px_90px_rgba(16,185,129,0.28)] backdrop-blur-2xl"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent" />
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-emerald-200/25 bg-emerald-300/12 text-emerald-100 shadow-[0_0_28px_rgba(16,185,129,0.35)]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-emerald-100/65">Mission Status</p>
                <p className="text-sm font-semibold text-white">Completed</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              Go to Settings and paste your Qwen API key to run missions.
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

      <Dialog open={shouldShowApiKeyOnboarding} onOpenChange={(open) => {
        if (!open) setApiKeyOnboardingDismissed(true);
      }}>
        <DialogContent className="border-cyan-200/15 bg-[#07111f]/95 text-white shadow-[0_30px_120px_rgba(34,211,238,0.22)] backdrop-blur-2xl sm:max-w-xl">
          <DialogHeader>
            <div className="mb-2 grid h-12 w-12 place-items-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10">
              <KeyRound className="h-5 w-5 text-cyan-100" />
            </div>
            <DialogTitle className="text-xl text-white">Connect your Qwen API key</DialogTitle>
            <DialogDescription className="leading-relaxed text-white/62">
              Agent Society requires a Qwen API key to run missions. The key is stored locally in this browser only and missions will not run until a valid key is saved.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-2 rounded-2xl border border-cyan-200/10 bg-cyan-300/[0.045] p-4 text-sm leading-relaxed text-white/66">
            {[
              "Create or log in to a Qwen/DashScope account.",
              "Generate an API key.",
              "Go to Settings.",
              "Paste it into the Qwen API Key field.",
            ].map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-300/10 font-mono text-[0.72rem] font-semibold leading-none text-cyan-100 tabular-nums pt-0.5">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setApiKeyOnboardingDismissed(true);
              }}
              className="border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
            >
              I'll do it later
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                hideApiKeyOnboardingPermanently();
                setApiKeyOnboardingDismissed(true);
              }}
              className="border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
            >
              Don't show again
            </Button>
            <Button
              onClick={() => {
                setApiKeyOnboardingDismissed(true);
                setActiveView("settings");
              }}
              className="gap-2 bg-gradient-to-r from-cyan-300 to-purple-400 text-[#06101f] shadow-[0_0_34px_rgba(34,211,238,0.24)] hover:from-cyan-200 hover:to-purple-300"
            >
              <Settings className="h-4 w-4" />
              Go to Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={replayComingOpen} onOpenChange={setReplayComingOpen}>
        <DialogContent className="border-cyan-200/15 bg-[#07111f]/95 text-white shadow-[0_30px_120px_rgba(34,211,238,0.18)] backdrop-blur-2xl">
          <DialogHeader>
            <div className="mb-2 grid h-12 w-12 place-items-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10">
              <RotateCcw className="h-5 w-5 text-cyan-100" />
            </div>
            <DialogTitle className="text-xl text-white">Replay system coming next</DialogTitle>
            <DialogDescription className="leading-relaxed text-white/60">
              This mission does not have replay events available. Full replay controls are available for saved missions with recorded Mission Engine events.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setReplayComingOpen(false)} className="ml-auto rounded-full bg-cyan-300 text-[#06101f] hover:bg-cyan-200">
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Config Form ──────────────────────── */

function MissionTabs({ value, onValueChange }: { value?: string; onValueChange?: (value: string) => void }) {
  return (
    <Tabs value={value} onValueChange={onValueChange} defaultValue="workflow" className="w-full">
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

function MissionOutcomeCard({
  type,
  onStartNew,
  onViewReport,
}: {
  type: "completed" | "cancelled" | "failed";
  onStartNew: () => void;
  onViewReport: () => void;
}) {
  const context = useMissionStore((s) => s.context);
  const addHistory = useHistoryStore((s) => s.add);
  const runtimeInfo = getQwenRuntimeInfo();

  if (!context) return null;

  const reportMarkdown = context.finalReport ? reportToMarkdown(context.finalReport) : "";
  const confidence = context.efficiencyMetrics?.finalConfidenceScore ?? Math.round((context.workstreams.reduce((sum, item) => sum + (item.confidence ?? 0), 0) / Math.max(1, context.workstreams.length)) || 0);
  const title = type === "completed" ? "Mission Report Ready" : type === "cancelled" ? "Mission Cancelled" : "Mission Failed";
  const body = type === "completed"
    ? "Agent Society completed the mission and synthesized the final report."
    : type === "cancelled"
      ? "Execution stopped. Partial outputs remain available for review or saving."
      : "Execution failed. Partial mission data remains visible for diagnosis.";

  const saveCurrent = () => {
    addHistory({
      id: context.missionId || generateId(),
      missionBrief: context.missionBrief,
      configuration: context.configuration,
      timestamp: new Date().toISOString(),
      savedAt: new Date().toISOString(),
      startedAt: context.startedAt,
      completedAt: context.completedAt,
      workstreams: context.workstreams,
      dialogue: context.dialogue,
      timeline: context.timeline,
      conflicts: context.conflicts.map((conflict) => ({ description: conflict.description, resolution: conflict.resolution ?? conflict.mediatorDecision })),
      finalReport: context.finalReport,
      efficiencyMetrics: context.efficiencyMetrics,
      replayEvents: context.replayEvents,
    });
    toast({ title: type === "completed" ? "Mission saved" : "Partial mission saved", description: "Saved to local Mission History." });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-5 overflow-hidden rounded-[1.75rem] border p-5 shadow-[0_30px_100px_rgba(0,0,0,0.25)] backdrop-blur-2xl ${type === "completed" ? "border-emerald-300/20 bg-emerald-300/[0.06]" : "border-amber-300/20 bg-amber-300/[0.06]"}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4">
          <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl border ${type === "completed" ? "border-emerald-300/25 bg-emerald-300/10" : "border-amber-300/25 bg-amber-300/10"}`}>
            {type === "completed" ? <CheckCircle2 className="h-6 w-6 text-emerald-200" /> : <ShieldAlert className="h-6 w-6 text-amber-200" />}
          </div>
          <div>
            <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/10">{runtimeInfo.provider} Mode</Badge>
            <h3 className="mt-3 text-2xl font-bold text-white">{title}</h3>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/62">{body}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/45">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Confidence {confidence}%</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{context.workstreams.length} workstreams</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{new Date(context.completedAt ?? Date.now()).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {context.finalReport && (
            <>
              <Button onClick={onViewReport} className="gap-2 bg-cyan-300 text-[#06101f] hover:bg-cyan-200"><FileText className="h-4 w-4" /> View Report</Button>
              <Button variant="outline" onClick={() => downloadText("agent-society-report.md", reportMarkdown, "text/markdown")} className="gap-2 border-white/10 bg-white/[0.04] text-white/70"><Download className="h-4 w-4" /> Export Markdown</Button>
            </>
          )}
          <Button variant="outline" onClick={saveCurrent} className="gap-2 border-white/10 bg-white/[0.04] text-white/70"><Save className="h-4 w-4" /> {type === "completed" ? "Save Mission" : "Save Partial Mission"}</Button>
          {type !== "completed" && (
            <Button variant="outline" disabled className="gap-2 border-white/10 bg-white/[0.03] text-white/35"><RotateCcw className="h-4 w-4" /> Resume if possible</Button>
          )}
          <Button variant="outline" onClick={onStartNew} className="gap-2 border-purple-300/20 bg-purple-400/10 text-purple-100"><Zap className="h-4 w-4" /> Start New Mission</Button>
          {type !== "completed" && (
            <Button variant="outline" onClick={onStartNew} className="border-red-300/20 bg-red-400/10 text-red-100">Discard Mission</Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ConfigForm({ config, onChange, onApply, onReset }: { config: Partial<MissionConfiguration>; onChange: (c: Partial<MissionConfiguration>) => void; onApply: () => void; onReset: () => void }) {
  return (
    <div className="relative mt-4 space-y-4 px-1 pb-5">
      <div className="rounded-2xl border border-cyan-200/10 bg-white/[0.045] p-4 shadow-inner shadow-cyan-950/20">
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/50">Mission shape</p>
        <div className="mt-4 space-y-4">
          <ConfigSelect icon={<Target className="h-4 w-4" />} label="Mission Type" value={config.missionType ?? "general-mission"} options={MISSION_TYPE_LABELS} onChange={(v) => onChange({ ...config, missionType: v as MissionType })} />
          <ConfigSelect icon={<Zap className="h-4 w-4" />} label="Depth" value={config.depth ?? "balanced"} options={DEPTH_LABELS} onChange={(v) => onChange({ ...config, depth: v as Depth })} />
          <ConfigSelect icon={<SlidersHorizontal className="h-4 w-4" />} label="Output Format" value={config.outputFormat ?? "execution-roadmap"} options={OUTPUT_FORMAT_LABELS} onChange={(v) => onChange({ ...config, outputFormat: v as OutputFormat })} />
        </div>
      </div>
      <div className="rounded-2xl border border-purple-200/10 bg-purple-400/[0.045] p-4 shadow-inner shadow-purple-950/20">
        <p className="text-xs uppercase tracking-[0.22em] text-purple-100/50">Operational constraints</p>
        <div className="mt-4 space-y-4">
          <ConfigSelect icon={<Clock3 className="h-4 w-4" />} label="Time Horizon" value={config.timeHorizon ?? "30-days"} options={TIME_HORIZON_LABELS} onChange={(v) => onChange({ ...config, timeHorizon: v as TimeHorizon })} />
          <ConfigSelect icon={<WalletCards className="h-4 w-4" />} label="Budget Range" value={config.budgetRange ?? "none"} options={BUDGET_RANGE_LABELS} onChange={(v) => onChange({ ...config, budgetRange: v as BudgetRange })} />
          <ConfigSelect icon={<ShieldAlert className="h-4 w-4" />} label="Risk Tolerance" value={config.riskTolerance ?? "balanced"} options={RISK_TOLERANCE_LABELS} onChange={(v) => onChange({ ...config, riskTolerance: v as RiskTolerance })} />
        </div>
      </div>
      <div className="flex gap-2 border-t border-cyan-200/10 pt-5">
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

function ConfigSelect<T extends string>({ icon, label, value, options, onChange }: { icon: ReactNode; label: string; value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[170px_1fr] sm:items-center">
      <Label className="flex items-center gap-2 text-white/70">
        <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[0.055] text-cyan-100">{icon}</span>
        {label}
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className="h-11 border-cyan-200/15 bg-black/25 text-white shadow-inner shadow-black/20 hover:border-cyan-200/35 focus:ring-cyan-300/20">
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
