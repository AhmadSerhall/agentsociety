"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, GitBranch, ShieldCheck, Sparkles } from "lucide-react";
import { AGENT_DEFINITIONS } from "@/agents";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useRuntimeSettingsStore } from "@/store";
import type { AgentDialogueEntry, AgentRole, MissionContext } from "@/types";
import { normalizeDialogueEntry } from "./agent-output-formatter";

export function AgentContributionDrawer({
  entry,
  context,
  open,
  onOpenChange,
}: {
  entry: AgentDialogueEntry | null;
  context: MissionContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const debugMode = useRuntimeSettingsStore((s) => s.developerDebugMode);
  const agentRole = entry?.agentRole;
  const definition = AGENT_DEFINITIONS.find((agent) => agent.role === agentRole);

  const agentMessages = useMemo(
    () => context.dialogue.filter((message) => message.agentRole === agentRole),
    [agentRole, context.dialogue],
  );
  const agentTasks = useMemo(
    () => context.executionTasks.filter((task) => task.agent === agentRole || task.supportingAgents?.includes(agentRole as AgentRole)),
    [agentRole, context.executionTasks],
  );
  const agentConflicts = useMemo(
    () => context.conflicts.filter((conflict) => {
      const haystack = `${conflict.agents.join(" ")} ${conflict.agentsInvolved?.join(" ") ?? ""}`.toLowerCase();
      return agentRole ? haystack.includes(agentRole) || haystack.includes(agentRole.replace(/-/g, " ")) : false;
    }),
    [agentRole, context.conflicts],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full border-cyan-200/15 bg-[#07111f]/95 p-0 text-white shadow-[0_0_90px_rgba(34,211,238,0.18)] backdrop-blur-2xl sm:max-w-2xl">
        <SheetHeader className="sticky top-0 z-10 border-b border-cyan-200/10 bg-[#07111f]/90 p-5 backdrop-blur-2xl">
          <SheetTitle className="pr-8 text-white">Agent Contribution</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 overflow-y-auto p-5 [scrollbar-color:rgba(34,211,238,0.65)_transparent] [scrollbar-width:thin]">
          {!entry ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-white/50">Select an agent message to inspect its contribution.</p>
          ) : (
            <>
              <section className="rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.055] p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border" style={{ borderColor: `${definition?.color ?? "#22d3ee"}88`, backgroundColor: `${definition?.color ?? "#22d3ee"}22` }}>
                    <Sparkles className="h-5 w-5" style={{ color: definition?.color ?? "#22d3ee" }} />
                  </div>
                  <div>
                    <Badge className="mb-2 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/10">{entry.agentRole.replace(/-/g, " ")}</Badge>
                    <h3 className="text-xl font-semibold text-white">{entry.agentName}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-white/58">{definition?.capabilities.join(" - ")}</p>
                  </div>
                </div>
              </section>

              <ContributionSection title="Selected Contribution" icon={<Sparkles className="h-4 w-4" />}>
                <ContributionMessage message={entry} debugMode={debugMode} />
              </ContributionSection>

              <ContributionSection title="Related Workstreams" icon={<GitBranch className="h-4 w-4" />}>
                {agentTasks.length ? agentTasks.map((task) => (
                  <div key={task.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white">{task.title}</p>
                      <Badge className="bg-white/10 text-white/60 hover:bg-white/10">{task.confidence}%</Badge>
                    </div>
                    <p className="mt-1 text-xs capitalize text-white/42">{task.status.replace(/-/g, " ")} - {task.dependencies.length ? `${task.dependencies.length} dependencies` : "no dependencies"}</p>
                  </div>
                )) : <EmptyCopy>No workstreams are attached to this agent yet.</EmptyCopy>}
              </ContributionSection>

              {entry.agentRole === "risk-critic" && (
                <ContributionSection title="Challenged Assumptions" icon={<AlertTriangle className="h-4 w-4" />}>
                  {agentConflicts.length ? agentConflicts.map((conflict) => (
                    <ConflictCard key={conflict.id} title={conflict.title ?? "Risk challenge"} body={conflict.summary ?? conflict.description} />
                  )) : <EmptyCopy>No risk conflicts were created by this agent.</EmptyCopy>}
                </ContributionSection>
              )}

              {entry.agentRole === "mediator" && (
                <ContributionSection title="Mediator Decisions" icon={<ShieldCheck className="h-4 w-4" />}>
                  {context.conflicts.filter((conflict) => conflict.resolved || conflict.mediatorDecision || conflict.resolution).length ? context.conflicts.filter((conflict) => conflict.resolved || conflict.mediatorDecision || conflict.resolution).map((conflict) => (
                    <ConflictCard key={conflict.id} title={conflict.title ?? "Resolved conflict"} body={conflict.mediatorDecision ?? conflict.resolution ?? conflict.resolvedAction ?? "Resolved without a detailed note."} />
                  )) : <EmptyCopy>No mediator resolutions are recorded yet.</EmptyCopy>}
                </ContributionSection>
              )}

              <ContributionSection title={`${entry.agentName} Messages`}>
                {agentMessages.length ? agentMessages.map((message) => <ContributionMessage key={`${message.agentId}-${message.timestamp}`} message={message} debugMode={debugMode} />) : <EmptyCopy>No messages found for this agent.</EmptyCopy>}
              </ContributionSection>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ContributionSection({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-center gap-2 text-cyan-100">
        {icon}
        <h4 className="text-sm font-semibold text-white">{title}</h4>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ContributionMessage({ message, debugMode }: { message: AgentDialogueEntry; debugMode: boolean }) {
  const output = normalizeDialogueEntry(message);
  return (
    <article className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-white">{message.agentName}</span>
        <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-[0.65rem] capitalize text-white/58">{output.type}</Badge>
        <span className="text-xs text-white/35">{new Date(message.timestamp).toLocaleTimeString()}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/64">{output.summary}</p>
      {output.bullets.length > 0 && <ul className="mt-2 space-y-1 text-sm text-white/54">{output.bullets.map((bullet) => <li key={bullet}>- {bullet}</li>)}</ul>}
      {debugMode && (
        <details className="mt-3 rounded-xl border border-purple-200/10 bg-purple-300/[0.045] p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-purple-100">Raw Output</summary>
          <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap break-words text-xs text-white/58">{output.raw}</pre>
        </details>
      )}
    </article>
  );
}

function ConflictCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-amber-200/15 bg-amber-300/[0.055] p-3">
      <p className="text-sm font-medium text-amber-100">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-white/58">{body}</p>
    </div>
  );
}

function EmptyCopy({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm italic text-white/42">{children}</p>;
}
