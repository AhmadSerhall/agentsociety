/**
 * Agent Society — Agent Registry
 */

import { BaseAgent } from "./base-agent";
import { AGENT_DEFINITIONS } from "./definitions";
import type { AgentRole, AgentDefinition } from "@/types";

export class AgentRegistry {
  private agents = new Map<string, BaseAgent>();

  constructor() {
    for (const def of AGENT_DEFINITIONS) {
      this.agents.set(def.id, new BaseAgent(def));
    }
  }

  get(id: string): BaseAgent | undefined {
    return this.agents.get(id);
  }

  getByRole(role: AgentRole): BaseAgent | undefined {
    for (const agent of this.agents.values()) {
      if (agent.role === role) return agent;
    }
    return undefined;
  }

  getAll(): AgentDefinition[] {
    return Array.from(this.agents.values()).map((a) => a.toJSON());
  }

  get size() {
    return this.agents.size;
  }
}