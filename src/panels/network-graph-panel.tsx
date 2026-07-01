"use client";

import { useMemo } from "react";
import { AGENT_DEFINITIONS } from "@/agents";
import { useMissionStore } from "@/store";

const POSITIONS = [
  { x: 50, y: 8 },
  { x: 20, y: 24 },
  { x: 80, y: 24 },
  { x: 12, y: 55 },
  { x: 88, y: 55 },
  { x: 30, y: 78 },
  { x: 70, y: 78 },
  { x: 50, y: 54 },
  { x: 50, y: 92 },
];

export function NetworkGraphPanel() {
  const currentAgent = useMissionStore((s) => s.context?.currentAgent);
  const dialogue = useMissionStore((s) => s.context?.dialogue);
  const completedRoles = useMemo(() => new Set(dialogue?.map((entry) => entry.agentRole) ?? []), [dialogue]);
  const hasConflict = useMissionStore((s) => (s.context?.conflicts.length ?? 0) > 0);

  return (
    <div className="relative h-[420px] overflow-hidden rounded-2xl border border-cyan-200/10 bg-black/20">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {POSITIONS.map((position, index) => {
          if (index === POSITIONS.length - 1) return null;
          const mediator = POSITIONS[7];
          return (
            <line
              key={`line-${index}`}
              x1={position.x}
              y1={position.y}
              x2={mediator.x}
              y2={mediator.y}
              stroke={hasConflict ? "rgba(34,211,238,0.32)" : "rgba(255,255,255,0.12)"}
              strokeWidth="0.35"
            />
          );
        })}
        <line x1={POSITIONS[7].x} y1={POSITIONS[7].y} x2={POSITIONS[8].x} y2={POSITIONS[8].y} stroke="rgba(168,85,247,0.35)" strokeWidth="0.45" />
      </svg>

      {AGENT_DEFINITIONS.map((agent, index) => {
        const position = POSITIONS[index];
        const active = currentAgent === agent.role;
        const complete = completedRoles.has(agent.role);
        return (
          <div
            key={agent.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
          >
            <div
              className={`mx-auto grid h-12 w-12 place-items-center rounded-full border text-xs font-bold text-white transition-all ${active ? "scale-110 animate-pulse shadow-[0_0_34px_rgba(34,211,238,0.45)]" : ""}`}
              style={{ borderColor: agent.color, backgroundColor: complete || active ? `${agent.color}55` : "rgba(255,255,255,0.06)" }}
            >
              {agent.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
            </div>
            <p className="mt-2 max-w-24 text-[0.65rem] leading-4 text-white/60">{agent.name}</p>
          </div>
        );
      })}
    </div>
  );
}
