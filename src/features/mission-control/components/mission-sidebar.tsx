"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  Cpu,
  FileText,
  History,
  LayoutDashboard,
  Play,
  RadioTower,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import agentCouncilLogo from "@/assets/agent council.png";
import { hasUsableQwenKey } from "@/lib/qwenConfig";
import { useHistoryStore, useMissionStore } from "@/store";
import {
  getQwenApiStatusLabel,
  isQwenApiStatusBlocking,
  useRuntimeSettingsStore,
  type QwenApiStatus,
} from "@/store/runtime-settings-store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type MissionView = "mission-control" | "agents" | "history" | "reports" | "settings";

type ConnectionPresence = "offline" | "connecting" | "online";

function resolveConnectionPresence(hasApiKey: boolean, status: QwenApiStatus): ConnectionPresence {
  if (!hasApiKey) return "offline";
  if (status === "connected") return "online";
  return "connecting";
}

const CONNECTION_DOT_CLASS: Record<ConnectionPresence, string> = {
  offline: "bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.95)]",
  connecting: "bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.95)]",
  online: "bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.95)]",
};

const CONNECTION_BADGE: Record<ConnectionPresence, { label: string; className: string; dotClassName: string }> = {
  offline: {
    label: "OFFLINE",
    className: "border-rose-200/25 bg-rose-400/10 text-rose-100",
    dotClassName: "bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.9)]",
  },
  connecting: {
    label: "LOADING",
    className: "border-amber-200/25 bg-amber-300/10 text-amber-100",
    dotClassName: "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)]",
  },
  online: {
    label: "ONLINE",
    className: "border-emerald-200/15 bg-emerald-300/10 text-emerald-100",
    dotClassName: "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]",
  },
};

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
  const historyEntries = useHistoryStore((state) => state.entries);
  const context = useMissionStore((state) => state.context);
  const qwenApiKey = useRuntimeSettingsStore((state) => state.qwenApiKey);
  const qwenApiStatus = useRuntimeSettingsStore((state) => state.qwenApiStatus);
  const hasApiKey = Boolean(qwenApiKey.trim()) || hasUsableQwenKey();
  const connectionPresence = resolveConnectionPresence(hasApiKey, qwenApiStatus);
  const runtimeBlocked = isQwenApiStatusBlocking(qwenApiStatus);
  const [activityIndex, setActivityIndex] = useState(0);
  const [hoveredNavItem, setHoveredNavItem] = useState<MissionView | null>(null);
  const activityFeed = useMemo(() => [
    "Planner initialized",
    runtimeBlocked ? `Qwen API ${getQwenApiStatusLabel(qwenApiStatus).toLocaleLowerCase()}` : hasApiKey ? "Runtime connected" : "Runtime waiting for key",
    context?.status === "completed" ? "Mission completed" : "Mission engine ready",
    historyEntries.length ? "Reports generated" : "Replay ready",
  ], [context?.status, hasApiKey, historyEntries.length, qwenApiStatus, runtimeBlocked]);

  useEffect(() => {
    const interval = window.setInterval(() => setActivityIndex((index) => (index + 1) % activityFeed.length), 3200);
    return () => window.clearInterval(interval);
  }, [activityFeed.length]);

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-cyan-200/15 bg-gradient-to-br from-cyan-300/10 via-white/[0.045] to-purple-400/10 p-4 shadow-[0_22px_70px_rgba(34,211,238,0.12)]">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
        <div className="flex items-center justify-start gap-3 text-left">
          <div className="relative h-12 w-12 shrink-0">
            <div className="grid h-full w-full place-items-center overflow-hidden rounded-2xl border border-cyan-300/30 bg-cyan-300/10 shadow-[0_0_28px_rgba(34,211,238,0.24)]">
              <img
                src={agentCouncilLogo.src}
                alt="Agent Council"
                className="h-full w-full object-cover"
              />
            </div>
            <span
              className={cn(
                "absolute -right-1 -top-1 z-10 h-3.5 w-3.5 rounded-full border-2 border-[#07111f]",
                CONNECTION_DOT_CLASS[connectionPresence],
              )}
            />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
              Agent
            </p>
            <h2 className="text-lg font-bold text-white">Council</h2>
          </div>
        </div>
        {/* <div className="mt-4 flex items-center gap-2 text-xs text-white/48">
          <RadioTower className="h-3.5 w-3.5 text-emerald-200" />
          System pulse nominal
        </div> */}
      </div>

      <nav className="mt-8 space-y-2">
        {MISSION_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeView;
          const highlighted = active || hoveredNavItem === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              onMouseEnter={() => setHoveredNavItem(item.id)}
              onMouseLeave={() => setHoveredNavItem(null)}
              style={highlighted ? {
                borderColor: "rgb(var(--agent-settings-accent) / 0.38)",
                backgroundColor: `rgb(var(--agent-settings-accent) / ${active ? "0.13" : "0.075"})`,
                boxShadow: `0 0 28px rgb(var(--agent-settings-accent) / ${active ? "0.18" : "0.1"})`,
              } : undefined}
              className={cn(
                "group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3 py-3 text-left text-sm transition-all",
                active
                  ? "text-white"
                  : "border-transparent text-white/52 hover:text-white"
              )}
            >
              {active && <motion.span layoutId="sidebar-active" className="absolute left-0 top-2 h-8 w-1 rounded-r-full" style={{ backgroundColor: "rgb(var(--agent-settings-accent))", boxShadow: "0 0 18px rgb(var(--agent-settings-accent) / 0.85)" }} />}
              <Icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  active ? "" : "text-white/38"
                )}
                style={highlighted ? { color: "rgb(var(--agent-settings-accent))" } : undefined}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <CommandLayerWidget
        activeView={activeView}
        onViewChange={onViewChange}
        connectionPresence={connectionPresence}
        runtimeConnected={hasApiKey}
        qwenApiStatus={qwenApiStatus}
        activity={activityFeed[activityIndex] ?? "Runtime ready"}
        historyCount={historyEntries.length}
        completedCount={historyEntries.filter((entry) => entry.finalReport).length}
      />
    </>
  );
}

function CommandLayerWidget({
  activeView,
  onViewChange,
  connectionPresence,
  runtimeConnected,
  qwenApiStatus,
  activity,
  historyCount,
  completedCount,
}: {
  activeView: MissionView;
  onViewChange: (view: MissionView) => void;
  connectionPresence: ConnectionPresence;
  runtimeConnected: boolean;
  qwenApiStatus: QwenApiStatus;
  activity: string;
  historyCount: number;
  completedCount: number;
}) {
  const runtimeBlocked = isQwenApiStatusBlocking(qwenApiStatus);
  const apiLabel = (() => {
    if (!runtimeConnected) return "Needs key";
    if (qwenApiStatus === "key-exhausted") return "Exhausted";
    if (qwenApiStatus === "connected") return "Connected";
    if (runtimeBlocked) return getQwenApiStatusLabel(qwenApiStatus);
    return "Ready";
  })();
  const runtimeLabel = connectionPresence === "online" ? "Healthy" : "Disabled";
  const badge = CONNECTION_BADGE[connectionPresence];
  const rows = [
    ["API", apiLabel, connectionPresence === "online"],
    ["Runtime", runtimeLabel, connectionPresence === "online"],
    // ["Mission Engine", "Ready", true],
    // ["Replay", "Ready", true],
    ["Agents", activeView === "mission-control" ? "Idle" : "Standby", true],
  ] as const;
  const actions: Array<{ label: string; view: MissionView; icon: typeof LayoutDashboard }> = [
    { label: "Launch Mission", view: "mission-control", icon: Play },
    { label: "Reports", view: "reports", icon: FileText },
    { label: "Agents", view: "agents", icon: Bot },
    { label: "History", view: "history", icon: History },
  ];

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-cyan-200/15 bg-gradient-to-br from-cyan-300/10 via-white/[0.045] to-purple-400/10 p-3 shadow-[0_20px_70px_rgba(6,182,212,0.12)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.2em] text-cyan-100/75">
          <Cpu className="h-3.5 w-3.5" />
          Command Layer
        </div>
        <span className={cn("flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold", badge.className)}>
          <span className={cn("h-1.5 w-1.5 animate-pulse rounded-full", badge.dotClassName)} />
          {badge.label}
        </span>
      </div>

      <div className="mt-3 grid gap-1.5">
        {rows.map(([label, value, ok]) => (
          <div key={label} className="flex items-center justify-between rounded-lg border border-white/8 bg-black/18 px-2 py-1.5 text-[0.68rem]">
            <span className="text-white/45">{label}</span>
            <span className={ok ? "text-cyan-100" : "text-amber-100"}>{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 text-[0.65rem]">
        {/* <MiniStat label="Latency" value={runtimeConnected ? "245ms" : "--"} />
        <MiniStat label="Memory" value="42%" /> */}
        <MiniStat label="Missions" value={String(historyCount)} />
        <MiniStat label="Complete" value={String(completedCount)} />
      </div>

      {/* <div className="mt-3 rounded-xl border border-cyan-200/10 bg-cyan-300/[0.045] px-2.5 py-2">
        <p className="text-[0.62rem] uppercase tracking-[0.18em] text-cyan-100/55">Live Activity</p>
        <motion.p key={activity} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-1 truncate text-xs text-white/72">
          {activity}
        </motion.p>
      </div> */}

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-purple-300" animate={{ width: ["42%", "78%", "58%"], opacity: [0.65, 1, 0.65] }} transition={{ duration: 3.2, repeat: Infinity }} />
      </div>

      {/* <div className="mt-3 flex items-center justify-between gap-1.5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Tooltip key={action.label}>
              <TooltipTrigger asChild>
                <button type="button" onClick={() => onViewChange(action.view)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.045] text-white/55 transition-all hover:border-cyan-200/25 hover:bg-cyan-300/10 hover:text-cyan-100 hover:shadow-[0_0_18px_rgba(34,211,238,0.16)]">
                  <Icon className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{action.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div> */}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/18 px-2 py-1.5">
      <p className="text-white/35">{label}</p>
      <p className="mt-0.5 font-semibold text-white/80">{value}</p>
    </div>
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
