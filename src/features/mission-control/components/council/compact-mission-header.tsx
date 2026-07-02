"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { PauseCircle, RotateCcw, ShieldCheck, Timer, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useMissionStore } from "@/store";
import { MissionState } from "@/types";

function elapsed(startedAt?: string | null) {
  if (!startedAt) return "00:00";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

export function CompactMissionHeader({ activeAgents, onCancel, onStartNew }: { activeAgents: number; onCancel: () => void; onStartNew: () => void }) {
  const context = useMissionStore((s) => s.context);
  const status = context?.status ?? MissionState.Idle;
  const progress = Math.round((context?.progress ?? 0) * 100);
  const completed = status === MissionState.Completed;

  if (!context) return null;

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className=" top-3 z-30 overflow-hidden rounded-[1.45rem] border border-cyan-200/15 bg-[#07111f]/78 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
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
          <Metric icon={<UsersRound className="h-4 w-4" />} label="Active agents" value={String(activeAgents)} />
          <Metric icon={<Timer className="h-4 w-4" />} label="Elapsed" value={elapsed(context.startedAt)} />
          <Metric icon={<ShieldCheck className="h-4 w-4" />} label="Progress" value={`${progress}%`} />
        </div>

        <div className="flex gap-2">
          {completed ? (
            <Button onClick={onStartNew} className="gap-2 rounded-full bg-cyan-300 text-[#06101f] hover:bg-cyan-200">
              <RotateCcw className="h-4 w-4" />
              New Mission
            </Button>
          ) : (
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

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2">
      <div className="flex items-center gap-2 text-white/45">
        <span className="text-cyan-100/80">{icon}</span>
        <span className="text-[0.66rem] uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
