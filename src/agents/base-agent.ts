/**
 * Agent Society — Base Agent
 */

import type { AgentDefinition } from "@/types";
import { AgentStatus } from "@/types";

export class BaseAgent {
  public definition: AgentDefinition;

  constructor(definition: AgentDefinition) {
    this.definition = definition;
  }

  get id() { return this.definition.id; }
  get name() { return this.definition.name; }
  get role() { return this.definition.role; }
  get status() { return this.definition.status; }

  setStatus(s: AgentStatus) {
    this.definition = { ...this.definition, status: s };
  }

  toJSON(): AgentDefinition {
    return { ...this.definition };
  }
}