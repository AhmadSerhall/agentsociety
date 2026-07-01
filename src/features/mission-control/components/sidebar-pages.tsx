"use client";

import { useMemo } from "react";
import {
  Bot,
  CheckCircle2,
  Copy,
  Download,
  FileJson,
  FileText,
  History,
  RotateCcw,
  Settings,
  Trash2,
} from "lucide-react";
import { AGENT_DEFINITIONS } from "@/agents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getQwenRuntimeInfo } from "@/services/qwen";
import { useHistoryStore, useMissionStore, useRuntimeSettingsStore } from "@/store";
import {
  MissionState,
  type MissionConfiguration,
  type MissionContext,
  type MissionHistoryEntry,
} from "@/types";
import { downloadText, generateId, historyEntryToMarkdown } from "@/utils";
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
    dialogue: entry.dialogue.map((dialogue, index) => ({
      agentId: `history-${index}`,
      agentName: dialogue.agentName,
      agentRole: AGENT_DEFINITIONS[index]?.role ?? AGENT_DEFINITIONS[0].role,
      content: dialogue.content,
      timestamp: entry.timestamp,
    })),
    timeline: [],
    efficiencyMetrics: entry.efficiencyMetrics,
    currentAgent: null,
    progress: entry.finalReport ? 1 : 0.5,
    status: entry.finalReport ? MissionState.Completed : MissionState.Cancelled,
    startedAt: entry.timestamp,
    completedAt: entry.timestamp,
  };
}

export function SidebarPageView({
  activeView,
  onDuplicate,
  onOpenMissionControl,
}: {
  activeView: Exclude<MissionView, "mission-control">;
  onDuplicate: (brief: string, config: Partial<MissionConfiguration>) => void;
  onOpenMissionControl: () => void;
}) {
  if (activeView === "agents") return <AgentsPage />;
  if (activeView === "history") return <MissionHistoryPage onDuplicate={onDuplicate} onOpenMissionControl={onOpenMissionControl} />;
  if (activeView === "reports") return <ReportsPage />;
  return <SettingsPage />;
}

function AgentsPage() {
  const context = useMissionStore((state) => state.context);
  const completedRoles = useMemo(() => new Set(context?.dialogue.map((entry) => entry.agentRole) ?? []), [context?.dialogue]);

  return (
    <section className="space-y-5">
      <PageHeader icon={Bot} title="Agents" meta={`${AGENT_DEFINITIONS.length} mission specialists`} description="Every mission runs through a fixed specialist pipeline: plan, research, strategize, architect, market, finance, critique, mediate, and synthesize." />
      <div className={cardClass()}>
        <h3 className="text-sm font-semibold text-white">Agent Society Pipeline</h3>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {AGENT_DEFINITIONS.map((agent, index) => (
            <div key={agent.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
              <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: agent.color }}>{index + 1}</span>
              <span className="text-xs text-white/70">{agent.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {AGENT_DEFINITIONS.map((agent) => {
          const active = context?.currentAgent === agent.role;
          const complete = completedRoles.has(agent.role);
          return (
            <article key={agent.id} className={cardClass()}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: agent.color }}>
                    {agent.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
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

function MissionHistoryPage({ onDuplicate, onOpenMissionControl }: { onDuplicate: (brief: string, config: Partial<MissionConfiguration>) => void; onOpenMissionControl: () => void }) {
  const entries = useHistoryStore((state) => state.entries);
  const remove = useHistoryStore((state) => state.remove);
  const setContext = useMissionStore((state) => state.setContext);

  return (
    <section className="space-y-5">
      <PageHeader icon={History} title="Mission History" meta={`${entries.length} saved missions`} description="Completed and cancelled missions are stored locally in your browser." />
      {entries.length === 0 ? <EmptyState title="No mission history yet" body="Complete or cancel a mission and it will appear here for review." /> : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <article key={entry.id} className={cardClass()}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">{entry.missionBrief}</h3>
                  <p className="mt-1 text-sm text-white/45">{new Date(entry.timestamp).toLocaleString()} · {entry.finalReport ? "Completed" : "Cancelled / partial"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setContext(contextFromHistory(entry)); onOpenMissionControl(); }} className="border-white/10 bg-white/[0.04] text-white/70">Reopen</Button>
                  <Button size="sm" variant="outline" onClick={() => onDuplicate(entry.missionBrief, entry.configuration)} className="gap-1 border-white/10 bg-white/[0.04] text-white/70"><RotateCcw className="h-3.5 w-3.5" /> Duplicate</Button>
                  <Button size="sm" variant="outline" onClick={() => remove(entry.id)} className="gap-1 border-red-300/20 bg-red-400/10 text-red-100"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ReportsPage() {
  const reports = useHistoryStore((state) => state.entries.filter((entry) => entry.finalReport));

  return (
    <section className="space-y-5">
      <PageHeader icon={FileText} title="Reports" meta={`${reports.length} saved reports`} description="Review, copy, and export reports generated by Agent Society." />
      {reports.length === 0 ? <EmptyState title="No saved reports yet" body="Run a mission to completion and the final report will appear here." /> : (
        <div className="space-y-3">
          {reports.map((entry) => {
            const markdown = historyEntryToMarkdown(entry);
            return (
              <article key={entry.id} className={cardClass()}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-white">{entry.missionBrief}</h3>
                    <p className="mt-1 text-sm text-white/45">{new Date(entry.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => copyText(markdown)} className="gap-1 border-white/10 bg-white/[0.04] text-white/70"><Copy className="h-3.5 w-3.5" /> Copy Markdown</Button>
                    <Button size="sm" variant="outline" onClick={() => downloadText(`${filenameSafe(entry.missionBrief)}.md`, markdown, "text/markdown")} className="gap-1 border-white/10 bg-white/[0.04] text-white/70"><Download className="h-3.5 w-3.5" /> Markdown</Button>
                    <Button size="sm" variant="outline" onClick={() => downloadText(`${filenameSafe(entry.missionBrief)}.json`, JSON.stringify(entry, null, 2), "application/json")} className="gap-1 border-white/10 bg-white/[0.04] text-white/70"><FileJson className="h-3.5 w-3.5" /> JSON</Button>
                  </div>
                </div>
                <details className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-cyan-100">View report</summary>
                  <pre className="mt-3 max-h-[52vh] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-white/64">
                    {markdown}
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

  return (
    <section className="space-y-5">
      <PageHeader icon={Settings} title="Settings" meta={`Current mode: ${runtime.provider}`} description="Runtime settings stay frontend-only. API keys must be provided through .env.local and are never displayed here." />
      <div className={cardClass()}>
        <h3 className="text-sm font-semibold text-white">Qwen Runtime</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Info label="Provider" value={runtime.provider} />
          <Info label="Model" value={runtime.model} />
          <Info label="Base URL Host" value={runtime.baseHost} />
        </div>
        <p className="mt-4 text-sm leading-relaxed text-white/55">
          Set `NEXT_PUBLIC_QWEN_API_KEY`, `NEXT_PUBLIC_QWEN_BASE_URL`, and `NEXT_PUBLIC_QWEN_MODEL` in `.env.local`. Because this app is frontend-only, use restricted test keys only.
        </p>
      </div>
      <div className={`${cardClass()} flex items-center justify-between gap-4`}>
        <div>
          <h3 className="text-sm font-semibold text-white">Allow mock fallback on Qwen failure</h3>
          <p className="mt-1 text-sm text-white/50">When off, Qwen failures stop the mission with a clear error instead of pretending Qwen succeeded.</p>
        </div>
        <Switch checked={allowMockFallback} onCheckedChange={setAllowMockFallback} />
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
