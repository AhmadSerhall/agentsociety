"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AGENT_DEFINITIONS } from "@/agents";
import type { Workstream } from "@/types";
import { useMissionStore } from "@/store";
import { extractActionItemsFromText, sanitizeMissionList, sanitizeMissionText } from "@/utils";
import { CheckCircle2, CircleDashed, GitBranch, Loader2, Lock, RefreshCw } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

export function WorkstreamsPanel() {
  const workstreams = useMissionStore(useShallow((s) => s.context?.workstreams ?? []));

  if (workstreams.length === 0) {
    return <p className="text-sm italic text-white/45">Workstreams will appear once the Planner finishes.</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {workstreams.map((ws) => {
        const owner = AGENT_DEFINITIONS.find((agent) => agent.role === ws.assignedAgent);
        const confidence = ws.confidence ?? 78;
        const StatusIcon = getStatusIcon(ws.status);
        const ownerLabel = sanitizeMissionText(owner?.name ?? ws.owner ?? ws.responsibleAgent ?? "") || "Owner pending";
        const deliverables = sanitizeMissionList(ws.deliverables);
        const bullets = deliverables.length > 0 ? deliverables : extractActionItemsFromText(ws.output || ws.description, 4);
        return (
          <div key={ws.id} className={`rounded-2xl border p-4 ${ws.status === "blocked" ? "border-amber-200/30 bg-amber-400/10" : ws.status === "revised" ? "border-blue-200/25 bg-blue-400/10" : "border-cyan-200/10 bg-black/20"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-white">{sanitizeMissionText(ws.title)}</h4>
                <p className="mt-1 text-xs text-cyan-100/55">{ownerLabel}</p>
              </div>
              <Badge variant="outline" className="shrink-0 gap-1 border-white/10 bg-white/[0.04] text-xs capitalize text-white/70">
                <StatusIcon className={ws.status === "in_progress" ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
                {ws.status.replace("_", " ")}
              </Badge>
            </div>

            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/62">{sanitizeMissionText(ws.description)}</p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="outline" className="gap-1 border-cyan-200/15 bg-cyan-300/10 text-[0.65rem] text-cyan-100/75">
                <GitBranch className="h-3 w-3" />
                {ws.dependencies?.length || 0} dependencies
              </Badge>
              {ws.supportingAgentIds?.map((role) => {
                const support = AGENT_DEFINITIONS.find((agent) => agent.role === role);
                return support ? (
                  <Badge key={role} variant="outline" className="border-white/10 bg-white/[0.04] text-[0.65rem] text-white/55">
                    supports: {support.name}
                  </Badge>
                ) : null;
              })}
              {ws.nextStep && (
                <Badge variant="outline" className="border-blue-200/20 bg-blue-400/10 text-[0.65rem] text-blue-100/75">
                  planner revised
                </Badge>
              )}
            </div>

            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[0.68rem] text-white/45">
                <span>Confidence</span>
                <span>{confidence}%</span>
              </div>
              <Progress value={confidence} className="h-1.5 bg-white/10" />
            </div>

            {bullets.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {bullets.map((deliverable) => (
                  <li key={deliverable} className="flex gap-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-white/55">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-300" />
                    {deliverable}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function getStatusIcon(status: Workstream["status"]) {
  if (status === "completed") return CheckCircle2;
  if (status === "in_progress" || status === "ready") return Loader2;
  if (status === "blocked") return Lock;
  if (status === "revised") return RefreshCw;
  return CircleDashed;
}
