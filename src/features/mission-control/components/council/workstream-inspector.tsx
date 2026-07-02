"use client";

import { GitBranch, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ConflictInfo, ExecutionTask } from "@/types";
import { displayTaskOutput, displayWorkstreamTitle } from "./agent-output-formatter";

export function WorkstreamInspector({ task, conflicts, open, onOpenChange }: { task: ExecutionTask | null; conflicts: ConflictInfo[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full border-cyan-200/15 bg-[#07111f]/94 p-0 text-white shadow-[0_0_90px_rgba(34,211,238,0.18)] backdrop-blur-2xl sm:max-w-xl">
        <SheetHeader className="sticky top-0 z-10 border-b border-cyan-200/10 bg-[#07111f]/90 p-5 backdrop-blur-2xl">
          <SheetTitle className="pr-8 text-white">Workstream Inspector</SheetTitle>
        </SheetHeader>
        {task ? (
          <div className="space-y-4 overflow-y-auto p-5 [scrollbar-color:rgba(34,211,238,0.65)_transparent] [scrollbar-width:thin]">
            <div className="rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.055] p-4">
              <Badge className="mb-3 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/10">{task.status}</Badge>
              <h3 className="text-xl font-semibold text-white">{displayWorkstreamTitle(task)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/58">{task.description ?? "No description supplied yet."}</p>
            </div>
            <InfoGrid task={task} />
            <Section title="Dependencies" icon={<GitBranch className="h-4 w-4" />}>
              {task.dependencies.length ? task.dependencies.map((dep) => <Pill key={dep}>{dep}</Pill>) : <p className="text-sm text-white/45">No dependencies. This workstream can begin immediately.</p>}
            </Section>
            <Section title="Collaborators" icon={<UsersRound className="h-4 w-4" />}>
              <Pill>{task.agent.replace(/-/g, " ")}</Pill>
              {task.supportingAgents?.map((agent) => <Pill key={agent}>{agent.replace(/-/g, " ")}</Pill>)}
            </Section>
            <Section title="Current Output">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/64">{displayTaskOutput(task.output)}</p>
            </Section>
            <Section title="Conflicts">
              {conflicts.length ? conflicts.map((conflict) => (
                <div key={conflict.id} className="rounded-xl border border-amber-200/15 bg-amber-300/[0.055] p-3">
                  <p className="text-sm font-medium text-amber-100">{conflict.title ?? "Active disagreement"}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/58">{conflict.summary ?? conflict.description}</p>
                </div>
              )) : <p className="text-sm text-white/45">No conflicts attached to this workstream.</p>}
            </Section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function InfoGrid({ task }: { task: ExecutionTask }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Info label="Primary" value={task.agent.replace(/-/g, " ")} />
      <Info label="Confidence" value={`${task.confidence}%`} />
      <Info label="Status" value={task.status.replace(/-/g, " ")} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[0.68rem] uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize text-white">{value}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-center gap-2 text-cyan-100">
        {icon}
        <h4 className="text-sm font-semibold text-white">{title}</h4>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs capitalize text-white/62">{children}</span>;
}
