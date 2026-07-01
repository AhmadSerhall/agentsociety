"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AGENT_DEFINITIONS, getAgentByRole } from "@/agents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useMissionStore } from "@/store";
import { AgentRole, MissionState } from "@/types";
import { formatDuration, formatRelativeTime, sanitizeMissionText } from "@/utils";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock3, Loader2, RadioTower, Shield, X } from "lucide-react";
import { NetworkGraphPanel } from "@/panels";

const ORDER: AgentRole[] = [
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

function formatStatus(status?: MissionState) {
  return status?.replace(/-/g, " ") ?? "idle";
}

export function MissionWarRoom({ onCancel }: { onCancel: () => void }) {
  const context = useMissionStore((s) => s.context);
  const progress = context?.progress ?? 0;
  const activeAgent = context?.currentAgent ? getAgentByRole(context.currentAgent) : null;
  const elapsed = context?.startedAt ? Date.now() - new Date(context.startedAt).getTime() : 0;
  const workstreams = context?.workstreams ?? [];
  const dialogue = context?.dialogue ?? [];
  const conflicts = context?.conflicts ?? [];
  const timeline = context?.timeline ?? [];
  const metrics = context?.efficiencyMetrics;

  const activeWorkstream = useMemo(() => workstreams.find((item) => item.status === "in_progress"), [workstreams]);

  if (!context) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="rounded-[1.75rem] border border-cyan-200/15 bg-white/[0.055] p-4 shadow-[0_30px_100px_rgba(34,211,238,0.13)] backdrop-blur-2xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/10">Live Mission War Room</Badge>
            <h3 className="mt-3 truncate text-xl font-bold text-white">{context.missionBrief}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/45">
              <span className="capitalize">Phase: {formatStatus(context.status)}</span>
              <span>Active: {activeAgent?.name ?? "None"}</span>
              <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {formatDuration(elapsed)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-48">
              <div className="mb-1 flex justify-between text-xs text-white/45">
                <span>Mission Progress</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <Progress value={progress * 100} className="h-2 bg-white/10" />
            </div>
            <Button variant="outline" onClick={onCancel} className="gap-2 rounded-full border-red-300/20 bg-red-400/10 text-red-100 hover:bg-red-400/15">
              <X className="h-4 w-4" />
              Cancel Mission
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.4fr_0.9fr]">
        <div className="space-y-4">
          <WarCard title="Agent Workflow" icon={<RadioTower className="h-4 w-4" />}>
            <div className="space-y-2">
              {ORDER.map((role) => {
                const def = getAgentByRole(role);
                if (!def) return null;
                const state = context.agentStates[role] ?? "waiting";
                const active = context.currentAgent === role;
                return (
                  <motion.div
                    key={role}
                    layout
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition ${active ? "border-cyan-200/35 bg-cyan-300/10 shadow-[0_0_24px_rgba(34,211,238,0.16)]" : "border-white/10 bg-white/[0.025]"}`}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full border text-[0.65rem] font-bold text-white" style={{ borderColor: def.color, backgroundColor: `${def.color}33` }}>
                      {state === "complete" ? <CheckCircle2 className="h-4 w-4 text-emerald-200" /> : active ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: def.color }} /> : <CircleDashed className="h-4 w-4 text-white/35" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{def.name}</p>
                      <p className="text-xs capitalize text-white/38">{state}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </WarCard>

          <WarCard title="Workstreams" icon={<Shield className="h-4 w-4" />}>
            <div className="space-y-2">
              {workstreams.slice(0, 7).map((ws) => (
                <div key={ws.id} className={`rounded-xl border p-3 ${ws.status === "in_progress" ? "border-cyan-200/35 bg-cyan-300/10" : "border-white/10 bg-black/15"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-white">{sanitizeMissionText(ws.title)}</p>
                    <Badge variant="outline" className="shrink-0 border-white/10 bg-white/[0.04] text-[0.62rem] capitalize text-white/60">{ws.status.replace("_", " ")}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-white/42">{getAgentByRole(ws.assignedAgent ?? AgentRole.Planner)?.name ?? ws.owner ?? "Owner pending"}</p>
                  <Progress value={ws.confidence ?? 60} className="mt-2 h-1 bg-white/10" />
                </div>
              ))}
            </div>
          </WarCard>
        </div>

        <WarCard title="Live Agent Dialogue" icon={<RadioTower className="h-4 w-4" />}>
          <div className="max-h-[720px] space-y-3 overflow-hidden">
            <AnimatePresence initial={false}>
              {dialogue.slice(-6).map((entry, index) => {
                const def = getAgentByRole(entry.agentRole);
                return (
                  <motion.article
                    key={`${entry.agentId}-${entry.timestamp}-${index}`}
                    initial={{ opacity: 0, y: 14, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: def?.color ?? "#22d3ee" }}>{entry.agentName.slice(0, 2).toUpperCase()}</span>
                      <div>
                        <p className="text-sm font-semibold text-white">{entry.agentName}</p>
                        <p className="text-xs text-white/35">{formatRelativeTime(entry.timestamp)} · {entry.status ?? "complete"}</p>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-5 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/64">{sanitizeMissionText(entry.content)}</p>
                  </motion.article>
                );
              })}
            </AnimatePresence>
            {activeAgent && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 rounded-2xl border border-cyan-200/15 bg-cyan-300/10 p-3 text-sm text-cyan-100">
                <Loader2 className="h-4 w-4 animate-spin" />
                {activeAgent.name} is {context.agentStates[activeAgent.role] ?? "thinking"}...
              </motion.div>
            )}
          </div>
        </WarCard>

        <div className="space-y-4">
          <WarCard title="Conflict / Mediator" icon={<AlertTriangle className="h-4 w-4" />}>
            {conflicts.length ? (
              <div className="space-y-3">
                {conflicts.slice(-2).map((conflict) => (
                  <motion.div key={conflict.id} animate={{ boxShadow: conflict.resolved ? "0 0 0 rgba(16,185,129,0)" : "0 0 28px rgba(251,191,36,0.16)" }} className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{conflict.title ?? "Mission conflict"}</p>
                      <Badge className={conflict.resolved ? "bg-emerald-400/15 text-emerald-100" : "bg-amber-400/15 text-amber-100"}>{conflict.resolved ? "Resolved" : "Active"}</Badge>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-white/58">{sanitizeMissionText(conflict.disagreementSummary ?? conflict.description)}</p>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm italic text-white/42">Risk Critic has not raised a conflict yet.</p>
            )}
          </WarCard>

          <WarCard title="Mini Timeline" icon={<Clock3 className="h-4 w-4" />}>
            <div className="space-y-2">
              {timeline.slice(-5).map((entry, index) => (
                <div key={`${entry.timestamp}-${index}`} className="rounded-xl border border-white/10 bg-black/15 p-3">
                  <p className="text-sm font-medium text-white">{entry.label}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/45">{entry.description}</p>
                </div>
              ))}
            </div>
          </WarCard>

          <WarCard title="Confidence" icon={<CheckCircle2 className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-2">
              <MiniMetric label="Coverage" value={`${metrics?.taskCoverage ?? Math.round(progress * 100)}%`} />
              <MiniMetric label="Confidence" value={`${metrics?.finalConfidenceScore ?? activeWorkstream?.confidence ?? 0}%`} />
              <MiniMetric label="Conflicts" value={String(conflicts.length)} />
              <MiniMetric label="Streams" value={String(dialogue.length)} />
            </div>
          </WarCard>
        </div>
      </div>

      <WarCard title="Agent Constellation" icon={<RadioTower className="h-4 w-4" />}>
        <div className="h-[300px]">
          <NetworkGraphPanel />
        </div>
      </WarCard>
    </motion.section>
  );
}

function WarCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-cyan-200/10 bg-white/[0.045] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-cyan-100">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}
