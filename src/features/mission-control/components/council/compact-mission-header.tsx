"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { PauseCircle, ShieldCheck, Timer, UsersRound } from "lucide-react";
import { AGENT_DEFINITIONS } from "@/agents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useMissionStore, useReplayStore } from "@/store";
import { MissionState, type AgentRole } from "@/types";

function formatElapsed(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function elapsed(startedAt?: string | null, completedAt?: string | null, currentTime = Date.now(), replayTime?: number) {
  if (typeof replayTime === "number") return formatElapsed(replayTime);
  if (!startedAt) return "00:00";
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return "00:00";
  const end = completedAt ? new Date(completedAt).getTime() : currentTime;
  if (!Number.isFinite(end)) return "00:00";
  return formatElapsed(end - start);
}

export function CompactMissionHeader({ involvedAgents, onCancel }: { involvedAgents: AgentRole[]; onCancel: () => void }) {
  const context = useMissionStore((s) => s.context);
  const replayMode = useReplayStore((s) => s.mode);
  const replayTime = useReplayStore((s) => s.replayTime);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const status = context?.status ?? MissionState.Idle;
  const progress = Math.round((context?.progress ?? 0) * 100);
  const completed = status === MissionState.Completed;
  const terminal = completed || status === MissionState.Cancelled || status === MissionState.Failed;
  const agentDetails = useMemo(
    () => involvedAgents.map((role) => AGENT_DEFINITIONS.find((agent) => agent.role === role)).filter(Boolean),
    [involvedAgents],
  );

  useEffect(() => {
    if (!context?.startedAt || terminal || replayMode === "replay") return;
    const interval = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [context?.startedAt, replayMode, terminal]);

  if (!context) return null;

  return (
    <motion.header
      data-compact-mission-header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative top-3 z-30 overflow-visible rounded-[1.45rem] border border-cyan-200/15 bg-[#07111f]/78 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/10">
              {completed ? "Mission Report Ready" : "Agent Council Running"}
            </Badge>
            <Badge className={completed ? "bg-emerald-300/15 text-emerald-100" : "bg-purple-300/15 text-purple-100"}>
              {status.replace(/-/g, " ")}
            </Badge>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/68">{context.missionBrief}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:w-[430px]">
          <Metric
            icon={<UsersRound className="h-4 w-4" />}
            label="Involved agents"
            value={String(agentDetails.length)}
            hoverContent={agentDetails.length ? (
              <div className="space-y-2">
                {agentDetails.map((agent) => agent && (
                  <div key={agent.role} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: agent.color, boxShadow: `0 0 12px ${agent.color}` }} />
                    <span>{agent.name}</span>
                  </div>
                ))}
              </div>
            ) : <span>No agents recorded yet.</span>}
          />
          <Metric
            icon={<Timer className="h-4 w-4" />}
            label="Elapsed"
            value={elapsed(context.startedAt, terminal ? context.completedAt : null, nowTick, replayMode === "replay" ? replayTime : undefined)}
          />
          <Metric icon={<ShieldCheck className="h-4 w-4" />} label="Progress" value={`${progress}%`} />
        </div>

        <div className="flex gap-2">
          {!completed && (
            <Button variant="outline" onClick={onCancel} className="gap-2 rounded-full border-red-300/25 bg-red-400/10 text-red-100 hover:bg-red-400/15">
              <PauseCircle className="h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>
      </div>
      <Progress value={progress} className="mt-4 h-1.5 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-cyan-300 [&>div]:to-purple-400" />
    </motion.header>
  );
}

function Metric({ icon, label, value, hoverContent }: { icon: ReactNode; label: string; value: string; hoverContent?: ReactNode }) {
  return (
    <div className="group relative rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2">
      <div className="flex items-center gap-2 text-white/45">
        <span className="text-cyan-100/80">{icon}</span>
        <span className="text-[0.66rem] uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
      {hoverContent && (
        <div className="pointer-events-none absolute right-0 top-[calc(100%+0.6rem)] z-[999] min-w-48 rounded-2xl border border-cyan-200/15 bg-[#07111f]/96 p-3 text-xs text-white/72 opacity-0 shadow-[0_20px_70px_rgba(34,211,238,0.18)] backdrop-blur-2xl transition duration-200 group-hover:opacity-100">
          {hoverContent}
        </div>
      )}
    </div>
  );
}
