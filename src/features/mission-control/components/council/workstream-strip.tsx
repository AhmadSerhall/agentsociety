"use client";

import { GitFork, Lock, RadioTower, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { ExecutionTask } from "@/types";
import { displayWorkstreamTitle } from "./agent-output-formatter";

export function WorkstreamStrip({ tasks, selectedId, onSelect }: { tasks: ExecutionTask[]; selectedId?: string; onSelect: (task: ExecutionTask) => void }) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-[1.35rem] border border-cyan-200/10 bg-black/24 p-4 text-sm text-white/45">
        Workstreams will appear here after the Planner creates the Mission Graph.
      </div>
    );
  }

  return (
    <section data-workstream-strip className="rounded-[1.35rem] border border-cyan-200/10 bg-black/24 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Workstream Strip</h3>
        <p className="text-xs text-white/38">Click a card for inspector</p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-color:rgba(34,211,238,0.65)_transparent] [scrollbar-width:thin]">
        {tasks.map((task) => {
          const active = task.status === "running";
          const blocked = task.status === "blocked";
          const selected = selectedId === task.id;
          return (
            <Button
              key={task.id}
              type="button"
              variant="outline"
              onClick={() => onSelect(task)}
              className={`h-auto min-w-[230px] justify-start rounded-2xl border p-3 text-left transition-all duration-300 hover:-translate-y-0.5 ${
                selected ? "border-cyan-200/45 bg-cyan-300/[0.09]" : active ? "border-purple-200/35 bg-purple-300/[0.07]" : blocked ? "border-amber-200/35 bg-amber-300/[0.07]" : "border-white/10 bg-white/[0.035]"
              }`}
            >
              <div className="w-full">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{displayWorkstreamTitle(task)}</p>
                  {blocked ? <Lock className="h-4 w-4 shrink-0 text-amber-200" /> : active ? <RadioTower className="h-4 w-4 shrink-0 animate-pulse text-purple-200" /> : <Sparkles className="h-4 w-4 shrink-0 text-cyan-200/70" />}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Chip>{task.agent.replace(/-/g, " ")}</Chip>
                  {task.dependencies.length > 0 && <Chip><GitFork className="mr-1 h-3 w-3" /> {task.dependencies.length} deps</Chip>}
                  <Chip>{task.confidence}%</Chip>
                  <Chip>{task.status}</Chip>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/42">
                  {task.dependencies.length ? `Waiting for ${task.dependencies.length} dependency checkpoint${task.dependencies.length > 1 ? "s" : ""}.` : "Can run now because no upstream dependency blocks it."}
                </p>
              </div>
            </Button>
          );
        })}
      </div>
    </section>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[0.68rem] capitalize text-white/58">{children}</span>;
}
