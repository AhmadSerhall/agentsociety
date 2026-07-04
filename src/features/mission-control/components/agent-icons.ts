import {
  Bot,
  BrainCircuit,
  Lightbulb,
  Megaphone,
  Network,
  PackageCheck,
  Scale,
  Search,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import { createElement, type ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";

export const agentIconMap: Record<string, LucideIcon> = {
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

export function getAgentIcon(agentId?: string): LucideIcon {
  return agentId ? agentIconMap[agentId] ?? Bot : Bot;
}

type AgentIconGlyphProps = ComponentProps<LucideIcon> & {
  agentId?: string;
};

export function AgentIconGlyph({ agentId, ...props }: AgentIconGlyphProps) {
  return createElement(getAgentIcon(agentId), props);
}
