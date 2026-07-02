"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Eye, Network, PlayCircle, RotateCcw, Sparkles } from "lucide-react";
import { AGENT_DEFINITIONS } from "@/agents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMissionStore } from "@/store";
import { MissionState, type AgentDialogueEntry, type ExecutionTask } from "@/types";
import { downloadText, reportToMarkdown } from "@/utils";
import { AgentRoster } from "./agent-roster";
import { AgentSpeechBubble } from "./agent-speech-bubble";
import { MissionIntelligencePanel } from "./mission-intelligence-panel";
import { TranscriptDrawer } from "./transcript-drawer";
import { WorkstreamInspector } from "./workstream-inspector";
import { WorkstreamStrip } from "./workstream-strip";

const POSITIONS = [
  "left-[50%] top-0 -translate-x-1/2",
  "right-[8%] top-[12%]",
  "right-0 top-[50%] -translate-y-1/2",
  "right-[12%] bottom-[10%]",
  "left-[50%] bottom-0 -translate-x-1/2",
  "left-[12%] bottom-[10%]",
  "left-0 top-[50%] -translate-y-1/2",
  "left-[8%] top-[12%]",
  "left-[50%] top-[50%] -translate-x-1/2 -translate-y-1/2",
];

export function AgentCouncilRoom({ onViewReport, onStartNew }: { onViewReport: () => void; onStartNew: () => void }) {
  const context = useMissionStore((s) => s.context);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [focusEntry, setFocusEntry] = useState<AgentDialogueEntry | null>(null);
  const [selectedTask, setSelectedTask] = useState<ExecutionTask | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const latestDialogue = useMemo(() => (context?.dialogue ?? []).slice(-5), [context?.dialogue]);

  if (!context) return null;

  const completed = context.status === MissionState.Completed;
  const selectedConflicts = selectedTask
    ? context.conflicts.filter((conflict) => conflict.affectedTaskIds?.includes(selectedTask.id) || conflict.affectedTaskIds?.includes(selectedTask.workstreamId))
    : [];

  const openTranscript = (entry?: AgentDialogueEntry) => {
    setFocusEntry(entry ?? null);
    setTranscriptOpen(true);
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
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/60">Review the detailed report, export the result, replay the mission transcript, or start a fresh objective.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onViewReport} className="gap-2 bg-cyan-300 text-[#06101f] hover:bg-cyan-200"><Eye className="h-4 w-4" /> View Full Report</Button>
              {context.finalReport && <Button variant="outline" onClick={() => downloadText("agent-society-report.md", reportToMarkdown(context.finalReport!), "text/markdown")} className="gap-2 border-white/10 bg-white/[0.04] text-white/70"><Download className="h-4 w-4" /> Export Markdown</Button>}
              <Button variant="outline" onClick={() => openTranscript()} className="gap-2 border-white/10 bg-white/[0.04] text-white/70"><PlayCircle className="h-4 w-4" /> Replay Mission</Button>
              <Button variant="outline" onClick={onStartNew} className="gap-2 border-purple-300/20 bg-purple-400/10 text-purple-100"><RotateCcw className="h-4 w-4" /> Start New Mission</Button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <AgentRoster currentAgent={context.currentAgent} states={context.agentStates} />
        <div className="relative min-h-[600px] overflow-hidden rounded-[1.6rem] border border-cyan-200/12 bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,0.12),transparent_34%),linear-gradient(135deg,rgba(3,7,18,0.88),rgba(15,23,42,0.66))] p-5 shadow-[0_26px_100px_rgba(0,0,0,0.34)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <div className="absolute left-1/2 top-1/2 h-[430px] w-[430px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/10" />
            <div className="absolute left-1/2 top-1/2 h-[310px] w-[310px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-purple-200/10" />
            <div className="absolute inset-x-8 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />
            <div className="absolute inset-y-8 left-1/2 w-px bg-gradient-to-b from-transparent via-purple-300/22 to-transparent" />
          </div>

          <CouncilGraph currentAgent={context.currentAgent} />

          <div className="absolute inset-x-4 bottom-4 z-20 grid gap-3 md:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {latestDialogue.length ? latestDialogue.map((entry) => (
                <AgentSpeechBubble key={`${entry.agentId}-${entry.timestamp}`} entry={entry} onExpand={openTranscript} />
              )) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/50">
                  The council is assembling. Agent messages will appear here as specialists collaborate.
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button onClick={() => openTranscript()} variant="outline" className="absolute right-4 top-4 z-20 rounded-full border-white/10 bg-white/[0.055] text-white/70 hover:bg-white/[0.1] hover:text-white">
            Full Transcript
          </Button>
        </div>
        <MissionIntelligencePanel context={context} />
      </div>

      <WorkstreamStrip tasks={context.executionTasks} selectedId={selectedTask?.id} onSelect={selectTask} />
      <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white/52">
        Synchronization status: {context.missionGraph?.finalizationReadiness.status.replace(/_/g, " ") ?? "waiting for mission graph"}.
      </div>

      <TranscriptDrawer dialogue={context.dialogue} open={transcriptOpen} onOpenChange={setTranscriptOpen} focusEntry={focusEntry} />
      <WorkstreamInspector task={selectedTask} conflicts={selectedConflicts} open={inspectorOpen} onOpenChange={setInspectorOpen} />
    </motion.section>
  );
}

function CouncilGraph({ currentAgent }: { currentAgent: string | null }) {
  return (
    <div className="relative z-10 mx-auto mt-6 h-[420px] max-w-[640px]">
      <div className="absolute left-1/2 top-1/2 grid h-32 w-32 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-cyan-200/35 bg-cyan-300/[0.09] text-center shadow-[0_0_60px_rgba(34,211,238,0.2)]">
        <div>
          <Network className="mx-auto h-7 w-7 text-cyan-100" />
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">Mission Engine</p>
        </div>
      </div>
      {AGENT_DEFINITIONS.map((agent, index) => {
        const active = currentAgent === agent.role;
        return (
          <motion.div
            key={agent.id}
            animate={{ scale: active ? 1.08 : 1 }}
            className={`absolute ${POSITIONS[index] ?? POSITIONS[0]} grid h-24 w-24 place-items-center rounded-full border text-center transition-all duration-300 ${
              active ? "border-cyan-200/60 bg-cyan-300/[0.12] shadow-[0_0_44px_rgba(34,211,238,0.28)]" : "border-white/10 bg-white/[0.05]"
            }`}
          >
            <div>
              <div className="mx-auto grid h-9 w-9 place-items-center rounded-full" style={{ backgroundColor: `${agent.color}22`, color: agent.color }}>
                <Sparkles className={`h-4 w-4 ${active ? "animate-pulse" : ""}`} />
              </div>
              <p className="mt-1 line-clamp-2 px-2 text-[0.68rem] font-medium leading-tight text-white/78">{agent.name}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
