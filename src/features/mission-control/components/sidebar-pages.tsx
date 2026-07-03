"use client";

import { useMemo, useState } from "react";
import {
  BrainCircuit,
  Bot,
  CheckCircle2,
  Copy,
  Download,
  FileJson,
  FileText,
  History,
  KeyRound,
  Lightbulb,
  Megaphone,
  Network,
  PackageCheck,
  Scale,
  Search,
  ShieldAlert,
  Sparkles,
  PlayCircle,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  WalletCards,
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
import type { MissionView } from "./mission-sidebar";

function cardClass() {
  return "rounded-2xl border border-cyan-200/10 bg-black/20 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)]";
}

const agentIconMap = {
  "agent-planner": BrainCircuit,
  "agent-researcher": Search,
  "agent-product": Lightbulb,
  "agent-technical": Network,
  "agent-marketing": Megaphone,
  "agent-finance": WalletCards,
  "agent-risk": ShieldAlert,
  "agent-mediator": Scale,
  "agent-finalizer": PackageCheck,
};

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
          <div className="space-y-10">
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
          const AgentIcon = agentIconMap[agent.id as keyof typeof agentIconMap] ?? Bot;
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
                    <AgentIcon className="h-5 w-5" style={{ color: agent.color }} />
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
  const AgentIcon = agentIconMap[agent.id as keyof typeof agentIconMap] ?? Bot;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <span className="grid h-10 w-10 place-items-center rounded-2xl border" style={{ borderColor: `${agent.color}88`, backgroundColor: `${agent.color}22` }}>
        <AgentIcon className="h-4 w-4" style={{ color: agent.color }} />
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
            const readableReport = sanitizeMissionText(markdown);
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
                    <Button size="sm" variant="outline" onClick={() => downloadText(`${filenameSafe(entry.missionBrief)}.json`, JSON.stringify(entry, null, 2), "application/json")} className="gap-1 border-white/10 bg-white/[0.04] text-white/70"><FileJson className="h-3.5 w-3.5" /> JSON</Button>
                  </div>
                </div>
                <details className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-cyan-100">View report</summary>
                  <pre className="mt-3 max-h-[52vh] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-white/64">
                    {readableReport}
                  </pre>
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
  const allowMockFallback = useRuntimeSettingsStore((state) => state.allowMockFallback);
  const setAllowMockFallback = useRuntimeSettingsStore((state) => state.setAllowMockFallback);
  const developerDebugMode = useRuntimeSettingsStore((state) => state.developerDebugMode);
  const setDeveloperDebugMode = useRuntimeSettingsStore((state) => state.setDeveloperDebugMode);
  const qwenApiKey = useRuntimeSettingsStore((state) => state.qwenApiKey);
  const qwenBaseUrl = useRuntimeSettingsStore((state) => state.qwenBaseUrl);
  const qwenModel = useRuntimeSettingsStore((state) => state.qwenModel);
  const setQwenCredentials = useRuntimeSettingsStore((state) => state.setQwenCredentials);
  const clearQwenCredentials = useRuntimeSettingsStore((state) => state.clearQwenCredentials);
  const [apiKeyDraft, setApiKeyDraft] = useState(qwenApiKey);
  const [baseUrlDraft, setBaseUrlDraft] = useState(qwenBaseUrl);
  const [modelDraft, setModelDraft] = useState(qwenModel);

  return (
    <section className="space-y-5">
      <PageHeader icon={Settings} title="Settings" meta={`Current mode: ${runtime.provider}`} description="Bring your own Qwen API key to run missions. Credentials are stored locally in this browser and are never committed to the open-source project." />
      <div className="rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.055] p-5 shadow-[0_24px_90px_rgba(34,211,238,0.12)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10">
              <KeyRound className="h-5 w-5 text-cyan-100" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Connect Qwen</h3>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/58">
                Paste your own Qwen API key to enable mission generation. Because this app is frontend-only, use restricted test or hackathon keys and never share production secrets.
              </p>
            </div>
          </div>
          <Badge className={runtime.hasUsableApiKey ? "bg-emerald-300/15 text-emerald-100 hover:bg-emerald-300/15" : "bg-amber-300/15 text-amber-100 hover:bg-amber-300/15"}>
            {runtime.hasUsableApiKey ? "Ready for missions" : "API key required"}
          </Badge>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr_0.7fr]">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.18em] text-white/38">Qwen API Key</label>
            <Input
              type="password"
              value={apiKeyDraft}
              onChange={(event) => setApiKeyDraft(event.target.value)}
              placeholder="Paste your Qwen API key"
              className="h-11 border-cyan-200/15 bg-black/25 text-white placeholder:text-white/28 focus-visible:border-cyan-200/45"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.18em] text-white/38">Base URL</label>
            <Input
              value={baseUrlDraft}
              onChange={(event) => setBaseUrlDraft(event.target.value)}
              placeholder="https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
              className="h-11 border-cyan-200/15 bg-black/25 text-white placeholder:text-white/28 focus-visible:border-cyan-200/45"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.18em] text-white/38">Model</label>
            <Input
              value={modelDraft}
              onChange={(event) => setModelDraft(event.target.value)}
              placeholder="qwen-turbo"
              className="h-11 border-cyan-200/15 bg-black/25 text-white placeholder:text-white/28 focus-visible:border-cyan-200/45"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-white/45">
            <ShieldCheck className="h-4 w-4 text-cyan-200/70" />
            Stored in localStorage on this device only. The API key is never displayed outside this password field.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clearQwenCredentials();
                setApiKeyDraft("");
                toast({ title: "Qwen key removed", description: "Mission launch is locked until a new key is saved." });
              }}
              className="border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
            >
              Clear
            </Button>
            <Button
              type="button"
              onClick={() => {
                setQwenCredentials({ apiKey: apiKeyDraft, baseUrl: baseUrlDraft, model: modelDraft });
                toast({ title: "Qwen settings saved", description: "Agent Society will use your local Qwen credentials for missions." });
              }}
              className="gap-2 bg-gradient-to-r from-cyan-300 to-purple-400 text-[#06101f] shadow-[0_0_34px_rgba(34,211,238,0.22)] hover:from-cyan-200 hover:to-purple-300"
            >
              <Save className="h-4 w-4" />
              Save Qwen Settings
            </Button>
          </div>
        </div>
      </div>
      <div className={cardClass()}>
        <h3 className="text-sm font-semibold text-white">Qwen Runtime</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Info label="Provider" value={runtime.provider} />
          <Info label="Model" value={runtime.model} />
          <Info label="Base URL Host" value={runtime.baseHost} />
        </div>
        <p className="mt-4 text-sm leading-relaxed text-white/55">
          Open-source users can either paste a local browser key above or set `NEXT_PUBLIC_QWEN_API_KEY`, `NEXT_PUBLIC_QWEN_BASE_URL`, and `NEXT_PUBLIC_QWEN_MODEL` in `.env.local`.
        </p>
      </div>
      <div className={`${cardClass()} flex items-center justify-between gap-4`}>
        <div>
          <h3 className="text-sm font-semibold text-white">Allow mock fallback on Qwen failure</h3>
          <p className="mt-1 text-sm text-white/50">When off, Qwen failures stop the mission with a clear error instead of pretending Qwen succeeded.</p>
        </div>
        <Switch checked={allowMockFallback} onCheckedChange={setAllowMockFallback} />
      </div>
      <div className={`${cardClass()} flex items-center justify-between gap-4`}>
        <div>
          <h3 className="text-sm font-semibold text-white">Developer Debug Mode</h3>
          <p className="mt-1 text-sm text-white/50">When enabled, transcript drawers can reveal raw model output for debugging. Keep this off for the normal product experience.</p>
        </div>
        <Switch checked={developerDebugMode} onCheckedChange={setDeveloperDebugMode} />
      </div>
    </section>
  );
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
