/**
 * Agent Society — Mission Control
 *
 * The main experience. Single-page mission command center.
 */

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Rocket, Settings2, X,
  Brain, Search, Lightbulb, Cog, Megaphone, DollarSign,
  ShieldAlert, Scale, LayoutDashboard,
} from "lucide-react";
import { useMissionEngine } from "@/hooks";
import { useMissionStore } from "@/store";
import { useFadeInUp, useStaggerContainer } from "@/hooks";
import { isMockMode } from "@/services/qwen";
import { MISSION_STATE_ORDER, MISSION_TYPE_LABELS, DEPTH_LABELS, TIME_HORIZON_LABELS, BUDGET_RANGE_LABELS, RISK_TOLERANCE_LABELS, OUTPUT_FORMAT_LABELS, MissionState, MissionEventType, type MissionConfiguration, type MissionType, type Depth, type TimeHorizon, type BudgetRange, type RiskTolerance, type OutputFormat } from "@/types";
import {
  AgentWorkflowPanel, WorkstreamsPanel, DialoguePanel,
  ConflictPanel, ReportPanel, TimelinePanel, EfficiencyPanel,
  NetworkGraphPanel,
} from "@/panels";
import { toast } from "sonner";
import { SpaceBackground } from "@/components/space-background";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const ICONS: Record<string, React.ElementType> = {
  Brain, Search, Lightbulb, Cog, Megaphone, DollarSign, ShieldAlert, Scale, Rocket,
};

function getIcon(name: string): React.ElementType {
  return ICONS[name] ?? LayoutDashboard;
}

export function MissionControl() {
  const [brief, setBrief] = useState("");
  const [config, setConfig] = useState<Partial<MissionConfiguration>>({});
  const [showConfig, setShowConfig] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const { context, isRunning, launch, cancel } = useMissionEngine();
  const progress = useMissionStore((s) => s.context?.progress ?? 0);
  const status = useMissionStore((s) => s.context?.status);
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
    <div className="relative min-h-screen">
      <SpaceBackground />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 md:px-8">
        <motion.div
          className="space-y-8"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {/* Hero */}
          <motion.div variants={fadeUp} className="text-center pt-8 pb-4">
            <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
              Hello, Mission Operator
            </h1>
            <p className="mt-3 text-lg text-white/60">
              What complex objective are we solving today?
            </p>
          </motion.div>

          {/* Input Area */}
          <motion.div variants={fadeUp}>
            <div className="mx-auto max-w-3xl">
              <Textarea
                placeholder={
                  '"Launch an AI SaaS startup for restaurants in 30 days..."\n' +
                  '"Plan a full MVP and go-to-market strategy for an AI support platform..."\n' +
                  '"Create an execution roadmap for a modern ERP system..."'
                }
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                disabled={isRunning}
                rows={4}
                className="resize-none bg-white/5 border-white/10 text-white placeholder:text-white/30 text-base focus-visible:ring-white/20"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sheet open={showConfig} onOpenChange={setShowConfig}>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white">
                        <Settings2 className="h-3.5 w-3.5" />
                        Mission Config
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="border-white/10 bg-[#0c1425] text-white">
                      <SheetHeader>
                        <SheetTitle className="text-white">Mission Configuration</SheetTitle>
                      </SheetHeader>
                      <ConfigForm config={config} onChange={setConfig} />
                    </SheetContent>
                  </Sheet>
                  {mockMode && (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-xs">
                      Mock Mode
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isRunning && (
                    <Button variant="outline" size="sm" onClick={cancel} className="gap-1.5 border-white/10 text-white/70 hover:bg-white/10">
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  )}
                  <Button
                    onClick={handleLaunch}
                    disabled={isRunning}
                    size="sm"
                    className="gap-1.5 bg-white text-[#070b14] hover:bg-white/90 font-semibold"
                  >
                    <Rocket className="h-3.5 w-3.5" />
                    {isRunning ? "Mission Running..." : isComplete ? "Launch New Mission" : "Launch Mission"}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Progress Bar */}
          <AnimatePresence>
            {hasContent && (
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0 }}
                className="mx-auto max-w-3xl"
              >
                <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
                  <span className="capitalize">{status?.replace(/-/g, " ")}</span>
                  <span>{Math.round(progress * 100)}%</span>
                </div>
                <Progress value={progress * 100} className="h-1.5 bg-white/10" />
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
                  <TabsList className="bg-white/5 border border-white/10 w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 p-1">
                    <TabsTrigger value="workflow">Workflow</TabsTrigger>
                    <TabsTrigger value="workstreams">Workstreams</TabsTrigger>
                    <TabsTrigger value="dialogue">Dialogue</TabsTrigger>
                    <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
                    <TabsTrigger value="report">Final Report</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
                    <TabsTrigger value="network">Network</TabsTrigger>
                  </TabsList>

                  <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-4 md:p-6">
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
