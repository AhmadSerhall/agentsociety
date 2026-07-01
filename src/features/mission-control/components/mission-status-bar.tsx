"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Activity, Bot, RadioTower, ShieldCheck } from "lucide-react";
import { MissionState } from "@/types";

function formatStatus(status?: MissionState) {
  if (!status || status === MissionState.Idle) return "Idle";
  return status
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusTone(status?: MissionState) {
  if (status === MissionState.Completed) return "border-emerald-300/30 bg-emerald-300/10 shadow-[0_0_28px_rgba(16,185,129,0.12)]";
  if (status === MissionState.Cancelled) return "border-amber-300/30 bg-amber-300/10 shadow-[0_0_28px_rgba(251,191,36,0.12)]";
  if (status === MissionState.Failed) return "border-red-300/30 bg-red-300/10 shadow-[0_0_28px_rgba(248,113,113,0.14)]";
  if (status && status !== MissionState.Idle) return "border-cyan-300/30 bg-cyan-300/10 shadow-[0_0_34px_rgba(34,211,238,0.18)]";
  return "border-white/8 bg-black/15";
}

export function MissionStatusBar({
  activeAgents,
  status,
  mode,
}: {
  activeAgents: number;
  status?: MissionState;
  mode: "Mock" | "Qwen";
}) {
  const items = [
    { label: "System", value: "Operational", icon: ShieldCheck, accent: "text-emerald-300" },
    { label: "Active Agents", value: `${activeAgents}/9`, icon: Bot, accent: "text-cyan-200" },
    { label: "Mission Status", value: formatStatus(status), icon: Activity, accent: "text-purple-200", statusCard: true },
    { label: "Mode", value: mode, icon: RadioTower, accent: "text-cyan-200" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: "easeOut" }}
      className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:grid-cols-2 xl:grid-cols-4"
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.32 }}
            whileHover={{ y: -2, scale: 1.01 }}
            className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all hover:border-cyan-200/25 hover:bg-white/[0.065] ${item.statusCard ? statusTone(status) : "border-white/8 bg-black/15"}`}
          >
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.06] transition group-hover:scale-105">
              <Icon className={`h-4 w-4 ${item.accent}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[0.66rem] uppercase tracking-[0.18em] text-white/36">{item.label}</p>
              <AnimatePresence mode="popLayout">
                <motion.p
                  key={item.value}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="truncate text-sm font-semibold text-white"
                >
                  {item.value}
                </motion.p>
              </AnimatePresence>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
