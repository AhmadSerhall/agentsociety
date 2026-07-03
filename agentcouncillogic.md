# Agent Council Logic

This document explains how Agent Society runs a mission, how agents communicate with each other, how the final result is produced, and what each completed-mission tab displays.

## Mission Lifecycle

When a user launches a mission, the app creates a `MissionContext`. This context is the shared mission memory. It stores the brief, configuration, workstreams, execution tasks, dialogue, conflicts, timeline, final report, analytics, replay events, and current agent states.

The mission usually follows this order:

1. Mission is created from the user brief and selected configuration.
2. Mission is classified so the system understands the domain and likely required agents.
3. Planner starts and creates the Mission Graph.
4. Planner creates workstreams and assigns each workstream to a primary agent.
5. Ready tasks run when their dependencies are satisfied.
6. Specialist agents produce outputs for their assigned workstreams.
7. Risk Critic may challenge weak assumptions and create conflicts.
8. Mediator resolves conflicts when needed.
9. Planner may revise task ownership or dependencies after mediation.
10. Finalizer waits for synchronization readiness.
11. Finalizer synthesizes all work into the final report.
12. Mission is marked completed and saved to history.

The mission is not just a linear chat. It is a graph execution system: workstreams can run in parallel when they do not depend on each other, and downstream tasks wait for upstream evidence.

## Agent Roles

The main agents are:

- Planner: Builds the Mission Graph, decomposes the mission into workstreams, assigns agents, and revises the graph if conflicts require changes.
- Research Agent: Gathers context, evidence, assumptions, and baseline findings.
- Product Strategist: Defines options, scope, positioning, product or plan structure when relevant.
- Technical Architect: Designs technical, structural, process, or implementation architecture.
- Marketing Strategist: Handles audience, positioning, launch, communication, or go-to-market work when relevant.
- Finance Agent: Estimates budget, resources, effort, and constraints when relevant.
- Risk Critic: Challenges assumptions, identifies gaps, flags risks, and can block weak workstreams.
- Mediator: Resolves conflicts between agents or workstreams.
- Finalizer: Synthesizes completed workstreams, mediator decisions, risk notes, and metrics into the final report.

Planner and Finalizer are part of every completed mission. Other agents participate when the Planner assigns them work or when they are needed for conflict handling.

## How Agents Communicate

Agents communicate through the shared `MissionContext`, not through free-form hidden messages.

Communication happens through several structured channels:

- Workstreams: Planner creates workstreams and assigns responsible agents.
- Execution tasks: Each workstream becomes a task with dependencies, status, confidence, output, and timing.
- Dialogue entries: Each agent output is recorded as a visible message with agent name, role, content, timestamp, confidence, and conflict flags.
- Timeline entries: Major events are recorded as system, agent, workstream, conflict, or report events.
- Conflicts: Risk or disagreement events are stored as structured conflict objects.
- Replay events: Every important mission event is recorded for replay and history reconstruction.

An agent does not need to directly message another agent for the system to coordinate. The output of one task becomes shared context for dependent tasks. For example, a Product Strategist task can wait for Research Agent evidence, and a Risk Critic task can inspect earlier workstreams before raising a conflict.

## Mission Graph

The Mission Graph is created by the Planner. It contains:

- Task nodes
- Assigned agents
- Supporting agents
- Dependencies
- Parallel groups
- Conflict zones
- Synchronization points
- Synthesis readiness criteria
- Finalization readiness status

This graph controls which tasks can run immediately and which tasks must wait.

Example:

- A diagnostic/research task may have no dependencies.
- A strategy or design task may depend on the diagnostic task.
- A risk review task may depend on several prior tasks.
- A final synthesis task waits until required workstreams and conflicts are complete.

## Workstream Execution

Each workstream is converted into an `ExecutionTask`.

Tasks include:

- `id`
- `workstreamId`
- `title`
- `description`
- `agent`
- `supportingAgents`
- `dependencies`
- `status`
- `confidence`
- `output`
- `startedAt`
- `completedAt`

Task statuses can be:

- `pending`
- `ready`
- `running`
- `blocked`
- `completed`
- `revised`
- `cancelled`

The engine repeatedly checks which pending tasks are ready. A task becomes ready when all dependencies are completed. Ready tasks can run in parallel.

## Conflict Handling

Conflicts can come from:

- Weak assumptions
- Unresolved dependencies
- Low confidence
- Contradictory agent conclusions
- Risk Critic challenges
- Budget, timeline, or feasibility mismatches

When a conflict is detected:

1. A conflict object is created.
2. Affected tasks may be blocked.
3. Mediator starts.
4. Mediator reviews the conflict and chooses a resolution.
5. Planner may revise assignments, dependencies, or task status.
6. Blocked work can continue if the conflict is resolved.

The Mediator does not replace agent work. It resolves disagreements so the graph can continue.

## Synchronization And Finalization

Before the final report is generated, the system checks synthesis readiness:

- Required tasks completed
- Critical conflicts resolved
- Confidence threshold met
- Workstreams available for synthesis

If not ready, Finalizer waits and the mission records a synchronization point. If ready, Finalizer starts and produces the final synthesis.

The final report is generated from:

- Mission brief
- Mission configuration
- Workstreams
- Agent outputs
- Dialogue entries
- Conflict decisions
- Mediator notes
- Timeline
- Efficiency metrics

## Final Result Delivery

When the mission completes:

1. The final report is stored in `context.finalReport`.
2. Efficiency metrics are stored in `context.efficiencyMetrics`.
3. All replay events are preserved.
4. The mission is saved to Mission History.
5. The completed mission UI shows:
   - Mission summary
   - Involved agent count
   - Elapsed time
   - Progress
   - Agent roster
   - Mission intelligence
   - Tabs for detailed results

The final result is not only the Final Report tab. The completed mission contains a full audit trail across Workflow, Workstreams, Dialogue, Conflicts, Timeline, Efficiency, and Network.

## Completed Mission Tabs

### Workflow

The Workflow tab shows the Mission Graph execution structure.

It displays:

- Number of task nodes
- Number of parallel waves
- Number of conflicts
- Synthesis readiness status
- Collaboration waves
- Task cards inside each wave

Each task card shows:

- Task title
- Primary agent
- Status
- Supporting agents
- Description
- Confidence
- Dependencies
- Revision notes when applicable

This tab answers: “How was the mission broken down and executed?”

### Workstreams

The Workstreams tab shows the actual workstreams created by the Planner.

It displays:

- Workstream title
- Assigned agent or owner
- Status
- Confidence
- Dependencies
- Deliverables
- Output or next step

This tab answers: “What concrete pieces of work did the agents produce?”

### Dialogue

The Dialogue tab shows agent communication outputs.

Each dialogue entry includes:

- Agent avatar and color
- Agent name
- Timestamp
- Message type
- Conflict marker if applicable
- Summary
- Bullets
- Workstream details when parsed from structured output

Agent colors come from the agent role:

- Planner is purple
- Research Agent is blue
- Product Strategist is amber
- Technical Architect is green
- Marketing Strategist is pink
- Finance Agent is teal
- Risk Critic is red
- Mediator is cyan
- Finalizer is purple

This tab answers: “What did each agent say or contribute?”

### Conflicts

The Conflicts tab shows disagreements, blockers, and risk interruptions.

It displays:

- Conflict description
- Agents involved
- Affected tasks
- Risk or severity
- Proposed resolution
- Mediator decision
- Resolved status

If there are no conflicts, it shows that no active conflict remained.

This tab answers: “What went wrong, what was challenged, and how was it resolved?”

### Final Report

The Final Report tab shows the synthesized user-facing result.

The report can include:

- Executive summary
- Mission objective
- Selected configuration
- Workstreams
- Role assignments
- Agent contributions
- Key disagreements
- Mediator decisions
- Execution roadmap
- Timeline
- Budget estimate
- Risk assessment
- Success metrics
- Final recommendations
- Single-agent comparison

This is the main deliverable for the user. It is produced by the Finalizer after all required workstreams and conflict decisions are ready.

This tab answers: “What is the final answer or plan?”

### Timeline

The Timeline tab shows the mission event history.

Timeline entries can include:

- Mission started
- Planner activated
- Mission Graph created
- Workstreams created
- Tasks became ready
- Agents started
- Agents finished
- Risk critic interruptions
- Conflicts created
- Mediation started
- Conflicts resolved
- Planner revised the graph
- Synchronization points
- Report generated
- Mission completed

Each entry can show:

- Agent
- Mission state
- Label
- Description
- Timestamp
- Duration
- Event kind

This tab answers: “What happened, and in what order?”

### Efficiency

The Efficiency tab shows execution analytics.

It can display:

- Task coverage
- Quality score
- Conflicts resolved
- Estimated completion time
- Perspectives considered
- Revision count
- Final confidence score
- Execution duration
- Tokens consumed
- Average latency
- Retry count
- Failure count
- Parallelism percentage
- Consensus percentage
- Agent utilization
- Single-agent baseline comparison

This tab answers: “How efficient and reliable was the multi-agent mission?”

### Network

The Network tab shows the agent network visually.

It displays agents as movable nodes and relationships as animated edges.

The network can represent:

- Dependency connections
- Dialogue flow
- Conflict edges
- Mediator edges
- Active agent state
- Completed agent state
- Workstream count per agent
- Agent-specific colors

In replay or live execution, the network reflects mission state over time. Active agents glow or pulse, completed agents are marked, and conflict/mediator relationships are highlighted.

This tab answers: “How did the agents connect and coordinate?”

## Replay Events

Replay events are recorded throughout mission execution. They make replay and history reconstruction possible.

Important replay event types include:

- `MISSION_CREATED`
- `MISSION_CLASSIFIED`
- `MISSION_STARTED`
- `MISSION_GRAPH_CREATED`
- `WORKSTREAM_CREATED`
- `WORKSTREAM_ASSIGNED`
- `TASK_READY`
- `TASK_STARTED`
- `AGENT_STARTED`
- `AGENT_THINKING`
- `AGENT_ANALYZING`
- `AGENT_REVIEWING`
- `AGENT_FINISHED`
- `DIALOGUE_CREATED`
- `CONFLICT_CREATED`
- `CONFLICT_RESOLVED`
- `MEDIATION_STARTED`
- `PLANNER_REVISED_PLAN`
- `SYNCHRONIZATION_POINT_REACHED`
- `FINALIZER_STARTED`
- `REPORT_GENERATED`
- `MISSION_COMPLETED`

Replay uses these events to rebuild the mission frame by frame. At replay time zero, counts start at zero. As events are reached, active agents, workstreams, dialogue, timeline, and final output update.

## History Reopen Behavior

When a completed mission is reopened from history, the system reconstructs the mission from saved replay events when available.

This restores:

- Real elapsed time
- Workstream cards
- Workflow graph
- Dialogue colors
- Timeline entries
- Agent completion states
- Final report
- Efficiency metrics

If replay events are not available, the app falls back to saved workstreams, dialogue, timeline, and efficiency metrics.

## Data Flow Summary

The mission result is built through this flow:

```text
User brief
  -> Mission configuration
  -> Mission classification
  -> Planner creates Mission Graph
  -> Workstreams become execution tasks
  -> Agents run ready tasks
  -> Dialogue and timeline are recorded
  -> Risk Critic may create conflicts
  -> Mediator resolves conflicts
  -> Planner revises graph if needed
  -> Finalizer checks synchronization readiness
  -> Finalizer creates final report
  -> Efficiency metrics are computed
  -> Mission is saved with replay events
  -> Completed tabs display the full mission record
```

## Mental Model

Think of Agent Society as a mission council with a shared whiteboard.

- Planner draws the map.
- Specialists fill in their assigned sections.
- Risk Critic challenges weak parts.
- Mediator resolves disagreements.
- Finalizer turns the whole council record into one coherent result.

The tabs are different views of the same shared mission record:

- Workflow: graph structure
- Workstreams: assigned units of work
- Dialogue: agent messages
- Conflicts: disagreements and resolutions
- Final Report: synthesized answer
- Timeline: chronological audit trail
- Efficiency: analytics
- Network: visual agent coordination
