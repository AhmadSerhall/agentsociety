"use client";

import { motion } from "framer-motion";
import {
  Bot,
  Cpu,
  FileText,
  History,
  LayoutDashboard,
  RadioTower,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type MissionView = "mission-control" | "agents" | "history" | "reports" | "settings";

export const MISSION_NAV_ITEMS = [
  { id: "mission-control", label: "Mission Control", icon: LayoutDashboard },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "history", label: "Mission History", icon: History },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
] satisfies Array<{
  id: MissionView;
  label: string;
  icon: typeof LayoutDashboard;
}>;

function SidebarContent({
  activeView,
  onViewChange,
}: {
  activeView: MissionView;
  onViewChange: (view: MissionView) => void;
}) {
  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-cyan-200/15 bg-gradient-to-br from-cyan-300/10 via-white/[0.045] to-purple-400/10 p-4 shadow-[0_22px_70px_rgba(34,211,238,0.12)]">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
        <div className="flex items-center gap-3">
        <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 shadow-[0_0_28px_rgba(34,211,238,0.24)]">
          <Sparkles className="h-5 w-5 text-cyan-200" />
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
            Agent
          </p>
          <h2 className="text-lg font-bold text-white">Society</h2>
        </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-white/48">
          <RadioTower className="h-3.5 w-3.5 text-emerald-200" />
          System pulse nominal
        </div>
      </div>

      <nav className="mt-8 space-y-2">
        {MISSION_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeView;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              className={cn(
                "group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3 py-3 text-left text-sm transition-all",
                active
                  ? "border-cyan-300/35 bg-cyan-300/10 text-white shadow-[0_0_34px_rgba(34,211,238,0.16)]"
                  : "border-transparent text-white/52 hover:border-cyan-200/15 hover:bg-white/[0.05] hover:text-white hover:shadow-[0_0_28px_rgba(34,211,238,0.08)]"
              )}
            >
              {active && <motion.span layoutId="sidebar-active" className="absolute left-0 top-2 h-8 w-1 rounded-r-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.85)]" />}
              <Icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  active ? "text-cyan-200" : "text-white/38 group-hover:text-purple-200"
                )}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-purple-300/15 bg-gradient-to-br from-purple-500/10 via-cyan-400/5 to-transparent p-4 shadow-[0_20px_70px_rgba(168,85,247,0.08)]">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-purple-200/70">
          <Cpu className="h-3.5 w-3.5" />
          Command Layer
        </div>
        <p className="mt-2 text-sm leading-6 text-white/62">
          War Room view keeps planning, dialogue, risks, and synthesis visible while agents execute.
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div className="h-full w-2/3 rounded-full bg-gradient-to-r from-cyan-300 to-purple-300" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.4, repeat: Infinity }} />
        </div>
      </div>
    </>
  );
}

export function MissionSidebar({
  activeView,
  onViewChange,
}: {
  activeView: MissionView;
  onViewChange: (view: MissionView) => void;
}) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-cyan-300/10 bg-[#050914]/70 px-4 py-5 shadow-[24px_0_80px_rgba(6,182,212,0.08)] backdrop-blur-2xl [scrollbar-color:rgba(34,211,238,0.55)_transparent] [scrollbar-width:thin] lg:flex lg:flex-col"
    >
      <SidebarContent activeView={activeView} onViewChange={onViewChange} />
    </motion.aside>
  );
}

export function MissionSidebarContent({
  activeView,
  onViewChange,
}: {
  activeView: MissionView;
  onViewChange: (view: MissionView) => void;
}) {
  return <SidebarContent activeView={activeView} onViewChange={onViewChange} />;
}
