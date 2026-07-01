"use client";

import { motion } from "framer-motion";
import { Activity, Bot, RadioTower, ShieldCheck } from "lucide-react";
import { MissionState } from "@/types";

function formatStatus(status?: MissionState) {
  if (!status || status === MissionState.Idle) return "Idle";
  return status
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
    { label: "Mission Status", value: formatStatus(status), icon: Activity, accent: "text-purple-200" },
    { label: "Mode", value: mode, icon: RadioTower, accent: "text-cyan-200" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: "easeOut" }}
      className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:grid-cols-2 xl:grid-cols-4"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/15 px-3 py-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.06]">
              <Icon className={`h-4 w-4 ${item.accent}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[0.66rem] uppercase tracking-[0.18em] text-white/36">{item.label}</p>
              <p className="truncate text-sm font-semibold text-white">{item.value}</p>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}
