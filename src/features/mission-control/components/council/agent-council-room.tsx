"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, ArrowRight, BrainCircuit, CheckCircle2, Clock3, Eye, Gauge, MessageSquareText, Network, PanelLeftOpen, PanelRightOpen, PlayCircle, RotateCcw, ShieldCheck, X, Zap } from "lucide-react";
import { AGENT_DEFINITIONS } from "@/agents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMissionStore } from "@/store";
import { MissionState, type AgentActivity, type AgentDialogueEntry, type AgentRole, type AgentThinkingState, type ExecutionTask, type MissionContext } from "@/types";
import { sanitizeUserFacingText } from "@/utils";
import { AgentIconGlyph } from "../agent-icons";
import { AgentContributionDrawer } from "./agent-contribution-drawer";
import { AgentRoster } from "./agent-roster";
import { normalizeDialogueEntry } from "./agent-output-formatter";
import { CouncilSummaryPanel } from "./council-summary-panel";
import { MissionIntelligencePanel } from "./mission-intelligence-panel";
import { TranscriptDrawer } from "./transcript-drawer";
import { WorkstreamInspector } from "./workstream-inspector";
import { WorkstreamStrip } from "./workstream-strip";

export function AgentCouncilRoom({
  involvedAgents,
  onViewReport,
  onReplayMission,
  onStartNew,
}: {
  involvedAgents: AgentRole[];
  onViewReport: () => void;
  onReplayMission: () => void;
  onStartNew: () => void;
}) {
  const context = useMissionStore((s) => s.context);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [contributionOpen, setContributionOpen] = useState(false);
  const [contributionEntry, setContributionEntry] = useState<AgentDialogueEntry | null>(null);
  const [selectedTask, setSelectedTask] = useState<ExecutionTask | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);

  const latestDialogue = useMemo(() => (context?.dialogue ?? []).slice(-5).reverse(), [context?.dialogue]);

  if (!context) return null;

  const completed = context.status === MissionState.Completed;
  const selectedConflicts = selectedTask
    ? context.conflicts.filter((conflict) => conflict.affectedTaskIds?.includes(selectedTask.id) || conflict.affectedTaskIds?.includes(selectedTask.workstreamId))
    : [];

  const openTranscript = () => {
    setTranscriptOpen(true);
  };

  const openContribution = (entry: AgentDialogueEntry) => {
    setContributionEntry(entry);
    setContributionOpen(true);
  };

  const selectTask = (task: ExecutionTask) => {
    setSelectedTask(task);
    setInspectorOpen(true);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {completed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="overflow-hidden rounded-[1.45rem] border border-emerald-300/20 bg-emerald-300/[0.06] p-5 shadow-[0_24px_90px_rgba(16,185,129,0.12)]"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Badge className="bg-emerald-300/15 text-emerald-100 hover:bg-emerald-300/15">Mission Report Ready</Badge>
              <h3 className="mt-3 text-2xl font-bold text-white">The council has synchronized the final synthesis.</h3>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/60">Review the detailed report, replay recorded events, or start a fresh objective.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onViewReport} className="gap-2 bg-cyan-300 text-[#06101f] shadow-[0_0_28px_rgba(34,211,238,0.22)] hover:bg-cyan-200 focus-visible:ring-cyan-200"><Eye className="h-4 w-4" /> View Full Report</Button>
              <Button variant="outline" onClick={onReplayMission} className="gap-2 border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"><PlayCircle className="h-4 w-4" /> Replay Mission</Button>
              <Button variant="outline" onClick={onStartNew} className="gap-2 border-purple-300/20 bg-purple-400/10 text-purple-100 hover:bg-purple-400/15"><RotateCcw className="h-4 w-4" /> New Mission</Button>
            </div>
          </div>
        </motion.div>
      )}

      {completed ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => setRosterOpen(true)} className="gap-2 border-cyan-200/20 bg-cyan-300/[0.06] text-cyan-100 hover:bg-cyan-300/[0.12]">
              <PanelLeftOpen className="h-4 w-4" />
              Agent Roster
            </Button>
            <Badge className="hidden bg-emerald-300/10 text-emerald-100 sm:inline-flex">Completed mission brief</Badge>
            <Button variant="outline" onClick={() => setIntelligenceOpen(true)} className="gap-2 border-purple-200/20 bg-purple-300/[0.06] text-purple-100 hover:bg-purple-300/[0.12]">
              Mission Intelligence
              <PanelRightOpen className="h-4 w-4" />
            </Button>
          </div>
          <CouncilSummaryPanel context={context} />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <AgentRoster currentAgent={context.currentAgent} states={context.agentStates} activities={context.agentActivities} participatingRoles={involvedAgents} />
          <MissionOperationsBoard
            context={context}
            currentAgent={context.currentAgent}
            states={context.agentStates}
            dialogue={latestDialogue}
            onExpand={openContribution}
            onTranscript={openTranscript}
            onOpenIntelligence={() => setIntelligenceOpen(true)}
          />
        </div>
      )}

      <WorkstreamStrip tasks={context.executionTasks} selectedId={selectedTask?.id} onSelect={selectTask} />
      <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white/52">
        Synchronization status: {context.missionGraph?.finalizationReadiness.status.replace(/_/g, " ") ?? "waiting for mission graph"}.
      </div>

      <TranscriptDrawer dialogue={context.dialogue} open={transcriptOpen} onOpenChange={setTranscriptOpen} />
      <AgentContributionDrawer entry={contributionEntry} context={context} open={contributionOpen} onOpenChange={setContributionOpen} />
      <WorkstreamInspector task={selectedTask} conflicts={selectedConflicts} open={inspectorOpen} onOpenChange={setInspectorOpen} />
      <AnimatePresence>
        {intelligenceOpen && <MissionIntelligenceOverlay context={context} onClose={() => setIntelligenceOpen(false)} />}
        {completed && rosterOpen && <AgentRosterOverlay currentAgent={context.currentAgent} states={context.agentStates} activities={context.agentActivities} participatingRoles={involvedAgents} onClose={() => setRosterOpen(false)} />}
      </AnimatePresence>
    </motion.section>
  );
}

function MissionOperationsBoard({
  context,
  currentAgent,
  states,
  dialogue,
  onExpand,
  onTranscript,
  onOpenIntelligence,
}: {
  context: MissionContext;
  currentAgent: AgentRole | null;
  states: Record<AgentRole, AgentThinkingState>;
  dialogue: AgentDialogueEntry[];
  onExpand: (entry: AgentDialogueEntry) => void;
  onTranscript: () => void;
  onOpenIntelligence: () => void;
}) {
  const activeAgent = AGENT_DEFINITIONS.find((agent) => agent.role === currentAgent) ?? AGENT_DEFINITIONS[0];
  const activeState = activeAgent ? states[activeAgent.role] : "waiting";
  const activeActivity = currentAgent ? context.agentActivities[currentAgent] : undefined;
  const latestEntry = dialogue[0] ?? null;

  return (
    <div className="relative overflow-hidden rounded-[1.35rem] border border-cyan-200/12 bg-[radial-gradient(circle_at_25%_20%,rgba(34,211,238,0.14),transparent_34%),linear-gradient(135deg,rgba(3,7,18,0.9),rgba(15,23,42,0.68))] p-3 shadow-[0_22px_80px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-purple-400/10 blur-3xl" />
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/55 to-transparent" />
      </div>

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge className="border-cyan-200/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/10">Mission Engine Live</Badge>
          <h3 className="mt-1 text-lg font-semibold text-white">Execution Board</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onOpenIntelligence} variant="outline" className="gap-2 rounded-full border-cyan-200/15 bg-cyan-300/[0.08] text-cyan-100 hover:bg-cyan-300/[0.14] hover:text-cyan-50">
            <BrainCircuit className="h-4 w-4" />
            Intelligence
          </Button>
          <Button onClick={onTranscript} variant="outline" className="rounded-full border-white/10 bg-white/[0.055] text-white/70 hover:bg-white/[0.1] hover:text-white">
            Full Transcript
          </Button>
        </div>
      </div>

      <div className="relative z-10 mt-3 grid gap-3 lg:grid-cols-[1fr_0.95fr]">
        <div className="rounded-2xl border border-cyan-200/16 bg-cyan-300/[0.055] p-3">
          <div className="flex items-center gap-3">
            <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10 text-cyan-100 shadow-[0_0_42px_rgba(34,211,238,0.18)]">
              <Network className="h-5 w-5" />
              <motion.span
                className="absolute inset-0 rounded-2xl border border-cyan-200/30"
                animate={{ scale: [1, 1.24, 1], opacity: [0.55, 0, 0.55] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut" }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/55">Mission Engine</p>
              <h4 className="mt-1 truncate text-base font-semibold text-white">Routing specialist work</h4>
              <p className="mt-1 text-xs leading-relaxed text-white/50">Synchronizing tasks, agent state, and report readiness.</p>
            </div>
          </div>
        </div>
        <ActiveAgentCard agent={activeAgent} state={activeState} activity={activeActivity} />
      </div>

      <section className="relative z-10 mt-3 rounded-[1.2rem] border border-white/10 bg-black/24 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-100/55">
              <MessageSquareText className="h-3.5 w-3.5" />
              Live Dispatch
            </p>
            <h4 className="mt-1 text-base font-semibold text-white">Latest agent signal</h4>
          </div>
          <span className="rounded-full border border-emerald-200/15 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
            Streaming
          </span>
        </div>

        <div className="mt-3 grid min-h-0 gap-3 lg:grid-cols-[0.95fr_1.05fr]">
          <AnimatePresence mode="wait">
            {latestEntry ? <LatestDispatchCard key={`${latestEntry.agentId}-${latestEntry.timestamp}`} entry={latestEntry} onExpand={onExpand} /> : <WaitingDispatch activity={activeActivity} />}
          </AnimatePresence>

          <div className="min-h-0 space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-white/35">Recent signals</p>
            <div className="max-h-52 space-y-2 overflow-y-auto pr-1 [scrollbar-color:rgba(34,211,238,0.35)_transparent] [scrollbar-width:thin]">
              {dialogue.slice(1).length ? dialogue.slice(1).map((entry) => <SignalRow key={`${entry.agentId}-${entry.timestamp}`} entry={entry} onExpand={onExpand} />) : (
                <p className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-white/42">Recent agent updates will appear here.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <MissionMetricsStrip context={context} states={states} />
    </div>
  );
}

function MissionIntelligenceOverlay({ context, onClose }: { context: NonNullable<ReturnType<typeof useMissionStore.getState>["context"]>; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.aside
        initial={{ opacity: 0, x: 32, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 32, scale: 0.98 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
        className="absolute right-4 top-4 flex max-h-[calc(100vh-2rem)] w-[min(420px,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto rounded-[1.6rem] border border-cyan-200/18 bg-[#06111f]/96 p-4 shadow-[0_28px_120px_rgba(34,211,238,0.22)] backdrop-blur-2xl [scrollbar-color:rgba(34,211,238,0.55)_transparent] [scrollbar-width:thin]"
      >
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <Badge className="border-cyan-200/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/10">Overlay</Badge>
            <h3 className="mt-2 text-lg font-semibold text-white">Mission Intelligence</h3>
          </div>
          <Button size="icon" variant="outline" onClick={onClose} className="h-9 w-9 rounded-full border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white">
            <X className="h-4 w-4" />
            <span className="sr-only">Close mission intelligence</span>
          </Button>
        </div>
        <MissionIntelligencePanel context={context} />
      </motion.aside>
    </motion.div>
  );
}

function AgentRosterOverlay({
  currentAgent,
  states,
  activities,
  participatingRoles,
  onClose,
}: {
  currentAgent: AgentRole | null;
  states: Record<AgentRole, AgentThinkingState>;
  activities: Partial<Record<AgentRole, AgentActivity>>;
  participatingRoles: AgentRole[];
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.aside
        initial={{ opacity: 0, x: -32, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -32, scale: 0.98 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
        className="absolute left-4 top-4 w-[min(360px,calc(100vw-2rem))] rounded-[1.6rem] border border-cyan-200/18 bg-[#06111f]/96 p-4 shadow-[0_28px_120px_rgba(34,211,238,0.22)] backdrop-blur-2xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <Badge className="border-cyan-200/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/10">Mission team</Badge>
            <h3 className="mt-2 text-lg font-semibold text-white">Agent Roster</h3>
          </div>
          <Button size="icon" variant="outline" onClick={onClose} className="h-9 w-9 rounded-full border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white">
            <X className="h-4 w-4" />
            <span className="sr-only">Close agent roster</span>
          </Button>
        </div>
        <AgentRoster currentAgent={currentAgent} states={states} activities={activities} participatingRoles={participatingRoles} />
      </motion.aside>
    </motion.div>
  );
}

function ActiveAgentCard({ agent, state, activity }: { agent: typeof AGENT_DEFINITIONS[number]; state: AgentThinkingState; activity?: AgentActivity }) {
  return (
    <motion.div
      layout
      className="relative overflow-hidden rounded-2xl border p-3"
      style={{ borderColor: `${agent.color}55`, background: `linear-gradient(135deg, ${agent.color}1f, rgba(255,255,255,0.035))` }}
    >
      <div className="absolute right-0 top-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full blur-2xl" style={{ backgroundColor: `${agent.color}2b` }} />
      <div className="relative flex items-center gap-3">
        <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border shadow-[0_0_38px_rgba(255,255,255,0.06)]" style={{ borderColor: `${agent.color}88`, backgroundColor: `${agent.color}22`, color: agent.color }}>
          <AgentIconGlyph agentId={agent.id} className="h-5 w-5" />
          <motion.span
            className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full"
            style={{ backgroundColor: agent.color, boxShadow: `0 0 18px ${agent.color}` }}
            animate={{ scale: [1, 1.35, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-white/42">Active specialist</p>
          <h4 className="mt-1 truncate text-lg font-semibold text-white">{agent.name}</h4>
          <p className="mt-1 line-clamp-1 text-sm text-white/52">{activity?.label ?? agent.capabilities[0]}</p>
        </div>
      </div>
      <div className="relative mt-3 flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <motion.span
            className="block h-full rounded-full"
            style={{ backgroundColor: agent.color }}
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </span>
        <span className="rounded-full border border-white/10 bg-black/22 px-2 py-1 text-xs capitalize text-white/60">{state.replace(/_/g, " ")}</span>
      </div>
      <div className="relative mt-2 flex items-center justify-between gap-3 text-xs text-white/45">
        <motion.p key={activity?.updatedAt ?? "idle"} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 truncate">{activity?.detail ?? "Preparing the assigned specialist work."}</motion.p>
        {activity?.confidence != null && <span className="shrink-0 font-medium text-cyan-100/80">{activity.confidence}%</span>}
      </div>
    </motion.div>
  );
}

function LatestDispatchCard({ entry, onExpand }: { entry: AgentDialogueEntry; onExpand: (entry: AgentDialogueEntry) => void }) {
  const definition = AGENT_DEFINITIONS.find((agent) => agent.role === entry.agentRole);
  const output = normalizeDialogueEntry(entry);
  const color = definition?.color ?? "#67e8f9";
  const name = sanitizeUserFacingText(entry.displayRole || entry.agentName);
  const title = compactSignalTitle(output.title || output.summary);
  const bullets = compactSignalBullets(output.summary, output.bullets);
  return (
    <motion.article
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.985 }}
      className="max-h-72 overflow-hidden rounded-2xl border bg-[#07111f]/86 p-3 shadow-[0_20px_70px_rgba(0,0,0,0.24)]"
      style={{ borderColor: `${color}55` }}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border" style={{ borderColor: `${color}88`, backgroundColor: `${color}22`, color }}>
          <AgentIconGlyph agentId={definition?.id} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h5 className="truncate text-base font-semibold text-white">{name}</h5>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.14em] text-white/50">{entry.status ?? output.type}</span>
            <span className="ml-auto flex items-center gap-1 text-xs text-white/35">
              <Clock3 className="h-3 w-3" />
              {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <p className="mt-2 line-clamp-1 text-sm font-medium text-white/78">{title}</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
        <p className="text-[0.68rem] uppercase tracking-[0.18em] text-cyan-100/45">Findings Summary</p>
        <ul className="mt-2 space-y-1.5">
          {bullets.map((bullet, bulletIndex) => (
            <li key={`${bulletIndex}-${bullet}`} className="flex min-w-0 items-center gap-2 text-xs text-white/62">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color }} />
              <span className="line-clamp-1">{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 flex items-center justify-end">
        <Button size="sm" variant="outline" onClick={() => onExpand(entry)} className="h-8 gap-2 border-white/10 bg-white/[0.04] text-white/62 hover:bg-white/[0.08] hover:text-white">
          View Full Output
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.article>
  );
}

function SignalRow({ entry, onExpand }: { entry: AgentDialogueEntry; onExpand: (entry: AgentDialogueEntry) => void }) {
  const definition = AGENT_DEFINITIONS.find((agent) => agent.role === entry.agentRole);
  const output = normalizeDialogueEntry(entry);
  const color = definition?.color ?? "#67e8f9";
  return (
    <motion.button
      type="button"
      onClick={() => onExpand(entry)}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-left transition-all hover:border-cyan-200/20 hover:bg-white/[0.055]"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border" style={{ borderColor: `${color}66`, backgroundColor: `${color}1f`, color }}>
        <AgentIconGlyph agentId={definition?.id} className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-white/78">{sanitizeUserFacingText(entry.displayRole || entry.agentName)}</span>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.12em] text-white/42">{entry.status ?? output.type}</span>
          <span className="ml-auto shrink-0 text-[0.68rem] text-white/32">{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </span>
        <span className="mt-0.5 block line-clamp-1 text-xs text-white/42">{compactSignalTitle(output.title || output.summary, 118)}</span>
      </span>
      <Activity className="h-3.5 w-3.5 text-white/28 transition-colors group-hover:text-cyan-100/70" />
    </motion.button>
  );
}

function WaitingDispatch({ activity }: { activity?: AgentActivity }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-sm font-medium text-white">{activity?.label ?? "Waiting for first specialist update"}</p>
      <motion.p key={activity?.updatedAt ?? "waiting"} initial={{ opacity: 0 }} animate={{ opacity: [0.45, 0.8, 0.45] }} transition={{ duration: 1.6, repeat: Infinity }} className="mt-2 text-sm leading-relaxed text-white/48">{activity?.detail ?? "The council is preparing shared context before the first specialist response."}</motion.p>
      <div className="mt-4 space-y-2">
        {["Context synchronized", "Dependencies checked", "Recommendation in progress"].map((label, index) => (
          <motion.div key={label} className="h-1.5 overflow-hidden rounded-full bg-white/10" initial={{ opacity: 0.35 }} animate={{ opacity: [0.35, 0.8, 0.35] }} transition={{ duration: 1.8, delay: index * 0.2, repeat: Infinity }}>
            <motion.span className="block h-full rounded-full bg-cyan-300/70" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.8, delay: index * 0.2, repeat: Infinity, ease: "easeInOut" }} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function MissionMetricsStrip({ context, states }: { context: MissionContext; states: Record<AgentRole, AgentThinkingState> }) {
  const completedTasks = context.executionTasks.filter((task) => task.status === "completed").length;
  const activeAgents = AGENT_DEFINITIONS.filter((agent) => isWorkingState(states[agent.role])).length;
  const latency = context.efficiencyMetrics?.averageLatencyMs ? `${Math.round(context.efficiencyMetrics.averageLatencyMs)} ms` : "--";
  const tokens = context.efficiencyMetrics?.tokensConsumed ?? estimateTokensFromDialogue(context.dialogue);
  const success = context.efficiencyMetrics?.finalConfidenceScore != null ? `${context.efficiencyMetrics.finalConfidenceScore}%` : `${Math.round(context.progress)}%`;
  const cost = tokens ? `$${(tokens * 0.000002).toFixed(3)}` : "--";
  const metrics = [
    { label: "Tasks Done", value: `${completedTasks}/${context.executionTasks.length || 0}`, icon: CheckCircle2 },
    { label: "Active Agents", value: String(activeAgents), icon: Activity },
    { label: "Avg Response", value: latency, icon: Gauge },
    { label: "Tokens Used", value: tokens ? tokens.toLocaleString() : "--", icon: Zap },
    { label: "Est. Cost", value: cost, icon: ShieldCheck },
    { label: "Success Rate", value: success, icon: CheckCircle2 },
  ];

  return (
    <div className="relative z-10 mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div key={metric.label} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 transition-all hover:border-cyan-200/20 hover:bg-white/[0.055]">
            <div className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-cyan-100/62" />
              <p className="truncate text-[0.64rem] uppercase tracking-[0.14em] text-white/35">{metric.label}</p>
            </div>
            <p className="mt-1 truncate text-sm font-semibold text-white">{metric.value}</p>
          </div>
        );
      })}
    </div>
  );
}

function isWorkingState(state: AgentThinkingState) {
  return state === "thinking" || state === "analyzing" || state === "reviewing";
}

function compactSignalTitle(text: string, maxLength = 120) {
  const cleaned = sanitizeUserFacingText(text).replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  const sentence = cleaned.slice(0, maxLength).replace(/\s+\S*$/, "");
  return `${sentence || cleaned.slice(0, maxLength - 1)}...`;
}

function compactSignalBullets(summary: string, bullets: string[]) {
  const source = bullets.length
    ? bullets
    : sanitizeUserFacingText(summary).split(/(?<=[.!?])\s+|;\s+|-\s+/).filter(Boolean);
  const compacted = source
    .map((bullet) => compactSignalTitle(bullet.replace(/\s*(?:which|that|because|while|where)\b.*$/i, ""), 54))
    .filter(Boolean)
    .slice(0, 3);
  return compacted.length ? compacted : ["Specialist update recorded for inspection."];
}

function estimateTokensFromDialogue(dialogue: AgentDialogueEntry[]) {
  const textLength = dialogue.reduce((total, entry) => total + String(entry.content ?? "").length, 0);
  return textLength ? Math.max(1, Math.round(textLength / 4)) : 0;
}
