/**
 * Mission Graph Panel - shows dynamic workstreams instead of a fixed pipeline.
 */

"use client";

import { motion } from "framer-motion";
import { getAgentByRole } from "@/agents";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useMissionStore } from "@/store";
import type { ExecutionTask, MissionGraph } from "@/types";
import { CheckCircle2, CircleDashed, GitBranch, Loader2, Lock, RefreshCw, UsersRound } from "lucide-react";

const statusTone: Record<ExecutionTask["status"], string> = {
  pending: "border-white/10 bg-white/[0.025] text-white/50",
  ready: "border-cyan-200/25 bg-cyan-300/10 text-cyan-100",
  running: "border-purple-200/35 bg-purple-400/10 text-purple-100 shadow-[0_0_28px_rgba(168,85,247,0.16)]",
  blocked: "border-amber-200/35 bg-amber-400/10 text-amber-100",
  completed: "border-emerald-200/25 bg-emerald-400/10 text-emerald-100",
  revised: "border-blue-200/25 bg-blue-400/10 text-blue-100",
  cancelled: "border-red-200/25 bg-red-400/10 text-red-100",
};

export function AgentWorkflowPanel() {
  const context = useMissionStore((s) => s.context);
  const tasks = context?.executionTasks ?? [];
  const graph = context?.missionGraph;

  if (tasks.length === 0) {
    return <p className="text-sm italic text-white/45">Planner will create the Mission Graph after launch.</p>;
  }

  const groups = graph?.parallelGroups?.length ? graph.parallelGroups : buildParallelGroups(tasks);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 md:grid-cols-4">
        <GraphMetric label="Task nodes" value={String(tasks.length)} />
        <GraphMetric label="Parallel waves" value={String(groups.length)} />
        <GraphMetric label="Conflicts" value={String(graph?.conflicts.length ?? context?.conflicts.length ?? 0)} />
        <GraphMetric label="Synthesis" value={graph?.finalizationReadiness.status.replace(/_/g, " ") ?? "not ready"} />
      </div>

      <div className="space-y-3">
        {groups.map((group, groupIndex) => {
          const groupTasks = getGroupTasks(group, tasks);
          return (
          <section key={`${group.id}-${groupTasks.map((task) => task.id).join("-")}`} className="rounded-2xl border border-cyan-200/10 bg-black/20 p-3">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/45">
                <GitBranch className="h-3.5 w-3.5 text-cyan-200/70" />
                {group.title || `Collaboration Wave ${groupIndex + 1}`}
              </div>
              <span className="text-xs text-white/38">{group.description}</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {groupTasks.map((task) => {
                const agent = getAgentByRole(task.agent);
                const supportingAgents = task.supportingAgents?.map((role) => getAgentByRole(role)).filter(Boolean) ?? [];
                const dependencies = task.dependencies
                  .map((dependencyId) => tasks.find((candidate) => candidate.id === dependencyId)?.title)
                  .filter(Boolean);
                const StatusIcon = getStatusIcon(task.status);

                return (
                  <motion.article
                    key={task.id}
                    layout
                    className={cn("rounded-xl border p-3 transition", statusTone[task.status])}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="break-words text-sm font-semibold text-white">{task.title}</h4>
                        <p className="mt-1 text-xs text-white/48">
                          Primary: {agent?.name ?? task.agent}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 gap-1 border-white/10 bg-black/20 text-[0.65rem] capitalize text-inherit">
                        <StatusIcon className={cn("h-3 w-3", task.status === "running" && "animate-spin")} />
                        {task.status}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200/15 bg-cyan-300/10 px-2 py-0.5 text-[0.65rem] text-cyan-100/80">
                        <UsersRound className="h-3 w-3" />
                        {[agent?.name, ...supportingAgents.map((support) => support?.name)].filter(Boolean).join(" + ")}
                      </span>
                    </div>
                    {task.description && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/50">{task.description}</p>}
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[0.65rem] text-white/42">
                        <span>Confidence</span>
                        <span>{task.confidence}%</span>
                      </div>
                      <Progress value={task.confidence} className="h-1.5 bg-white/10" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {dependencies.length ? dependencies.map((dependency) => (
                        <span key={dependency} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[0.65rem] text-white/45">
                          waits for {dependency}
                        </span>
                      )) : (
                        <span className="rounded-full border border-cyan-200/15 bg-cyan-300/10 px-2 py-0.5 text-[0.65rem] text-cyan-100/75">can run now: no dependencies</span>
                      )}
                      {dependencies.length > 0 && task.status !== "completed" && (
                        <span className="rounded-full border border-amber-200/15 bg-amber-300/10 px-2 py-0.5 text-[0.65rem] text-amber-100/75">
                          waiting for upstream evidence
                        </span>
                      )}
                      {task.revisionNote && (
                        <span className="rounded-full border border-blue-200/20 bg-blue-400/10 px-2 py-0.5 text-[0.65rem] text-blue-100/80">
                          revised
                        </span>
                      )}
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </section>
        );
        })}
      </div>
    </div>
  );
}

function buildParallelGroups(tasks: ExecutionTask[]): MissionGraph["parallelGroups"] {
  const groups: ExecutionTask[][] = [];
  const remaining = [...tasks];
  const completed = new Set<string>();

  while (remaining.length) {
    const ready = remaining.filter((task) => task.dependencies.every((dependency) => completed.has(dependency)));
    const group = ready.length ? ready : [remaining[0]];
    groups.push(group);
    group.forEach((task) => {
      completed.add(task.id);
      const index = remaining.findIndex((candidate) => candidate.id === task.id);
      if (index >= 0) remaining.splice(index, 1);
    });
  }

  const names = [
    ["Discovery Wave", "Research and baseline workstreams that can start immediately."],
    ["Design Wave", "Offer, pricing, architecture, and execution design workstreams."],
    ["Activation Wave", "Outreach, risk review, and readiness workstreams."],
    ["Synthesis Wave", "Final coordination before report synthesis."],
  ];
  return groups.map((group, index) => ({
    id: `group-${index + 1}`,
    title: names[index]?.[0] ?? `Collaboration Wave ${index + 1}`,
    description: names[index]?.[1] ?? "Agents collaborate on ready graph nodes.",
    taskIds: group.map((task) => task.id),
  }));
}

function getGroupTasks(group: MissionGraph["parallelGroups"][number], tasks: ExecutionTask[]) {
  return group.taskIds.map((taskId) => tasks.find((task) => task.id === taskId)).filter((task): task is ExecutionTask => Boolean(task));
}

function getStatusIcon(status: ExecutionTask["status"]) {
  if (status === "completed") return CheckCircle2;
  if (status === "running") return Loader2;
  if (status === "blocked") return Lock;
  if (status === "revised") return RefreshCw;
  return CircleDashed;
}

function GraphMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize text-white">{value}</p>
    </div>
  );
}
