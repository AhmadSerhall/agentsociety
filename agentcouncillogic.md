# Agent Council Logic

This document explains how Agent Society runs a mission, how agents communicate, how the final result is delivered, and what each completed-mission tab displays in the current implementation.

## Core Idea

Agent Society is a Mission Graph system with a human-facing presentation layer.

The engine keeps structured mission state in `MissionContext`. The UI does not show that state directly. Every visible agent message, replay event, conflict, workstream, and report section is passed through presentation renderers so users see readable summaries, bullets, cards, and polished report sections instead of JSON, object literals, parser artifacts, or internal payloads.

## Mission Lifecycle

When a user launches a mission, the app creates a shared `MissionContext`.

The context stores:

- Mission brief and configuration
- Semantic mission analysis
- Workstreams
- Execution tasks
- Dialogue entries
- Conflicts
- Timeline entries
- Replay events
- Efficiency metrics
- Final report
- Agent state

The mission flow is:

1. User enters a mission brief and configuration.
2. The mission engine creates semantic mission context from the objective.
3. The Planner creates or repairs a Mission Graph.
4. Workstreams are converted into executable tasks.
5. Tasks become ready when dependencies are satisfied.
6. Ready tasks can run in parallel.
7. Assigned agents produce structured outputs.
8. Risk Critic only participates when useful work or real risk context exists.
9. Conflicts are created only from real conflict signals or material objections.
10. Mediator runs only when an actual conflict needs resolution.
11. Finalizer synthesizes completed work into a final report.
12. The report is validated and rendered for humans.
13. Mission history and replay events are saved locally.

## Domain Understanding

Mission Type is treated as a high-level execution preference, not a domain template.

The mission engine no longer relies on hardcoded domain tables such as hardware, software, travel, legal, restaurant, or similar fixed mission categories.

Instead, semantic context is derived from:

- The user's objective text
- Extracted objective terms
- Existing agent definitions
- Existing agent capabilities
- The actual Planner graph when available

The Planner should still be the source of the meaningful mission graph. Local semantic recovery exists only to keep the UI coherent if model output is missing or malformed.

## Agent Roles

The main agents are:

- Planner: Creates the Mission Graph, assigns workstreams, and revises the graph if needed.
- Research Agent: Gathers context, evidence, constraints, and baseline findings.
- Product Strategist: Handles product, scope, user outcome, or offer design when useful.
- Technical Architect: Handles technical, structural, implementation, compatibility, or system planning when useful.
- Marketing Strategist: Handles audience, positioning, launch, and channel work when useful.
- Finance Agent: Handles budget, resource, cost, and financial constraints when useful.
- Risk Critic: Challenges weak assumptions and flags risks when useful.
- Mediator: Resolves real conflicts only.
- Finalizer: Synthesizes the completed mission into the final user-facing deliverable.

Planner and Finalizer are expected in completed missions. Other agents participate because they were assigned meaningful work, not because every mission needs every role.

## Agent Visual Identity

Agent icons and colors are treated as part of the agent identity.

The shared visual map lives at:

`src/features/mission-control/components/agent-icons.ts`

The Agents page, Agent Roster, Dialogue tab, and Network tab all read from that shared map. This keeps Planner, Research Agent, Product Strategist, Technical Architect, Marketing Strategist, Finance Agent, Risk Critic, Mediator, and Finalizer visually consistent across the app.

The Agent Roster always shows the real role icon inside each avatar. Active and completed states appear as pulse, glow, spinner, sparkle, or completion overlays rather than replacing the role icon.

## How Agents Communicate

Agents communicate through shared mission state, not hidden private messages.

The main communication channels are:

- Workstreams: Planned units of work with owners, descriptions, deliverables, dependencies, acceptance criteria, and outputs.
- Execution tasks: Runtime versions of workstreams with status, confidence, timing, and output.
- Dialogue entries: Agent contributions recorded with role, timestamp, confidence, and rendered content.
- Timeline entries: Natural event narration for what changed and what happened next.
- Conflicts: Structured disputes with participants, summary, arguments, decision, and status.
- Replay events: Recorded execution events used to reconstruct the mission frame by frame.

Dependent agents consume upstream context through `MissionContext`. For example, a later task can depend on research output, and the Finalizer synthesizes completed workstreams instead of inventing a separate answer from scratch.

Finalizer workstream execution is kept separate from visible Finalizer narration. The Dialogue tab shows the final synthesis contribution once, so the user sees one clear closing message instead of multiple near-identical Finalizer cards.

## Mission Graph

The Mission Graph contains:

- Task nodes
- Assigned agents
- Supporting agents
- Dependencies
- Parallel groups
- Conflict zones
- Synchronization points
- Synthesis readiness criteria
- Finalization readiness state
- Outputs and statuses

The graph controls execution order:

- Tasks with no dependencies can start immediately.
- Tasks with dependencies wait for upstream work.
- Parallel-ready tasks can run together.
- Blocked tasks wait for conflict resolution or Planner revision.
- Final synthesis waits for required tasks and conflict readiness.

## Workstream Execution

Each workstream becomes an `ExecutionTask`.

Execution tasks include:

- `id`
- `workstreamId`
- `title`
- `description`
- `agent`
- `supportingAgents`
- `acceptanceCriteria`
- `expectedOutputs`
- `dependencies`
- `status`
- `confidence`
- `output`
- `startedAt`
- `completedAt`

Task statuses are:

- `pending`
- `ready`
- `running`
- `blocked`
- `completed`
- `revised`
- `cancelled`

## Conflict Handling

Conflicts are not fabricated.

Conflicts can appear when:

- An agent output contains explicit conflict signals.
- Risk Critic flags a material objection.
- A task is genuinely blocked by an incompatible assumption.
- A mediator decision is required to continue.

When a conflict exists:

1. A conflict object is created.
2. Affected tasks can be blocked.
3. Mediator runs if arbitration is needed.
4. Mediator records a decision and resolved action.
5. Planner can revise assignments or dependencies.
6. Work resumes if the conflict is resolved.

If no real disagreement exists, the UI should say that no conflicts were generated or omit conflict-only sections where appropriate.

## Final Report Delivery

The final report is assembled from the same mission context used by all tabs.

The report is built from:

- Mission objective
- Configuration
- Workstreams
- Agent outputs
- Conflict decisions
- Mediator notes
- Timeline
- Efficiency metrics

The final report should answer the user's objective directly. Orchestration details remain supporting context, not the main deliverable.

Before display, the presentation layer removes or avoids:

- Raw JSON
- Object literals
- Arrays
- `null`
- `undefined`
- Parser artifacts
- Developer notes
- Internal payloads
- Repeated agent summaries
- Empty risk/resource sections

## Presentation Renderer Layer

The current UI uses a dedicated presentation renderer at:

`src/features/mission-control/components/council/presentation-renderer.ts`

It converts structured mission data into:

- Human-readable agent summaries
- Bullet lists
- Workstream cards
- Conflict cards
- Timeline narration
- Replay event summaries
- Final report sections

The older agent output formatter now delegates to this renderer. Normal user-facing UI should never show raw model payloads.

## Completed Mission Tabs

### Workflow

The Workflow tab shows graph execution structure.

It displays:

- Task node count
- Parallel wave count
- Conflict count
- Synthesis readiness
- Collaboration waves
- Task cards

The old gray helper descriptions in wave headers have been removed. Task cards still show useful information like title, primary agent, status, supporting agents, confidence, dependencies, and revision notes.

### Workstreams

The Workstreams tab shows the concrete units of work.

It displays:

- Concise title
- Subtitle/description
- Owner
- Status
- Confidence
- Dependency count
- Supporting agents
- Deliverables, acceptance criteria, or expected outputs

### Dialogue

The Dialogue tab shows agent contributions.

It now displays:

- Agent-specific icon from the agent definition
- Agent color
- Agent name
- Relative timestamp
- Message type only when it adds meaning
- Conflict badge only for actual conflict entries
- Human summary
- Bullets
- Workstream cards when Planner output is parsed

Duplicate identical entries are hidden at presentation time, so repeated Finalizer or Mediator messages do not clutter the tab.

If saved or replayed mission data contains more than one Finalizer message, the Dialogue tab keeps the latest Finalizer synthesis and hides earlier Finalizer duplicates.

### Conflicts

The Conflicts tab renders disputes as human-readable conflict cards.

It displays:

- Dispute title
- Risk/severity
- Participants
- Summary
- Arguments or proposed options when available
- Mediator decision or resolved action
- Resolution state

If no useful conflict exists, it does not invent one.

### Final Report

The Final Report tab uses the report composer renderer.

It displays polished sections such as:

- Consulting Summary
- Objective
- Expert Contributions
- Workstreams
- Decision Notes
- Action Plan
- Risk Summary
- Resources
- Success Measures
- Final Recommendations

Sections are omitted when they are empty or only contain no-op content. For example, Risk Summary and Resources are hidden when the mission did not produce meaningful risk or resource content.

Repeated contribution lines are deduped. The Consulting Summary is no longer truncated to a short preview.

### Timeline

The Timeline tab shows natural mission narration.

Each entry explains:

- What changed
- Which agent or system area was involved
- Why it mattered
- What happened next

### Efficiency

The Efficiency tab shows execution analytics.

It can display:

- Task coverage
- Quality score
- Conflicts resolved
- Execution duration
- Tokens consumed
- Average latency
- Retry count
- Failure count
- Parallelism percentage
- Consensus percentage
- Agent utilization
- Single-agent baseline comparison

### Network

The Network tab shows the agent graph visually.

It includes:

- Movable agent nodes
- Agent-specific colors and icons
- Animated edges
- Dependency flow
- Dialogue flow
- Conflict edges
- Mediator edges
- Active agent pulse
- Completed state
- Workstream count

Mediator appears or glows only when an active conflict exists or the mediator actually participated.

## Replay

Replay is driven by saved replay events.

Replay does not call Qwen and does not regenerate the mission.

The floating replay tool supports:

- Play/pause
- Step forward/back
- Restart
- Exit replay
- Speed control
- Follow/adaptive toggles
- Click-to-seek event markers
- Readable event inspector

The event inspector no longer displays raw replay JSON. It shows a readable event title, summary, and details.

## History Reopen

When a mission is reopened from history, the app reconstructs state from replay events when available.

It restores:

- Elapsed duration
- Workstreams
- Workflow
- Dialogue
- Timeline
- Agent colors/icons
- Conflicts
- Final report
- Efficiency metrics
- Replay state

If replay events are unavailable, the app falls back to saved history fields.

## Data Flow Summary

```text
User brief
  -> Mission configuration
  -> Semantic mission context
  -> Planner graph
  -> Workstreams
  -> Execution tasks
  -> Agent outputs
  -> Dialogue and timeline
  -> Real conflicts if generated
  -> Mediation if needed
  -> Finalizer synthesis
  -> Report validation
  -> Presentation renderer
  -> Completed tabs and history
```

## Mental Model

Agent Society is a mission council with a shared whiteboard.

- Planner draws the map.
- Specialists work only where useful.
- Risk Critic challenges weak assumptions when needed.
- Mediator resolves real disagreements.
- Finalizer synthesizes the council's validated work.
- Presentation renderers translate the structured record into a polished human experience.

The tabs are different human-friendly views of the same `MissionContext`, not independent placeholder generators.
