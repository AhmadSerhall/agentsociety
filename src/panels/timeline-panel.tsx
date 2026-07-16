"use client";

import { AGENT_DEFINITIONS } from "@/agents";
import { Badge } from "@/components/ui/badge";
import { renderTimelineEntry } from "@/features/mission-control/components/council/presentation-renderer";
import { useMissionStore } from "@/store";
import { MissionState, type TimelineEntry } from "@/types";
import { formatDuration } from "@/utils";
import { useMemo } from "react";

const EMPTY_TIMELINE: NonNullable<ReturnType<typeof useMissionStore.getState>["context"]>["timeline"] = [];

export function TimelinePanel() {
  const context = useMissionStore((s) => s.context);
  const timeline = context?.timeline ?? EMPTY_TIMELINE;
  const chapters = useMemo(() => groupTimeline(timeline), [timeline]);

  if (timeline.length === 0) {
    return (
      <div className="rounded-2xl border border-cyan-200/10 bg-cyan-300/[0.035] p-5">
        <p className="text-sm font-semibold text-white">{context?.status === MissionState.Completed ? "This mission completed without recorded milestones" : "The mission story has not started yet"}</p>
        <p className="mt-2 text-sm leading-relaxed text-white/48">
          {context?.status === MissionState.Completed
            ? "The result is available, but this execution path did not emit narrative timeline events. Replay and report data remain unaffected."
            : "Milestones appear once the objective is understood, agents receive work, and findings begin changing the mission state."}
        </p>
      </div>
    );
  }

  const uniqueAgents = new Set(timeline.map((entry) => entry.agent)).size;
  const completedTasks = context?.executionTasks.filter((task) => task.status === "completed").length ?? 0;
  const resolvedConflicts = context?.conflicts.filter((conflict) => conflict.resolved).length ?? 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MilestoneStat label="Story chapters" value={chapters.length} detail={`${timeline.length} recorded milestones`} />
        <MilestoneStat label="Agent handoffs" value={uniqueAgents} detail="Distinct contributors in the story" />
        <MilestoneStat label="Completed tasks" value={completedTasks} detail={`${context?.executionTasks.length ?? 0} total task nodes`} />
        <MilestoneStat label="Resolved tensions" value={resolvedConflicts} detail={resolvedConflicts ? "Trade-offs reconciled" : "Consensus formed naturally"} />
      </div>

      {chapters.map((chapter, chapterIndex) => (
        <section key={`${chapter.title}-${chapterIndex}`} className="overflow-hidden rounded-2xl border border-white/10 bg-black/15">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 bg-gradient-to-r from-cyan-300/[0.07] to-purple-300/[0.04] p-4">
            <div>
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-cyan-100/48">Chapter {chapterIndex + 1}</p>
              <h3 className="mt-1 text-base font-semibold text-white">{chapter.title}</h3>
            </div>
            <Badge variant="outline" className="border-cyan-200/15 bg-cyan-300/[0.055] text-cyan-100/65">{chapter.entries.length} milestones</Badge>
          </div>
          <div className="relative p-4">
            <div className="absolute bottom-7 left-[29px] top-7 w-px bg-cyan-200/15" />
            {chapter.entries.map(({ entry, originalIndex }) => {
              const def = AGENT_DEFINITIONS.find((agent) => agent.role === entry.agent);
              const rendered = renderTimelineEntry(entry, originalIndex);
              return (
                <div key={`${entry.timestamp}-${originalIndex}`} className="relative flex items-start gap-3 pb-4 last:pb-0">
                  <div
                    className="relative z-10 mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[0.65rem] font-bold text-white"
                    style={{ borderColor: def?.color ?? "#22d3ee", backgroundColor: `${def?.color ?? "#22d3ee"}33` }}
                  >
                    {originalIndex + 1}
                  </div>
                  <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#07111f]/65 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">{rendered.title}</span>
                      <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-[0.65rem] capitalize text-white/55">{entry.kind ?? "agent"}</Badge>
                      {entry.duration != null && <span className="text-xs text-white/35">{formatDuration(entry.duration)}</span>}
                    </div>
                    {rendered.body && <p className="mt-2 text-sm leading-6 text-white/58">{rendered.body}</p>}
                    {entry.significance && <p className="mt-2 text-xs leading-relaxed text-cyan-100/48">{entry.significance}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function MilestoneStat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <p className="text-[0.64rem] uppercase tracking-[0.17em] text-white/36">{label}</p>
      <p className="mt-1 text-xl font-bold text-white tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-white/42">{detail}</p>
    </div>
  );
}

function groupTimeline(timeline: TimelineEntry[]) {
  const chapters: Array<{ key: MissionState; title: string; entries: Array<{ entry: TimelineEntry; originalIndex: number }> }> = [];
  timeline.forEach((entry, originalIndex) => {
    const key = entry.state;
    let chapter = chapters.at(-1);
    if (!chapter || chapter.key !== key) {
      chapter = { key, title: formatState(entry.state), entries: [] };
      chapters.push(chapter);
    }
    chapter.entries.push({ entry, originalIndex });
  });
  return chapters;
}

function formatState(state: MissionState) {
  return String(state)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
