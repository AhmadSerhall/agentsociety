/**
 * Agent Workflow Panel — shows the pipeline of agents and their status.
 */

"use client";

import { motion } from "framer-motion";
import { AGENT_DEFINITIONS } from "@/agents";
import { AgentRole, AgentStatus, MissionState, STATE_AGENT_MAP } from "@/types";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMissionStore } from "@/store";
import { useShallow } from "zustand/react/shallow";

const PIPELINE_ORDER: AgentRole[] = [
  AgentRole.Planner, AgentRole.Researcher, AgentRole.ProductStrategist, AgentRole.TechnicalArchitect,
  AgentRole.MarketingStrategist, AgentRole.Finance, AgentRole.RiskCritic, AgentRole.Mediator, AgentRole.Finalizer,
];

function getAgentState(status: AgentStatus | null): "done" | "active" | "waiting" {
  if (status === AgentStatus.Finished) return "done";
  if (status === AgentStatus.Thinking || status === AgentStatus.Streaming) return "active";
  return "waiting";
}

export function AgentWorkflowPanel() {
  const status = useMissionStore((s) => s.context?.status);
  const currentAgent = useMissionStore((s) => s.context?.currentAgent);

  return (
    <div className="space-y-1">
      {PIPELINE_ORDER.map((role, i) => {
        const def = AGENT_DEFINITIONS.find((a) => a.role === role)!;
        const isActive = currentAgent === role;
        const isDone = isAgentDone(role, status);
        const state = isActive ? "active" : isDone ? "done" : "waiting";

        return (
          <div key={role} className="flex items-center gap-2.5 py-1.5">
            {i > 0 && <div className="absolute ml-3.5 -mt-7 h-5 w-px bg-border" />}
            <div className="relative">
              {state === "done" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : state === "active" ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <Loader2 className="h-4 w-4" style={{ color: def.color }} />
                </motion.div>
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/40" />
              )}
            </div>
            <span className={cn("text-sm", state === "active" ? "font-medium" : "text-muted-foreground")}>
              {def.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function isAgentDone(role: AgentRole, missionStatus?: MissionState): boolean {
  if (!missionStatus) return false;
  const order = [
    MissionState.Planning, MissionState.Researching, MissionState.ProductStrategy,
    MissionState.TechnicalArchitecture, MissionState.MarketingStrategy,
    MissionState.FinancialAnalysis, MissionState.RiskReview,
    MissionState.ConflictResolution, MissionState.Finalizing,
  ];
  const stateForRole = Object.entries(STATE_AGENT_MAP).find(([, r]) => r === role)?.[0] as MissionState | undefined;
  if (!stateForRole) return false;
  const currentIdx = order.indexOf(missionStatus);
  const roleIdx = order.indexOf(stateForRole);
  return currentIdx > roleIdx || missionStatus === MissionState.Completed;
}
