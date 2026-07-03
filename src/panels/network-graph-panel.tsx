"use client";

import { useEffect, useMemo } from "react";
import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  getBezierPath,
  useEdgesState,
  useNodesState,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { BrainCircuit, Lightbulb, Megaphone, Network, PackageCheck, Scale, Search, ShieldAlert, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AGENT_DEFINITIONS } from "@/agents";
import { cn } from "@/lib/utils";
import { useMissionStore } from "@/store";
import { AgentRole, type AgentDefinition, type AgentThinkingState } from "@/types";

type AgentNodeData = {
  agent: AgentDefinition;
  state: AgentThinkingState;
  active: boolean;
  complete: boolean;
  conflicted: boolean;
  displayRole: string;
  workstreamCount: number;
  confidence: number;
};

type NetworkEdgeData = {
  tone: "dependency" | "dialogue" | "conflict" | "mediator";
};

const agentIconMap: Record<string, LucideIcon> = {
  "agent-planner": BrainCircuit,
  "agent-researcher": Search,
  "agent-product": Lightbulb,
  "agent-technical": Network,
  "agent-marketing": Megaphone,
  "agent-finance": WalletCards,
  "agent-risk": ShieldAlert,
  "agent-mediator": Scale,
  "agent-finalizer": PackageCheck,
};

const defaultPositions: Record<AgentRole, { x: number; y: number }> = {
  [AgentRole.Planner]: { x: 470, y: 40 },
  [AgentRole.Researcher]: { x: 760, y: 105 },
  [AgentRole.ProductStrategist]: { x: 930, y: 235 },
  [AgentRole.TechnicalArchitect]: { x: 470, y: 260 },
  [AgentRole.MarketingStrategist]: { x: 760, y: 415 },
  [AgentRole.Finance]: { x: 390, y: 430 },
  [AgentRole.RiskCritic]: { x: 120, y: 365 },
  [AgentRole.Mediator]: { x: 90, y: 220 },
  [AgentRole.Finalizer]: { x: 170, y: 75 },
};

const nodeTypes = { agent: AgentNode };
const edgeTypes = { packet: PacketEdge };

export function NetworkGraphPanel({ className }: { className?: string }) {
  const context = useMissionStore((s) => s.context);
  const currentAgent = context?.currentAgent ?? null;

  const completedRoles = useMemo(() => new Set(context?.dialogue.map((entry) => entry.agentRole) ?? []), [context?.dialogue]);
  const activeConflicts = useMemo(() => context?.conflicts.filter((conflict) => !conflict.resolved && conflict.status !== "resolved") ?? [], [context?.conflicts]);
  const conflictRoleHints = useMemo(() => {
    const text = activeConflicts.flatMap((conflict) => [...conflict.agents, ...(conflict.agentsInvolved ?? []), conflict.description, conflict.summary ?? ""]).join(" ").toLowerCase();
    return new Set(AGENT_DEFINITIONS.filter((agent) => text.includes(agent.name.toLowerCase()) || text.includes(agent.role.replace(/-/g, " "))).map((agent) => agent.role));
  }, [activeConflicts]);

  const graph = useMemo(() => buildGraph(context, completedRoles, conflictRoleHints, currentAgent), [completedRoles, conflictRoleHints, context, currentAgent]);
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  useEffect(() => {
    setNodes((current) => mergeNodes(current, graph.nodes));
    setEdges(graph.edges);
  }, [graph.edges, graph.nodes, setEdges, setNodes]);

  return (
    <div className={cn("relative h-[520px] overflow-hidden rounded-2xl border border-cyan-200/10 bg-[#07111f]", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_20%,rgba(34,211,238,0.13),transparent_34%),radial-gradient(circle_at_78%_78%,rgba(168,85,247,0.14),transparent_36%)]" />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.45}
        maxZoom={1.35}
        defaultEdgeOptions={{ type: "packet", animated: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        className="agent-network-flow"
      >
        <Background color="rgba(148,163,184,0.18)" gap={26} size={1.1} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => (node.data as AgentNodeData).agent.color}
          maskColor="rgba(2,6,23,0.62)"
          className="!bottom-4 !right-4 !rounded-xl !border !border-cyan-200/10 !bg-black/35"
        />
        <Controls className="!bottom-4 !left-4 !overflow-hidden !rounded-xl !border !border-cyan-200/10 !bg-black/35 !shadow-[0_18px_60px_rgba(0,0,0,0.35)]" />
      </ReactFlow>
    </div>
  );
}

function buildGraph(
  context: ReturnType<typeof useMissionStore.getState>["context"] | null,
  completedRoles: Set<AgentRole>,
  conflictRoleHints: Set<AgentRole>,
  currentAgent: AgentRole | null
): { nodes: Node<AgentNodeData>[]; edges: Edge<NetworkEdgeData>[] } {
  const roles = new Set<AgentRole>([
    AgentRole.Planner,
    AgentRole.Finalizer,
    ...(context?.workstreams.map((workstream) => workstream.assignedAgent).filter((role): role is AgentRole => Boolean(role)) ?? []),
    ...(context?.executionTasks.map((task) => task.agent) ?? []),
    ...(context?.dialogue.map((entry) => entry.agentRole) ?? []),
  ]);
  if (context?.conflicts.some((conflict) => !conflict.resolved && conflict.status !== "resolved") || context?.dialogue.some((entry) => entry.agentRole === AgentRole.Mediator)) {
    roles.add(AgentRole.Mediator);
  }

  const tasksByRole = new Map<AgentRole, number>();
  const confidenceByRole = new Map<AgentRole, number[]>();
  context?.workstreams.forEach((workstream) => {
    if (!workstream.assignedAgent) return;
    tasksByRole.set(workstream.assignedAgent, (tasksByRole.get(workstream.assignedAgent) ?? 0) + 1);
    confidenceByRole.set(workstream.assignedAgent, [...(confidenceByRole.get(workstream.assignedAgent) ?? []), workstream.confidence ?? 76]);
  });
  context?.executionTasks.forEach((task) => {
    if (!context.workstreams.length) tasksByRole.set(task.agent, (tasksByRole.get(task.agent) ?? 0) + 1);
    confidenceByRole.set(task.agent, [...(confidenceByRole.get(task.agent) ?? []), task.confidence]);
  });

  const nodes = AGENT_DEFINITIONS.filter((agent) => roles.has(agent.role)).map((agent) => {
    const confidenceValues = confidenceByRole.get(agent.role) ?? [];
    const state = context?.agentStates?.[agent.role] ?? "waiting";
    const active = currentAgent === agent.role || state === "thinking" || state === "analyzing" || state === "reviewing";
    const complete = completedRoles.has(agent.role) || state === "complete";
    const conflicted = conflictRoleHints.has(agent.role) || (agent.role === AgentRole.Mediator && Boolean(context?.conflicts.some((conflict) => !conflict.resolved && conflict.status !== "resolved")));
    return {
      id: agent.role,
      type: "agent",
      position: defaultPositions[agent.role],
      data: {
        agent,
        state,
        active,
        complete,
        conflicted,
        displayRole: latestDisplayRole(context, agent.role) ?? agent.name,
        workstreamCount: tasksByRole.get(agent.role) ?? 0,
        confidence: confidenceValues.length ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length) : 76,
      },
    };
  });

  const edges = dedupeEdges([
    ...dependencyEdges(context),
    ...dialogueEdges(context),
    ...conflictEdges(context, completedRoles),
    ...mediatorEdges(context),
  ]).filter((edge) => roles.has(edge.source as AgentRole) && roles.has(edge.target as AgentRole));

  return { nodes, edges };
}

function mergeNodes(current: Node<AgentNodeData>[], next: Node<AgentNodeData>[]) {
  const currentById = new Map(current.map((node) => [node.id, node]));
  return next.map((node) => {
    const existing = currentById.get(node.id);
    return existing ? { ...node, position: existing.position, selected: existing.selected, dragging: existing.dragging } : node;
  });
}

function dependencyEdges(context: ReturnType<typeof useMissionStore.getState>["context"] | null): Edge<NetworkEdgeData>[] {
  return context?.executionTasks.flatMap((task) =>
    task.dependencies.map((dependencyId) => {
      const source = context.executionTasks.find((candidate) => candidate.id === dependencyId);
      if (!source || source.agent === task.agent) return null;
      return makeEdge(source.agent, task.agent, "dependency", `dep-${source.id}-${task.id}`);
    }).filter((edge): edge is Edge<NetworkEdgeData> => Boolean(edge))
  ) ?? [];
}

function dialogueEdges(context: ReturnType<typeof useMissionStore.getState>["context"] | null): Edge<NetworkEdgeData>[] {
  return context?.dialogue.slice(1).map((entry, index) => makeEdge(context.dialogue[index].agentRole, entry.agentRole, "dialogue", `dialogue-${index}`)).filter((edge) => edge.source !== edge.target) ?? [];
}

function conflictEdges(context: ReturnType<typeof useMissionStore.getState>["context"] | null, completedRoles: Set<AgentRole>): Edge<NetworkEdgeData>[] {
  if (!context?.conflicts.length) return [];
  const active = context.conflicts.some((conflict) => !conflict.resolved && conflict.status !== "resolved");
  const involved = new Set<AgentRole>([AgentRole.RiskCritic, context.currentAgent, ...Array.from(completedRoles)].filter((role): role is AgentRole => Boolean(role)));
  return Array.from(involved).filter((role) => role !== AgentRole.Mediator).map((role) => makeEdge(role, AgentRole.Mediator, active ? "conflict" : "mediator", `conflict-${role}`));
}

function mediatorEdges(context: ReturnType<typeof useMissionStore.getState>["context"] | null): Edge<NetworkEdgeData>[] {
  if (!context?.conflicts.length) return [];
  return [
    makeEdge(AgentRole.Mediator, AgentRole.Planner, "mediator", "mediator-planner"),
    makeEdge(AgentRole.Mediator, AgentRole.Finalizer, "mediator", "mediator-finalizer"),
  ];
}

function makeEdge(source: AgentRole, target: AgentRole, tone: NetworkEdgeData["tone"], id: string): Edge<NetworkEdgeData> {
  const colors = {
    dependency: "#22d3ee",
    dialogue: "#94a3b8",
    conflict: "#f59e0b",
    mediator: "#a78bfa",
  };
  return {
    id,
    source,
    target,
    type: "packet",
    animated: true,
    data: { tone },
    markerEnd: { type: MarkerType.ArrowClosed, color: colors[tone], width: 16, height: 16 },
    style: {
      stroke: colors[tone],
      strokeWidth: tone === "conflict" ? 2.8 : tone === "mediator" ? 2.4 : 1.7,
      filter: tone === "conflict" ? "drop-shadow(0 0 8px rgba(245,158,11,0.8))" : tone === "mediator" ? "drop-shadow(0 0 7px rgba(167,139,250,0.72))" : "drop-shadow(0 0 5px rgba(34,211,238,0.35))",
      opacity: tone === "dialogue" ? 0.42 : 0.88,
    },
  };
}

function dedupeEdges(edges: Edge<NetworkEdgeData>[]) {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = `${edge.source}-${edge.target}-${edge.data?.tone}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function latestDisplayRole(context: ReturnType<typeof useMissionStore.getState>["context"] | null, role: AgentRole) {
  return [...(context?.dialogue ?? [])].reverse().find((entry) => entry.agentRole === role)?.displayRole;
}

function AgentNode({ data }: NodeProps<Node<AgentNodeData>>) {
  const Icon = agentIconMap[data.agent.id] ?? BrainCircuit;
  const activityLabel = data.active ? "Active" : data.complete ? "Complete" : data.state === "waiting" ? "Waiting" : data.state;
  const ringColor = data.agent.color;
  const statusGlow = data.conflicted ? "0 0 36px rgba(245,158,11,0.30)" : data.active ? `0 0 40px ${ringColor}66` : data.complete ? `0 0 30px ${ringColor}42` : `0 22px 70px rgba(0,0,0,0.38), 0 0 18px ${ringColor}22`;

  return (
    <div
      className={cn(
        "group relative min-w-[230px] rounded-2xl border bg-slate-950/86 px-4 py-3 text-white backdrop-blur-xl transition-all duration-300",
        data.active && "scale-[1.03]",
      )}
      style={{ borderColor: data.conflicted ? "#f59e0bcc" : `${ringColor}99`, boxShadow: statusGlow }}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-cyan-100/70 !bg-slate-950" />
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-cyan-100/70 !bg-slate-950" />
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: `linear-gradient(135deg, ${data.agent.color}22, transparent 62%)` }} />
      <div className="relative flex items-center gap-3">
        <div
          className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl border", (data.active || data.conflicted) && "animate-pulse")}
          style={{ borderColor: `${ringColor}aa`, backgroundColor: `${ringColor}24`, boxShadow: `0 0 24px ${ringColor}44` }}
        >
          <Icon className="h-5 w-5" style={{ color: ringColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-white">{data.displayRole}</p>
            <span className={cn("rounded-full border px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.14em]", data.active ? "border-cyan-200/40 bg-cyan-300/10 text-cyan-100" : data.conflicted ? "border-amber-200/45 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/[0.04] text-white/48")}>
              {activityLabel}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-white/42">{data.agent.capabilities.slice(0, 2).join(" + ")}</p>
        </div>
      </div>
      <div className="relative mt-3 grid grid-cols-2 gap-2 text-[0.68rem] text-white/54">
        <span className="rounded-xl border border-white/10 bg-black/20 px-2 py-1">{data.workstreamCount} workstreams</span>
        <span className="rounded-xl border border-white/10 bg-black/20 px-2 py-1">{data.confidence}% confidence</span>
      </div>
    </div>
  );
}

function PacketEdge(props: EdgeProps<Edge<NetworkEdgeData>>) {
  const [path] = getBezierPath(props);
  const tone = props.data?.tone ?? "dependency";
  const packetColor = tone === "conflict" ? "#fbbf24" : tone === "mediator" ? "#c4b5fd" : tone === "dialogue" ? "#94a3b8" : "#67e8f9";

  return (
    <>
      <BaseEdge path={path} markerEnd={props.markerEnd} style={props.style} />
      <circle r={tone === "conflict" ? 4 : 3} fill={packetColor} opacity={tone === "dialogue" ? 0.46 : 0.92}>
        <animateMotion dur={tone === "conflict" ? "1.6s" : "2.4s"} repeatCount="indefinite" path={path} />
      </circle>
    </>
  );
}
