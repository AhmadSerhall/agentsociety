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
import { useHistoryStore, useMissionStore, useRuntimeSettingsStore } from "@/store";
import {
  MissionState,
  type MissionConfiguration,
  type MissionContext,
  type MissionHistoryEntry,
  type MissionReplayEvent,
} from "@/types";
import { downloadText, generateId, historyEntryToMarkdown } from "@/utils";
import type { MissionView } from "./mission-sidebar";

function cardClass() {
  return "rounded-2xl border border-cyan-200/10 bg-black/20 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)]";
}

const agentIconMap = {
  planner: BrainCircuit,
  research: Search,
  product: Lightbulb,
  technical: Network,
  marketing: Megaphone,
  finance: WalletCards,
  risk: ShieldAlert,
  mediator: Scale,
  finalizer: PackageCheck,
};

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
    agentStates: {
      planner: "complete",
      researcher: "complete",
      "product-strategist": "complete",
      "technical-architect": "complete",
      "marketing-strategist": "complete",
      finance: "complete",
      "risk-critic": "complete",
      mediator: "complete",
      finalizer: "complete",
    },
    executionTasks: [],
    progress: entry.finalReport ? 1 : 0.5,
    status: entry.finalReport ? MissionState.Completed : MissionState.Cancelled,
    startedAt: entry.timestamp,
    completedAt: entry.timestamp,
    replayEvents: entry.replayEvents ?? [],
  };
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
          const AgentIcon = agentIconMap[agent.id as keyof typeof agentIconMap] ?? Bot;
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

function MissionHistoryPage({ onOpenMissionControl, onReplay }: { onOpenMissionControl: () => void; onReplay: (events: MissionReplayEvent[]) => void }) {
  const entries = useHistoryStore((state) => state.entries);
  const remove = useHistoryStore((state) => state.remove);
  const setContext = useMissionStore((state) => state.setContext);
  const [deleteTarget, setDeleteTarget] = useState<MissionHistoryEntry | null>(null);

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
