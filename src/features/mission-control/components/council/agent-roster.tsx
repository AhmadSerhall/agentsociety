"use client";

import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { AGENT_DEFINITIONS } from "@/agents";
import { Badge } from "@/components/ui/badge";
import type { AgentRole, AgentThinkingState } from "@/types";
import { AgentIconGlyph } from "../agent-icons";

export function AgentRoster({ currentAgent, states }: { currentAgent: AgentRole | null; states: Record<AgentRole, AgentThinkingState> }) {
  return (
    <aside className="rounded-[1.35rem] border border-cyan-200/10 bg-black/24 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Agent Roster</h3>
        <Badge className="bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/10">Live</Badge>
      </div>
      <div className="mt-4 space-y-2">
        {AGENT_DEFINITIONS.map((agent) => {
          const active = currentAgent === agent.role || states[agent.role] === "thinking" || states[agent.role] === "analyzing" || states[agent.role] === "reviewing";
          const complete = states[agent.role] === "complete";
          return (
            <div
              key={agent.id}
              className={`group flex items-center gap-3 rounded-2xl border p-3 transition-all duration-300 ${
                active ? "border-cyan-200/35 bg-cyan-300/[0.08] shadow-[0_0_28px_rgba(34,211,238,0.15)]" : "border-white/10 bg-white/[0.035]"
              }`}
            >
              <div
                className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl border text-white"
                style={{ borderColor: `${agent.color}88`, backgroundColor: `${agent.color}22` }}
              >
                <AgentIconGlyph agentId={agent.id} className={`h-4 w-4 ${active ? "animate-pulse" : ""}`} style={{ color: agent.color }} />
                {active && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-cyan-200 shadow-[0_0_14px_rgba(103,232,249,0.9)]" />}
                {/* {complete && !active && (
                  <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-emerald-100/50 bg-slate-950">
                    <CheckCircle2 className="h-2.5 w-2.5 text-emerald-200" />
                  </span>
                )} */}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{agent.name}</p>
                <p className="truncate text-xs text-white/42">{agent.capabilities[0]}</p>
              </div>
              <span className="text-white/45">
                {active ? <Loader2 className="h-4 w-4 animate-spin text-cyan-100" /> : complete ? <Sparkles className="h-4 w-4 text-emerald-200" /> : null}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
