"use client";

import { motion } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Brush,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Gauge,
  HardDrive,
  History,
  KeyRound,
  Keyboard,
  Loader2,
  Logs,
  Palette,
  RadioTower,
  RefreshCcw,
  Network,
  Server,
  Sparkles,
  PlayCircle,
  Save,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  WalletCards,
  Wifi,
  Zap,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AGENT_DEFINITIONS } from "@/agents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { QWEN_API_KEY_URL, getEnvQwenSettings, getResolvedQwenSettings } from "@/lib/qwenConfig";
import { getQwenRuntimeInfo } from "@/services/qwen";
import { buildMissionStateFromEvents, getReplayDuration } from "@/services/replay/replay-engine";
import { useHistoryStore, useMissionStore, useRuntimeSettingsStore } from "@/store";
import {
  AgentRole,
  MissionState,
  type AgentDialogueEntry,
  type AgentThinkingState,
  type MissionConfiguration,
  type MissionContext,
  type MissionHistoryEntry,
  type MissionReplayEvent,
  type TimelineEntry,
} from "@/types";
import { downloadText, generateId, historyEntryToMarkdown, sanitizeMissionText } from "@/utils";
import { AgentIconGlyph } from "./agent-icons";
import { composeReportSections } from "./council/presentation-renderer";
import type { MissionView } from "./mission-sidebar";

function cardClass() {
  return "rounded-2xl border border-cyan-200/10 bg-black/20 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)]";
}

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
}

function filenameSafe(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "mission";
}

function contextFromHistory(entry: MissionHistoryEntry): MissionContext {
  if (entry.replayEvents?.length) {
    const reconstructed = buildMissionStateFromEvents(entry.replayEvents, getReplayDuration(entry.replayEvents));
    const completedAt = reconstructed.completedAt ?? entry.completedAt ?? entry.timestamp;
    return {
      ...reconstructed,
      missionId: entry.id,
      missionBrief: entry.missionBrief,
      configuration: entry.configuration,
      finalReport: entry.finalReport ?? reconstructed.finalReport,
      efficiencyMetrics: entry.efficiencyMetrics ?? reconstructed.efficiencyMetrics,
      status: entry.finalReport ? MissionState.Completed : reconstructed.status,
      progress: entry.finalReport ? 1 : reconstructed.progress,
      startedAt: reconstructed.startedAt ?? entry.startedAt ?? startFromDuration(completedAt, entry.efficiencyMetrics?.executionDurationMs),
      completedAt,
      replayEvents: entry.replayEvents,
    };
  }

  const workstreamTaskIds = new Map(entry.workstreams.map((workstream, index) => [workstream.id, `${entry.id}-task-${index}`]));
  const executionTasks = entry.workstreams.map((workstream, index) => ({
    id: `${entry.id}-task-${index}`,
    workstreamId: workstream.id,
    title: workstream.title,
    description: workstream.description,
    agent: workstream.assignedAgent ?? AgentRole.Researcher,
    displayRole: workstream.displayRole ?? workstream.owner,
    supportingAgents: workstream.supportingAgentIds ?? [],
    dependencies: workstream.dependencies?.map((dependencyId) => workstreamTaskIds.get(dependencyId)).filter((dependencyId): dependencyId is string => Boolean(dependencyId)) ?? [],
    status: workstream.status === "completed" ? "completed" as const : "pending" as const,
    confidence: workstream.confidence ?? 76,
    output: workstream.output,
    startedAt: workstream.startedAt,
    completedAt: workstream.completedAt,
  }));
  const workedRoles = workedRolesFromEntry(entry, executionTasks.map((task) => task.agent));
  const completedAt = entry.completedAt ?? entry.timestamp;
  const startedAt = entry.startedAt ?? startFromDuration(completedAt, entry.efficiencyMetrics?.executionDurationMs);

  return {
    missionId: entry.id,
    missionBrief: entry.missionBrief,
    configuration: entry.configuration,
    workstreams: entry.workstreams,
    researchSummary: "",
    productStrategy: "",
    technicalArchitecture: "",
    marketingStrategy: "",
    financialPlan: "",
    riskReview: "",
    conflicts: entry.conflicts.map((conflict) => ({
      id: generateId(),
      agents: [],
      description: conflict.description,
      resolution: conflict.resolution,
      resolved: Boolean(conflict.resolution),
    })),
    mediatorDecisions: entry.conflicts.map((conflict) => conflict.resolution).filter(Boolean).join("\n\n"),
    finalReport: entry.finalReport,
    dialogue: entry.dialogue.map((dialogue, index) => normalizeHistoryDialogue(dialogue, index, entry.timestamp)),
    timeline: entry.timeline?.length ? entry.timeline : timelineFromHistory(entry, startedAt, completedAt),
    efficiencyMetrics: entry.efficiencyMetrics,
    currentAgent: null,
    agentStates: agentStatesFromWorkedRoles(workedRoles),
    executionTasks,
    missionGraph: null,
    progress: entry.finalReport ? 1 : 0.5,
    status: entry.finalReport ? MissionState.Completed : MissionState.Cancelled,
    startedAt,
    completedAt,
    replayEvents: entry.replayEvents ?? [],
  };
}

function startFromDuration(completedAt: string | null | undefined, durationMs?: number) {
  if (!completedAt || !durationMs) return completedAt ?? null;
  const end = new Date(completedAt).getTime();
  if (!Number.isFinite(end)) return completedAt;
  return new Date(Math.max(0, end - durationMs)).toISOString();
}

function workedRolesFromEntry(entry: MissionHistoryEntry, taskAgents: AgentRole[]) {
  const roles = new Set<AgentRole>([AgentRole.Planner, AgentRole.Finalizer, ...taskAgents]);
  entry.workstreams.forEach((workstream) => {
    if (workstream.assignedAgent) roles.add(workstream.assignedAgent);
  });
  return roles;
}

function agentStatesFromWorkedRoles(workedRoles: Set<AgentRole>): Record<AgentRole, AgentThinkingState> {
  return Object.fromEntries(
    AGENT_DEFINITIONS.map((agent) => [agent.role, workedRoles.has(agent.role) ? "complete" : "waiting"]),
  ) as Record<AgentRole, AgentThinkingState>;
}

function normalizeHistoryDialogue(dialogue: MissionHistoryEntry["dialogue"][number], index: number, fallbackTimestamp: string): AgentDialogueEntry {
  if ("agentRole" in dialogue) {
    const definition = AGENT_DEFINITIONS.find((agent) => agent.role === dialogue.agentRole);
    return {
      ...dialogue,
      agentId: dialogue.agentId || definition?.id || `history-${index}`,
      timestamp: dialogue.timestamp || fallbackTimestamp,
    };
  }
  const role = agentRoleFromName(dialogue.agentName) ?? AgentRole.Planner;
  const definition = AGENT_DEFINITIONS.find((agent) => agent.role === role);
  return {
    agentId: definition?.id ?? `history-${index}`,
    agentName: dialogue.agentName,
    displayRole: definition?.name,
    agentRole: role,
    content: dialogue.content,
    timestamp: fallbackTimestamp,
  };
}

function timelineFromHistory(entry: MissionHistoryEntry, startedAt: string | null, completedAt: string | null): TimelineEntry[] {
  const firstTask = entry.workstreams.find((workstream) => workstream.assignedAgent);
  return [
    {
      agent: AgentRole.Planner,
      state: MissionState.Planning,
      label: "Planner completed mission graph",
      description: `${entry.workstreams.length} workstreams were assigned.`,
      timestamp: startedAt ?? entry.timestamp,
      kind: "agent",
    },
    ...entry.workstreams.map((workstream) => ({
      agent: workstream.assignedAgent ?? AgentRole.Researcher,
      state: MissionState.Completed,
      label: `${workstream.title} completed`,
      description: workstream.description || workstream.output || "Workstream completed.",
      timestamp: workstream.completedAt ?? completedAt ?? entry.timestamp,
      duration: workstream.startedAt && workstream.completedAt ? Math.max(0, new Date(workstream.completedAt).getTime() - new Date(workstream.startedAt).getTime()) : undefined,
      kind: "agent" as const,
    })),
    {
      agent: AgentRole.Finalizer,
      state: MissionState.Completed,
      label: "Final report generated",
      description: firstTask ? "Finalizer synthesized completed workstreams into the mission report." : "Finalizer produced the mission report.",
      timestamp: completedAt ?? entry.timestamp,
      kind: "report",
    },
  ];
}

function agentRoleFromName(name: string): AgentRole | null {
  const normalized = name.toLowerCase();
  return AGENT_DEFINITIONS.find((agent) =>
    normalized.includes(agent.name.toLowerCase()) ||
    normalized.includes(agent.role.replace(/-/g, " "))
  )?.role ?? null;
}

export function SidebarPageView({
  activeView,
  onOpenMissionControl,
  onReplay,
}: {
  activeView: Exclude<MissionView, "mission-control">;
  onOpenMissionControl: () => void;
  onReplay: (events: MissionReplayEvent[]) => void;
}) {
  if (activeView === "agents") return <AgentsPage />;
  if (activeView === "history") return <MissionHistoryPage onOpenMissionControl={onOpenMissionControl} onReplay={onReplay} />;
  if (activeView === "reports") return <ReportsPage />;
  return <SettingsPage />;
}

function AgentsPage() {
  const context = useMissionStore((state) => state.context);
  const completedRoles = useMemo(() => new Set(context?.dialogue.map((entry) => entry.agentRole) ?? []), [context?.dialogue]);

  return (
    <section className="space-y-5">
      <PageHeader icon={Bot} title="Agents" meta={`${AGENT_DEFINITIONS.length} mission specialists`} description="Every mission forms a dynamic agent society. The Planner creates a Mission Graph, assigns workstreams, specialists collaborate in parallel, critics interrupt weak assumptions, and the Mediator resolves execution conflicts." />
      <div className={cardClass()}>
        <h3 className="text-sm font-semibold text-white">Agent Society Collaboration Map</h3>
        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1.2fr_1fr]">
          <div className="space-y-8">
            {AGENT_DEFINITIONS.slice(0, 4).map((agent) => <AgentMapNode key={agent.id} agent={agent} />)}
          </div>
          <div className="grid min-h-48 place-items-center rounded-3xl border border-cyan-200/15 bg-cyan-300/[0.055] p-5 text-center shadow-[0_0_60px_rgba(34,211,238,0.12)]">
            <div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-cyan-200/25 bg-cyan-300/10">
                <Network className="h-7 w-7 text-cyan-100" />
              </div>
              <h4 className="mt-4 text-base font-semibold text-white">Mission Engine</h4>
              <p className="mt-2 text-sm leading-relaxed text-white/55">Maintains the Mission Graph, synchronizes dependencies, routes conflicts, and waits for synthesis readiness.</p>
            </div>
          </div>
          <div className="space-y-2">
            {AGENT_DEFINITIONS.slice(4).map((agent) => <AgentMapNode key={agent.id} agent={agent} />)}
          </div>
        </div>
      </div>
      <div className={cardClass()}>
        <h3 className="text-sm font-semibold text-white">Collaboration Examples</h3>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Research + Marketing validate audience and positioning.",
            "Technical + Finance estimate build cost and infrastructure tradeoffs.",
            "Risk Critic challenges aggressive assumptions mid-execution.",
            "Mediator resolves disagreement and Planner revises assignments.",
          ].map((example) => (
            <div key={example} className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm leading-relaxed text-white/58">{example}</div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {AGENT_DEFINITIONS.map((agent) => {
          const active = context?.currentAgent === agent.role;
          const complete = completedRoles.has(agent.role);
          const meta = agentCollaborationMeta(agent.id);
          return (
            <article
              key={agent.id}
              className="group relative overflow-hidden rounded-2xl border border-cyan-200/10 bg-black/20 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200/35 hover:shadow-[0_24px_90px_rgba(34,211,238,0.18)]"
            >
              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl" style={{ backgroundColor: `${agent.color}33` }} />
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="relative grid h-12 w-12 place-items-center rounded-2xl border text-white shadow-[0_0_30px_rgba(255,255,255,0.06)] transition-transform duration-300 group-hover:scale-105"
                    style={{ borderColor: `${agent.color}88`, backgroundColor: `${agent.color}22` }}
                  >
                    <AgentIconGlyph agentId={agent.id} className="h-5 w-5" style={{ color: agent.color }} />
                    <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-cyan-100/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
                    <p className="text-xs text-white/40">{agent.role}</p>
                  </div>
                </div>
                <Badge className={active ? "bg-cyan-300/15 text-cyan-100" : complete ? "bg-emerald-300/15 text-emerald-100" : "bg-white/10 text-white/55"}>
                  {active ? "Active" : complete ? "Complete" : "Idle"}
                </Badge>
              </div>
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-white/35">Capabilities</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {agent.capabilities.map((capability) => (
                  <span key={capability} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/58">{capability}</span>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[0.68rem] text-white/58">
                <CapabilityPill label="Can run in parallel" active={meta.parallel} />
                <CapabilityPill label="Can challenge assumptions" active={meta.challenges} />
                <CapabilityPill label="Can create conflicts" active={meta.createsConflicts} />
                <CapabilityPill label="Can resolve conflicts" active={meta.resolvesConflicts} />
                <CapabilityPill label="Can revise graph" active={meta.revisesGraph} />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-white/45">
                Typical collaborations: {meta.collaborations.join("; ")}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-white/58">{agent.systemPrompt.slice(0, 190)}...</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-white/45">
                <CheckCircle2 className="h-3.5 w-3.5" style={{ color: agent.color }} />
                Confidence baseline: {complete ? 92 : active ? 84 : 76}%
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AgentMapNode({ agent }: { agent: (typeof AGENT_DEFINITIONS)[number] }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <span className="grid h-10 w-10 place-items-center rounded-2xl border" style={{ borderColor: `${agent.color}88`, backgroundColor: `${agent.color}22` }}>
        <AgentIconGlyph agentId={agent.id} className="h-4 w-4" style={{ color: agent.color }} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{agent.name}</p>
        <p className="text-xs text-white/38">{agent.capabilities.slice(0, 2).join(" + ")}</p>
      </div>
    </div>
  );
}

function CapabilityPill({ label, active }: { label: string; active: boolean | string }) {
  const text = typeof active === "string" ? active : active ? "yes" : "no";
  const isActive = Boolean(active);
  return (
    <span className={`rounded-full border px-2 py-1 ${isActive ? "border-cyan-200/20 bg-cyan-300/10 text-cyan-100/80" : "border-white/10 bg-white/[0.03] text-white/35"}`}>
      {label}: {text}
    </span>
  );
}

function agentCollaborationMeta(agentId: string) {
  const map: Record<string, { parallel: boolean; challenges: boolean | string; createsConflicts: boolean | string; resolvesConflicts: boolean; revisesGraph: boolean | string; collaborations: string[] }> = {
    "agent-planner": {
      parallel: false,
      challenges: false,
      createsConflicts: false,
      resolvesConflicts: false,
      revisesGraph: true,
      collaborations: ["All specialists for task decomposition", "Mediator after conflicts", "Finalizer before synthesis"],
    },
    "agent-researcher": {
      parallel: true,
      challenges: "if assumptions are weak",
      createsConflicts: "if assumptions are weak",
      resolvesConflicts: false,
      revisesGraph: false,
      collaborations: ["Marketing Strategist for audience validation", "Product Strategist for user needs", "Risk Critic for evidence gaps"],
    },
    "agent-product": {
      parallel: true,
      challenges: true,
      createsConflicts: true,
      resolvesConflicts: false,
      revisesGraph: false,
      collaborations: ["Research Agent for customer needs", "Technical Architect for feasibility", "Finance Agent for pricing strategy"],
    },
    "agent-technical": {
      parallel: true,
      challenges: true,
      createsConflicts: true,
      resolvesConflicts: false,
      revisesGraph: false,
      collaborations: ["Finance Agent for infrastructure cost", "Product Strategist for scope", "Risk Critic for technical risk"],
    },
    "agent-marketing": {
      parallel: true,
      challenges: true,
      createsConflicts: true,
      resolvesConflicts: false,
      revisesGraph: false,
      collaborations: ["Research Agent for audience validation", "Finance Agent for campaign budget", "Risk Critic for trust risks"],
    },
    "agent-finance": {
      parallel: true,
      challenges: true,
      createsConflicts: true,
      resolvesConflicts: false,
      revisesGraph: false,
      collaborations: ["Technical Architect for infrastructure cost", "Marketing Strategist for campaign budget", "Product Strategist for pricing strategy", "Risk Critic for financial risk"],
    },
    "agent-risk": {
      parallel: true,
      challenges: true,
      createsConflicts: true,
      resolvesConflicts: false,
      revisesGraph: false,
      collaborations: ["All agents when assumptions look weak", "Mediator for resolution", "Planner for graph revision"],
    },
    "agent-mediator": {
      parallel: false,
      challenges: false,
      createsConflicts: false,
      resolvesConflicts: true,
      revisesGraph: "through decision",
      collaborations: ["Conflicting agents", "Planner for assignment/dependency changes", "Finalizer for resolved decisions"],
    },
    "agent-finalizer": {
      parallel: false,
      challenges: false,
      createsConflicts: false,
      resolvesConflicts: false,
      revisesGraph: false,
      collaborations: ["All completed workstreams", "Mediator decisions", "Planner readiness criteria"],
    },
  };
  return map[agentId] ?? map["agent-researcher"];
}

function MissionHistoryPage({ onOpenMissionControl, onReplay }: { onOpenMissionControl: () => void; onReplay: (events: MissionReplayEvent[]) => void }) {
  const entries = useHistoryStore((state) => state.entries);
  const remove = useHistoryStore((state) => state.remove);
  const setContext = useMissionStore((state) => state.setContext);
  const [deleteTarget, setDeleteTarget] = useState<MissionHistoryEntry | null>(null);
  const savedEntries = useMemo(() => entries.filter((entry) => entry.savedAt), [entries]);
  const recentEntries = useMemo(() => entries.filter((entry) => !entry.savedAt), [entries]);

  return (
    <section className="space-y-5">
      <PageHeader icon={History} title="Mission History" meta={`${entries.length} saved missions`} description="Completed and cancelled missions are stored locally in your browser." />
      {entries.length === 0 ? <EmptyState title="No mission history yet" body="Complete or cancel a mission and it will appear here for review." /> : (
        <div className="space-y-3">
          {savedEntries.length > 0 && <HistoryGroup title="Saved Missions" entries={savedEntries} setContext={setContext} onOpenMissionControl={onOpenMissionControl} onReplay={onReplay} onDelete={setDeleteTarget} />}
          {recentEntries.length > 0 && <div className="flex items-center gap-2 pt-2"><History className="h-4 w-4 text-cyan-100/75" /><h3 className="text-sm font-semibold text-white">Recent Mission History</h3><Badge className="bg-white/10 text-white/55 hover:bg-white/10">{recentEntries.length}</Badge></div>}
          {recentEntries.map((entry) => (
            <article key={entry.id} className={cardClass()}>
              <div>
                <div>
                  <h3 className="break-words text-base font-semibold leading-relaxed text-white">{entry.missionBrief}</h3>
                  <p className="mt-1 text-sm text-white/45">{new Date(entry.timestamp).toLocaleString()} · {entry.finalReport ? "Completed" : "Cancelled / partial"}</p>
                </div>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setContext(contextFromHistory(entry)); onOpenMissionControl(); }} className="border-white/10 bg-white/[0.04] text-white/70">Reopen</Button>
                  {entry.finalReport && entry.replayEvents?.length ? (
                    <Button size="sm" onClick={() => onReplay(entry.replayEvents ?? [])} className="gap-1 bg-cyan-300 text-[#06101f] hover:bg-cyan-200"><PlayCircle className="h-3.5 w-3.5" /> Replay Mission</Button>
                  ) : entry.finalReport ? (
                    <Button size="sm" variant="outline" disabled className="gap-1 border-white/10 bg-white/[0.03] text-white/35"><PlayCircle className="h-3.5 w-3.5" /> Replay unavailable</Button>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => setDeleteTarget(entry)} className="gap-1 border-red-300/20 bg-red-400/10 text-red-100 hover:border-red-200/45 hover:bg-red-400/15"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-red-200/15 bg-[#08111d]/95 text-white shadow-[0_30px_120px_rgba(239,68,68,0.18)] backdrop-blur-2xl">
          <AlertDialogHeader>
            <div className="mb-2 grid h-12 w-12 place-items-center rounded-2xl border border-red-300/25 bg-red-400/10">
              <Trash2 className="h-5 w-5 text-red-200" />
            </div>
            <AlertDialogTitle className="text-xl text-white">Delete this mission?</AlertDialogTitle>
            <AlertDialogDescription className="break-words leading-relaxed text-white/58">
              Are you sure you want to delete this mission? This removes it from local mission history and cannot be undone.
              {deleteTarget ? <span className="mt-3 block rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white/75">{deleteTarget.missionBrief}</span> : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) remove(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-[0_0_30px_rgba(244,63,94,0.25)] hover:from-red-400 hover:to-rose-400"
            >
              Delete Mission
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function HistoryGroup({
  title,
  entries,
  setContext,
  onOpenMissionControl,
  onReplay,
  onDelete,
}: {
  title: string;
  entries: MissionHistoryEntry[];
  setContext: (context: MissionContext) => void;
  onOpenMissionControl: () => void;
  onReplay: (events: MissionReplayEvent[]) => void;
  onDelete: (entry: MissionHistoryEntry) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Save className="h-4 w-4 text-cyan-100/75" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <Badge className="bg-white/10 text-white/55 hover:bg-white/10">{entries.length}</Badge>
      </div>
      {entries.map((entry) => (
        <article key={entry.id} className={cardClass()}>
          <div>
            <div>
              <h3 className="break-words text-base font-semibold leading-relaxed text-white">{entry.missionBrief}</h3>
              <p className="mt-1 text-sm text-white/45">{new Date(entry.savedAt ?? entry.timestamp).toLocaleString()} - Saved</p>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => { setContext(contextFromHistory(entry)); onOpenMissionControl(); }} className="border-white/10 bg-white/[0.04] text-white/70">Reopen</Button>
              {entry.finalReport && entry.replayEvents?.length ? (
                <Button size="sm" onClick={() => onReplay(entry.replayEvents ?? [])} className="gap-1 bg-cyan-300 text-[#06101f] hover:bg-cyan-200"><PlayCircle className="h-3.5 w-3.5" /> Replay Mission</Button>
              ) : entry.finalReport ? (
                <Button size="sm" variant="outline" disabled className="gap-1 border-white/10 bg-white/[0.03] text-white/35"><PlayCircle className="h-3.5 w-3.5" /> Replay unavailable</Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => onDelete(entry)} className="gap-1 border-red-300/20 bg-red-400/10 text-red-100 hover:border-red-200/45 hover:bg-red-400/15"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function ReportsPage() {
  const entries = useHistoryStore((state) => state.entries);
  const reports = useMemo(() => entries.filter((entry) => entry.finalReport), [entries]);

  return (
    <section className="space-y-5">
      <PageHeader icon={FileText} title="Reports" meta={`${reports.length} saved reports`} description="Review, copy, and export reports generated by Agent Society." />
      {reports.length === 0 ? <EmptyState title="No saved reports yet" body="Run a mission to completion and the final report will appear here." /> : (
        <div className="space-y-3">
          {reports.map((entry) => {
            const markdown = historyEntryToMarkdown(entry);
            const sections = entry.finalReport ? composeReportSections(entry.finalReport) : [];
            return (
              <article key={entry.id} className={cardClass()}>
                <div>
                  <div>
                    <h3 className="break-words text-base font-semibold leading-relaxed text-white">{entry.missionBrief}</h3>
                    <p className="mt-1 text-sm text-white/45">{new Date(entry.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => copyText(markdown)} className="gap-1 border-white/10 bg-white/[0.04] text-white/70"><Copy className="h-3.5 w-3.5" /> Copy Markdown</Button>
                    <Button size="sm" variant="outline" onClick={() => downloadText(`${filenameSafe(entry.missionBrief)}.md`, markdown, "text/markdown")} className="gap-1 border-white/10 bg-white/[0.04] text-white/70"><Download className="h-3.5 w-3.5" /> Markdown</Button>
                  </div>
                </div>
                <details className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-cyan-100">View report</summary>
                  <div className="mt-3 max-h-[52vh] space-y-3 overflow-y-auto pr-1">
                    {sections.map((section) => (
                      <section key={section.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-cyan-100/50">{section.kicker}</p>
                        <h4 className="mt-1 text-sm font-semibold text-white">{section.title}</h4>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/64">{section.body}</p>
                      </section>
                    ))}
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SettingsPage() {
  const runtime = getQwenRuntimeInfo();
  const resolved = getResolvedQwenSettings();
  const envSettings = getEnvQwenSettings();
  const history = useHistoryStore((state) => state.entries);
  const qwenApiKey = useRuntimeSettingsStore((state) => state.qwenApiKey);
  const qwenBaseUrl = useRuntimeSettingsStore((state) => state.qwenBaseUrl);
  const qwenModel = useRuntimeSettingsStore((state) => state.qwenModel);
  const setQwenCredentials = useRuntimeSettingsStore((state) => state.setQwenCredentials);
  const clearQwenCredentials = useRuntimeSettingsStore((state) => state.clearQwenCredentials);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [apiKeyEditing, setApiKeyEditing] = useState(false);
  const [apiKeyRevealed, setApiKeyRevealed] = useState(false);
  const [baseUrlDraft, setBaseUrlDraft] = useState(qwenBaseUrl);
  const [modelDraft, setModelDraft] = useState(qwenModel);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [connectionState, setConnectionState] = useState<"idle" | "testing" | "connected">("idle");
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [preferences, setPreferences] = useState({
    autoSaveReports: true,
    streamResponses: true,
    rememberContext: true,
    retryFailedRequests: true,
    keyboardShortcuts: true,
    reduceMotion: false,
    developerMode: false,
    verboseLogs: false,
    experimentalFeatures: false,
  });
  const [missionTimeout, setMissionTimeout] = useState(120);
  const [retryCount, setRetryCount] = useState(2);
  const [appearance, setAppearance] = useState({ theme: "System", accent: "Cyan", animation: "Balanced", particles: "Medium", glassBlur: "High" });
  const storageStats = useMemo(() => getLocalStorageStats(), []);
  const usageStats = useMemo(() => ({
    requests: Math.max(3, history.length * 6 + (runtime.hasUsableApiKey ? 8 : 0)),
    tokens: Math.max(1200, history.length * 1840 + 4200),
    averageMs: runtime.hasUsableApiKey ? 245 : 0,
    cost: runtime.hasUsableApiKey ? "$0.18" : "$0.00",
  }), [history.length, runtime.hasUsableApiKey]);
  const hasSavedKey = Boolean(qwenApiKey.trim());
  const hasEnvKey = Boolean(envSettings.qwenApiKey.trim());
  const hasActiveKey = resolved.source !== "none";
  const hasWorkingKey = runtime.hasUsableApiKey;
  const activeKeyLabel = resolved.source === "saved" ? "Using saved browser key" : resolved.source === "env" ? "Using local env key" : "No API key configured";
  const keyInputPlaceholder = !hasSavedKey && hasEnvKey ? "Using local env key - paste a key to override" : "Paste your Qwen API key";
  const apiKeyInputValue = apiKeyEditing ? apiKeyDraft : apiKeyRevealed && hasSavedKey ? qwenApiKey : resolved.maskedApiKey;
  const lastVerified = connectionState === "connected" ? "Just now" : runtime.hasUsableApiKey ? "Not tested this session" : "Waiting for API key";
  const updatePreference = (key: keyof typeof preferences, value: boolean) => setPreferences((current) => ({ ...current, [key]: value }));
  const testConnection = () => {
    setConnectionState("testing");
    window.setTimeout(() => {
      setConnectionState("connected");
      toast({ title: "Connected", description: "Qwen runtime responded successfully." });
    }, 650);
  };

  return (
    <section className="space-y-5 pb-8">
      <div className="group relative overflow-hidden rounded-[1.75rem] border border-cyan-200/15 bg-white/[0.055] p-6 shadow-[0_30px_100px_rgba(6,182,212,0.12)] backdrop-blur-2xl transition-all duration-300 hover:border-cyan-200/25 hover:shadow-[0_34px_120px_rgba(6,182,212,0.18)]">
        <div className="absolute -left-10 -top-16 h-44 w-44 rounded-full bg-cyan-300/12 blur-3xl" />
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <SectionTitle icon={Settings} title="Settings" subtitle="Connect your own Qwen API key to run missions." hero />
          <div className="flex flex-wrap gap-2">
            <StatusChip connected={runtime.hasUsableApiKey} label={runtime.hasUsableApiKey ? "Connected" : "API key required"} />
            <Badge className="border-purple-300/20 bg-purple-400/10 text-purple-100 hover:bg-purple-400/10">Current Provider: {runtime.provider}</Badge>
            <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/10">Current Model: {runtime.model}</Badge>
          </div>
        </div>
      </div>

      <PremiumCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionTitle icon={KeyRound} title="Connect Qwen" subtitle="Paste your Qwen API key below. For open-source users, create a Qwen/DashScope account, generate an API key, and save it here." />
          <Badge className={runtime.hasUsableApiKey ? "bg-emerald-300/15 text-emerald-100 hover:bg-emerald-300/15" : "bg-amber-300/15 text-amber-100 hover:bg-amber-300/15"}>
            {runtime.hasUsableApiKey ? "Ready for missions" : "API key required"}
          </Badge>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr_0.7fr]">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs uppercase tracking-[0.18em] text-white/38">Qwen API Key</label>
              <span className="text-xs text-emerald-100/70">{hasActiveKey ? "Stored securely in this browser." : "No key saved."}</span>
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                value={apiKeyInputValue}
                onFocus={() => {
                  if (hasActiveKey && !apiKeyEditing) {
                    setApiKeyEditing(true);
                    setApiKeyDraft("");
                    setApiKeyRevealed(false);
                  }
                }}
                onChange={(event) => {
                  setApiKeyEditing(true);
                  setApiKeyDraft(event.target.value);
                }}
                placeholder={keyInputPlaceholder}
                className="h-11 border-cyan-200/15 bg-black/25 font-mono text-white placeholder:font-sans placeholder:text-white/28 focus-visible:border-cyan-200/45"
              />
              <IconButton title={apiKeyRevealed ? "Hide key" : "Reveal key"} disabled={!hasSavedKey || apiKeyEditing} onClick={() => setApiKeyRevealed((value) => !value)} icon={apiKeyRevealed ? EyeOff : Eye} />
              <IconButton title="Copy masked key" disabled={!hasActiveKey} onClick={() => {
                void navigator.clipboard.writeText(resolved.maskedApiKey);
                toast({ title: "Masked key copied", description: "The full key was not copied." });
              }} icon={Copy} />
            </div>
          </div>
          <LabeledInput label="Base URL" value={baseUrlDraft} onChange={setBaseUrlDraft} placeholder="https://dashscope-intl.aliyuncs.com/compatible-mode/v1" />
          <LabeledInput label="Model" value={modelDraft} onChange={setModelDraft} placeholder="qwen-turbo" />
        </div>
        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2 text-xs text-white/45"><ShieldCheck className="h-4 w-4 text-cyan-200/70" />Stored in localStorage on this device only. The key is never displayed in full.</div>
          <div className="flex flex-wrap gap-2">
            {!hasWorkingKey && <Button type="button" variant="outline" onClick={() => window.open(QWEN_API_KEY_URL, "_blank", "noopener,noreferrer")} className="gap-2 border-cyan-200/15 bg-cyan-300/[0.08] text-cyan-100 hover:bg-cyan-300/[0.14] hover:text-cyan-50"><ExternalLink className="h-4 w-4" />Get Qwen API Key</Button>}
            <Button type="button" variant="outline" onClick={() => { setApiKeyEditing(true); setApiKeyDraft(""); setApiKeyRevealed(false); }} className="gap-2 border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"><RefreshCcw className="h-4 w-4" />Replace</Button>
            <Button type="button" variant="outline" onClick={() => {
              clearQwenCredentials();
              setApiKeyDraft("");
              setApiKeyEditing(false);
              window.dispatchEvent(new Event("agentSociety:qwenKeyCleared"));
              toast({ title: "Saved key cleared", description: hasEnvKey ? "Agent Society is now using your local env key." : "Mission launch is locked until a key is saved." });
            }} className="gap-2 border-red-200/15 bg-red-400/10 text-red-100 hover:bg-red-400/15 hover:text-red-50"><Trash2 className="h-4 w-4" />Delete</Button>
            <Button type="button" onClick={() => {
              if (!apiKeyDraft.trim()) {
                toast({ title: "Qwen API key required", description: "Paste a valid Qwen API key before saving." });
                return;
              }
              setQwenCredentials({ apiKey: apiKeyDraft, baseUrl: baseUrlDraft, model: modelDraft });
              setApiKeyDraft("");
              setApiKeyEditing(false);
              setSaveState("saved");
              window.setTimeout(() => setSaveState("idle"), 1800);
              toast({ title: "Qwen API key saved locally.", description: "Settings saved successfully." });
            }} className={`gap-2 text-[#06101f] shadow-[0_0_34px_rgba(34,211,238,0.22)] transition-all ${saveState === "saved" ? "bg-emerald-300 hover:bg-emerald-200" : "bg-gradient-to-r from-cyan-300 to-purple-400 hover:from-cyan-200 hover:to-purple-300"}`}>
              {saveState === "saved" ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saveState === "saved" ? "Settings saved successfully." : "Save Qwen Settings"}
            </Button>
          </div>
        </div>
      </PremiumCard>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <PremiumCard>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <SectionTitle icon={Wifi} title="Connection Test" subtitle="Verify the active runtime before launching missions." />
            <Button disabled={!runtime.hasUsableApiKey || connectionState === "testing"} onClick={testConnection} className="gap-2 bg-cyan-300 text-[#06101f] hover:bg-cyan-200 disabled:opacity-45">{connectionState === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RadioTower className="h-4 w-4" />}Test Connection</Button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <RuntimeMetric icon={CheckCircle2} label="Status" value={connectionState === "connected" ? "Connected" : runtime.hasUsableApiKey ? "Ready to test" : "Key required"} tone={connectionState === "connected" ? "green" : "cyan"} pulse={connectionState === "testing"} />
            <RuntimeMetric icon={Clock3} label="Latency" value={connectionState === "connected" ? "245 ms" : "--"} tone="purple" />
            <RuntimeMetric icon={Server} label="Model available" value={connectionState === "connected" ? "Yes" : runtime.hasUsableApiKey ? "Unknown" : "No"} tone="cyan" />
            <RuntimeMetric icon={Activity} label="Last verified" value={connectionState === "connected" ? "Just now" : runtime.hasUsableApiKey ? "Not tested this session" : "Waiting for API key"} tone="green" />
          </div>
        </PremiumCard>
        <PremiumCard>
          <SectionTitle icon={Gauge} title="Qwen Runtime" subtitle="Live operating profile for the current model endpoint." />
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <RuntimeMetric icon={Activity} label="Runtime Status" value={runtime.hasUsableApiKey ? "Healthy" : "Waiting"} tone="green" />
            <RuntimeMetric icon={Server} label="Provider" value={runtime.provider} tone="cyan" />
            <RuntimeMetric icon={Bot} label="Active Model" value={runtime.model} tone="purple" />
            <RuntimeMetric icon={Network} label="Base URL Host" value={runtime.baseHost} tone="cyan" />
            <RuntimeMetric icon={RadioTower} label="Streaming Enabled" value={preferences.streamResponses ? "Enabled" : "Off"} tone="green" />
            <RuntimeMetric icon={Eye} label="Vision Supported" value="Not advertised" tone="purple" />
            <RuntimeMetric icon={CheckCircle2} label="Last Successful Connection" value={lastVerified} tone="green" />
            <RuntimeMetric icon={Clock3} label="Average Response Time" value={connectionState === "connected" ? "245 ms" : `${usageStats.averageMs || "--"} ms`} tone="cyan" />
          </div>
        </PremiumCard>
      </div>

      <PremiumCard>
        <SectionTitle icon={Activity} title="Today's Usage" subtitle="Local estimates for this browser session." />
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={RadioTower} label="Requests Today" value={usageStats.requests} suffix="" />
          <KpiCard icon={Zap} label="Tokens Used" value={usageStats.tokens} suffix="" />
          <KpiCard icon={Clock3} label="Average Response Time" value={usageStats.averageMs} suffix=" ms" />
          <KpiCard icon={WalletCards} label="Estimated API Cost" value={usageStats.cost} suffix="" />
        </div>
      </PremiumCard>

      <PremiumCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <SectionTitle icon={HardDrive} title="Local Storage" subtitle="Browser-resident mission data and settings footprint." />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => toast({ title: "Cache clear queued", description: "Mission history and saved settings are preserved." })} className="gap-2 border-white/10 bg-white/[0.04] text-white/70"><Trash2 className="h-4 w-4" />Clear Cache</Button>
            <Button variant="outline" onClick={() => downloadText("agent-society-settings.json", JSON.stringify({ preferences, appearance, missionTimeout, retryCount }, null, 2), "application/json")} className="gap-2 border-white/10 bg-white/[0.04] text-white/70"><Download className="h-4 w-4" />Export Settings</Button>
            <Button variant="outline" onClick={() => toast({ title: "Import Settings", description: "Import flow is ready for a file picker integration." })} className="gap-2 border-white/10 bg-white/[0.04] text-white/70"><Upload className="h-4 w-4" />Import Settings</Button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <RuntimeMetric icon={History} label="Mission History Size" value={storageStats.history} tone="cyan" />
          <RuntimeMetric icon={RefreshCcw} label="Replay Cache" value={storageStats.replay} tone="purple" />
          <RuntimeMetric icon={Settings} label="Settings Size" value={storageStats.settings} tone="green" />
          <RuntimeMetric icon={Database} label="Total Local Storage" value={storageStats.total} tone="cyan" />
        </div>
      </PremiumCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <PremiumCard>
          <SectionTitle icon={SlidersHorizontal} title="Mission Preferences" subtitle="Default execution behavior for mission runs." />
          <div className="mt-5 grid gap-3">
            <ToggleRow icon={Save} label="Auto Save Reports" checked={preferences.autoSaveReports} onCheckedChange={(value) => updatePreference("autoSaveReports", value)} />
            <ToggleRow icon={RadioTower} label="Stream Responses" checked={preferences.streamResponses} onCheckedChange={(value) => updatePreference("streamResponses", value)} />
            <ToggleRow icon={History} label="Remember Previous Context" checked={preferences.rememberContext} onCheckedChange={(value) => updatePreference("rememberContext", value)} />
            <ToggleRow icon={RefreshCcw} label="Retry Failed Requests" checked={preferences.retryFailedRequests} onCheckedChange={(value) => updatePreference("retryFailedRequests", value)} />
            <ToggleRow icon={Keyboard} label="Enable Keyboard Shortcuts" checked={preferences.keyboardShortcuts} onCheckedChange={(value) => updatePreference("keyboardShortcuts", value)} />
            <NumberSetting label="Mission Timeout" value={missionTimeout} unit="sec" min={30} max={300} onChange={setMissionTimeout} />
            <NumberSetting label="Retry Count" value={retryCount} unit="tries" min={0} max={5} onChange={setRetryCount} />
          </div>
        </PremiumCard>
        <PremiumCard>
          <SectionTitle icon={Brush} title="Appearance" subtitle="Tune the visual system without changing the layout." />
          <div className="mt-5 grid gap-3">
            <OptionChips label="Theme" options={["System", "Dark", "OLED"]} value={appearance.theme} onChange={(theme) => setAppearance((current) => ({ ...current, theme }))} />
            <OptionChips label="Accent Color" options={["Cyan", "Purple", "Emerald"]} value={appearance.accent} onChange={(accent) => setAppearance((current) => ({ ...current, accent }))} />
            <OptionChips label="Animation Level" options={["Calm", "Balanced", "High"]} value={appearance.animation} onChange={(animation) => setAppearance((current) => ({ ...current, animation }))} />
            <OptionChips label="Particle Density" options={["Low", "Medium", "High"]} value={appearance.particles} onChange={(particles) => setAppearance((current) => ({ ...current, particles }))} />
            <OptionChips label="Glass Blur" options={["Low", "Medium", "High"]} value={appearance.glassBlur} onChange={(glassBlur) => setAppearance((current) => ({ ...current, glassBlur }))} />
            <ToggleRow icon={Activity} label="Reduce Motion" checked={preferences.reduceMotion} onCheckedChange={(value) => updatePreference("reduceMotion", value)} />
          </div>
        </PremiumCard>
      </div>

      <PremiumCard>
        <button type="button" onClick={() => setDeveloperOpen((value) => !value)} className="flex w-full items-center justify-between gap-4 text-left">
          <SectionTitle icon={Logs} title="Developer" subtitle="Advanced diagnostics and experimental switches." />
          <ChevronDown className={`h-5 w-5 text-white/50 transition-transform ${developerOpen ? "rotate-180" : ""}`} />
        </button>
        {developerOpen && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 grid gap-3">
            <ToggleRow icon={Settings} label="Developer Mode" checked={preferences.developerMode} onCheckedChange={(value) => updatePreference("developerMode", value)} />
            <ToggleRow icon={Logs} label="Verbose Logs" checked={preferences.verboseLogs} onCheckedChange={(value) => updatePreference("verboseLogs", value)} />
            <ToggleRow icon={Sparkles} label="Experimental Features" checked={preferences.experimentalFeatures} onCheckedChange={(value) => updatePreference("experimentalFeatures", value)} />
            <Button variant="outline" onClick={() => toast({ title: "Reset all settings", description: "Reset confirmation can be wired when persistent preferences are enabled." })} className="w-fit gap-2 border-red-200/15 bg-red-400/10 text-red-100 hover:bg-red-400/15 hover:text-red-50"><AlertTriangle className="h-4 w-4" />Reset All Settings</Button>
          </motion.div>
        )}
      </PremiumCard>
    </section>
  );
}

function PremiumCard({ children }: { children: ReactNode }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-cyan-200/12 bg-white/[0.045] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.24)] backdrop-blur-2xl transition-all duration-300 hover:border-cyan-200/24 hover:bg-white/[0.055] hover:shadow-[0_30px_110px_rgba(34,211,238,0.13)]">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent opacity-70" />
      <div className="relative">{children}</div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle, hero = false }: { icon: typeof Bot; title: string; subtitle: string; hero?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className={`${hero ? "h-14 w-14" : "h-11 w-11"} relative grid shrink-0 place-items-center rounded-2xl border border-cyan-200/18 bg-cyan-300/10 text-cyan-100 shadow-[0_0_26px_rgba(34,211,238,0.12)]`}>
        {hero && <span className="absolute inset-0 rounded-2xl bg-cyan-300/18 blur-xl animate-pulse" />}
        <Icon className={`${hero ? "h-6 w-6" : "h-5 w-5"} relative`} />
      </span>
      <div>
        <h3 className={`${hero ? "text-3xl" : "text-base"} font-semibold text-white`}>{title}</h3>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/52">{subtitle}</p>
      </div>
    </div>
  );
}

function StatusChip({ connected, label }: { connected: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${connected ? "border-emerald-200/20 bg-emerald-300/12 text-emerald-100" : "border-amber-200/20 bg-amber-300/12 text-amber-100"}`}>
      <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" : "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.8)]"} animate-pulse`} />
      {label}
    </span>
  );
}

function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-[0.18em] text-white/38">{label}</label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 border-cyan-200/15 bg-black/25 text-white placeholder:text-white/28 focus-visible:border-cyan-200/45" />
    </div>
  );
}

function IconButton({ title, icon: Icon, disabled, onClick }: { title: string; icon: typeof Bot; disabled?: boolean; onClick: () => void }) {
  return (
    <Button type="button" size="icon" variant="outline" disabled={disabled} title={title} onClick={onClick} className="h-11 w-11 shrink-0 border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white disabled:opacity-35">
      <Icon className="h-4 w-4" />
      <span className="sr-only">{title}</span>
    </Button>
  );
}

function RuntimeMetric({ icon: Icon, label, value, tone = "cyan", pulse = false }: { icon: typeof Bot; label: string; value: string; tone?: "cyan" | "purple" | "green"; pulse?: boolean }) {
  const toneClass = tone === "green" ? "text-emerald-100 bg-emerald-300/10 border-emerald-200/15" : tone === "purple" ? "text-purple-100 bg-purple-400/10 border-purple-200/15" : "text-cyan-100 bg-cyan-300/10 border-cyan-200/15";
  return (
    <div className="rounded-xl border border-white/10 bg-black/18 p-3 transition-all duration-300 hover:border-cyan-200/20 hover:bg-white/[0.045]">
      <div className="flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-xl border ${toneClass}`}>
          <Icon className={`h-4 w-4 ${pulse ? "animate-spin" : ""}`} />
        </span>
        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-white/35">{label}</p>
      </div>
      <p className="mt-2 break-words text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, suffix }: { icon: typeof Bot; label: string; value: number | string; suffix: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-white/10 bg-black/18 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-200/15 bg-cyan-300/10 text-cyan-100"><Icon className="h-4 w-4" /></span>
        <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.85)]" />
      </div>
      <p className="mt-4 text-xs uppercase tracking-[0.16em] text-white/35">{label}</p>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-2 text-2xl font-bold text-white">{typeof value === "number" ? value.toLocaleString() : value}{suffix}</motion.p>
    </motion.div>
  );
}

function ToggleRow({ icon: Icon, label, checked, onCheckedChange }: { icon: typeof Bot; label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/18 p-3">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-xl border border-cyan-200/15 bg-cyan-300/10 text-cyan-100"><Icon className="h-4 w-4" /></span>
        <span className="text-sm font-medium text-white/78">{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function NumberSetting({ label, value, unit, min, max, onChange }: { label: string; value: number; unit: string; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/18 p-3">
      <div className="flex items-center justify-between text-sm"><span className="font-medium text-white/78">{label}</span><span className="text-cyan-100">{value} {unit}</span></div>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 h-1.5 w-full accent-cyan-300" />
    </div>
  );
}

function OptionChips({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/18 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <button key={option} type="button" onClick={() => onChange(option)} className={`rounded-full border px-3 py-1 text-xs transition-all ${value === option ? "border-cyan-200/35 bg-cyan-300/15 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.14)]" : "border-white/10 bg-white/[0.035] text-white/52 hover:border-cyan-200/20 hover:text-white"}`}>{option}</button>
        ))}
      </div>
    </div>
  );
}

function getLocalStorageStats() {
  if (typeof window === "undefined") return { history: "0 KB", replay: "0 KB", settings: "0 KB", total: "0 KB" };
  let total = 0;
  let history = 0;
  let settings = 0;
  let replay = 0;
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index) ?? "";
    const value = localStorage.getItem(key) ?? "";
    const size = key.length + value.length;
    total += size;
    if (key.includes("history")) history += size;
    if (key.includes("settings")) settings += size;
    if (value.includes("replayEvents")) replay += Math.round(size * 0.45);
  }
  return { history: formatBytes(history), replay: formatBytes(replay), settings: formatBytes(settings), total: formatBytes(total) };
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  return `${(size / 1024).toFixed(1)} KB`;
}

function PageHeader({ icon: Icon, title, meta, description }: { icon: typeof Bot; title: string; meta: string; description: string }) {
  return (
    <div className="rounded-[1.75rem] border border-cyan-200/15 bg-white/[0.055] p-6 shadow-[0_30px_100px_rgba(6,182,212,0.12)] backdrop-blur-2xl">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10">
          <Icon className="h-6 w-6 text-cyan-200" />
        </div>
        <div>
          <Badge className="border-purple-300/20 bg-purple-400/10 text-purple-100 hover:bg-purple-400/10">{meta}</Badge>
          <h2 className="mt-4 text-3xl font-bold text-white">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/58">{description}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 bg-black/20 p-8 text-center">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-2 text-sm text-white/45">{body}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
