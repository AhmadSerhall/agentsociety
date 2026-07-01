"use client";

import { useMemo } from "react";
import { AGENT_DEFINITIONS } from "@/agents";
import { useMissionStore } from "@/store";
import { cn } from "@/lib/utils";

export function NetworkGraphPanel({ className }: { className?: string }) {
  const currentAgent = useMissionStore((s) => s.context?.currentAgent);
  const context = useMissionStore((s) => s.context);
  const dialogue = context?.dialogue;
  const completedRoles = useMemo(() => new Set(dialogue?.map((entry) => entry.agentRole) ?? []), [dialogue]);
  const nodes = useMemo(() => {
    const roles = new Set([
      ...(context?.executionTasks.map((task) => task.agent) ?? []),
      ...(context?.dialogue.map((entry) => entry.agentRole) ?? []),
      ...(context?.conflicts.length ? ["mediator" as const] : []),
      "planner" as const,
      "finalizer" as const,
    ]);
    return AGENT_DEFINITIONS.filter((agent) => roles.has(agent.role));
  }, [context?.conflicts.length, context?.dialogue, context?.executionTasks]);
  const positions = useMemo(() => {
    const centerRole = nodes.some((agent) => agent.role === "technical-architect") ? "technical-architect" : nodes.some((agent) => agent.role === "product-strategist") ? "product-strategist" : "planner";
    const centerIndex = Math.max(0, nodes.findIndex((agent) => agent.role === centerRole));
    return nodes.map((agent, index) => {
      if (index === centerIndex) return { x: 50, y: 48 };
      const angle = ((index / Math.max(1, nodes.length - 1)) * Math.PI * 2) - Math.PI / 2;
      return { x: 50 + Math.cos(angle) * 34, y: 50 + Math.sin(angle) * 34 };
    });
  }, [nodes]);
  const edges = useMemo(() => {
    const taskEdges = context?.executionTasks.flatMap((task) =>
      task.dependencies.map((dependencyId) => {
        const source = context.executionTasks.find((candidate) => candidate.id === dependencyId);
        return source ? { from: source.agent, to: task.agent, kind: "dependency" } : null;
      }).filter((edge): edge is { from: typeof task.agent; to: typeof task.agent; kind: string } => Boolean(edge))
    ) ?? [];
    const dialogueEdges = context?.dialogue.slice(1).map((entry, index) => ({
      from: context.dialogue[index].agentRole,
      to: entry.agentRole,
      kind: "dialogue",
    })) ?? [];
    const conflictEdges = context?.conflicts.length ? context.conflicts.flatMap(() =>
      [context.currentAgent, ...Array.from(completedRoles)].filter(Boolean).map((role) => ({ from: role!, to: "mediator" as const, kind: "conflict" }))
    ) : [];
    return [...taskEdges, ...dialogueEdges, ...conflictEdges];
  }, [completedRoles, context]);

  const positionForRole = (role: string) => {
    const index = nodes.findIndex((agent) => agent.role === role);
    return positions[index] ?? { x: 50, y: 50 };
  };

  return (
    <div className={cn("relative h-[420px] overflow-hidden rounded-2xl border border-cyan-200/10 bg-black/20", className)}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {edges.map((edge, index) => {
          const source = positionForRole(edge.from);
          const target = positionForRole(edge.to);
          return (
            <line
              key={`line-${index}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={edge.kind === "conflict" ? "rgba(251,191,36,0.42)" : edge.kind === "dependency" ? "rgba(34,211,238,0.34)" : "rgba(255,255,255,0.16)"}
              strokeWidth={edge.kind === "dependency" ? "0.42" : "0.3"}
            />
          );
        })}
      </svg>

      {nodes.map((agent, index) => {
        const position = positions[index];
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
