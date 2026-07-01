"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  Bot,
  FileText,
  History,
  LayoutDashboard,
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
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 shadow-[0_0_28px_rgba(34,211,238,0.24)]">
          <Sparkles className="h-5 w-5 text-cyan-200" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
            Agent
          </p>
          <h2 className="text-lg font-bold text-white">Society</h2>
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
                "group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-all",
                active
                  ? "border-cyan-300/30 bg-cyan-300/10 text-white shadow-[0_0_34px_rgba(34,211,238,0.12)]"
                  : "border-transparent text-white/52 hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
              )}
            >
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

      <div className="mt-auto rounded-xl border border-purple-300/15 bg-gradient-to-br from-purple-500/10 via-cyan-400/5 to-transparent p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-purple-200/70">
          <BarChart3 className="h-3.5 w-3.5" />
          Command Layer
        </div>
        <p className="mt-2 text-sm leading-6 text-white/62">
          Multi-agent planning, debate, risk review, and synthesis are standing by.
        </p>
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
      className="hidden min-h-screen w-72 shrink-0 border-r border-cyan-300/10 bg-[#050914]/70 px-4 py-5 shadow-[24px_0_80px_rgba(6,182,212,0.08)] backdrop-blur-2xl lg:flex lg:flex-col"
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
