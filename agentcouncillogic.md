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
2. The Mission Classification Engine identifies the mission type, complexity, selected strategy, and smallest useful team.
3. The engine decides whether planning is useful.
4. If planning is unnecessary, direct workstreams are created from classification.
5. If decomposition is useful, Planner creates or repairs a Mission Graph.
6. Workstreams are converted into executable tasks.
7. Tasks become ready when dependencies are satisfied.
8. Ready tasks can run in parallel only when parallelism is useful.
9. Assigned agents produce structured outputs.
10. Risk Critic only participates when useful work or real risk context exists.
11. Conflicts are created only from real conflict signals or material objections.
12. Mediator runs only when an actual conflict needs resolution.
13. Finalizer synthesizes completed work into a final report.
14. The report is validated and rendered for humans.
15. Mission history and replay events are saved locally.

## Mission Classification Engine

Classification happens before Planner.

It stores:

- Mission type
- Complexity score from 1-10
- Estimated workstreams
- Estimated duration
- Recommended agents
- Whether planning is required
- Whether research is required
- Whether conflict resolution is likely
- Whether parallelism is useful
- Selected strategy
- Reason planning was enabled or skipped
- Classification confidence

Planning is not mandatory. Simple translation, summarization, direct Q&A, conversation, or small writing tasks skip Planner and run through a minimal specialist path. Complex startup, ERP, architecture, business, and multi-step execution tasks use Planner and a Mission Graph.

General Mission is the default high-level execution style. `Direct Result` is the default output-format preference. When selected, the classifier leans toward concise direct execution for simple requests and the report composer keeps orchestration details out of the primary answer. Complex requests can still use Planner if decomposition is genuinely useful.

## Strict Agent Categories

Every runtime contribution is treated as one category:

- Worker: produces the actual artifact requested by the user.
- Reviewer: checks, corrects, and validates worker output without inventing a new deliverable.
- Coordinator: assigns, merges, or resolves. Planner, Mediator, and Finalizer are coordinators.

Workers must do the work itself. A translation worker outputs the translated paragraph. A programming worker outputs code. A writing worker outputs the requested writing. A research worker outputs the research answer.

For direct missions, Finalizer merges verified worker output and returns the artifact itself. It should not replace the artifact with meta-commentary like "mission complete" or "the translation has been completed." The usefulness gate rejects those meta-only outputs for direct execution.

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

- Planner: Creates the Mission Graph only when classification says decomposition will improve quality.
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

The Agent Roster always shows the real role icon inside each avatar. Active and completed states appear as pulse, glow, spinner, check, or completion overlays rather than replacing the role icon.

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

For low-complexity missions, the graph can be a direct classifier-generated path such as Translator to Reviewer or Answer Specialist to Finalizer. These direct paths intentionally avoid enterprise sections like budget, stakeholders, roadmap, or implementation phases unless the user asked for them.

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

Final delivery is assembled from the same mission context used by all tabs, but the visible format depends on `deliverableMode`.

The mission classifier sets one of three delivery modes:

- `direct_answer`: translation, summarization, simple explanation, simple Q&A, conversation, and lightweight education/math answers.
- `artifact`: code, debugging output, small writing, document generation, code review, or file analysis.
- `mission_report`: complex planning, architecture, business, startup, ERP, financial analysis, and broad multi-step execution.

For `direct_answer`, the worker/reviewer contract is:

```json
{
  "finalAnswer": "the exact answer the user should see",
  "reviewNote": "optional short reviewer note",
  "confidence": 90
}
```

The Finalizer must pass through the verified `finalAnswer`. It must not create consulting sections, orchestration summaries, new recommendations, risk summaries, workstream metadata, or report language.

For `mission_report`, the report is assembled from:

- Mission objective
- Configuration
- Workstreams
- Agent outputs
- Conflict decisions
- Mediator notes
- Timeline
- Efficiency metrics

The final user-facing output must match the requested deliverable. A translation returns translated text. A brief explanation returns the brief explanation. Code requests return code. Full consulting/report sections are reserved for complex missions where a report is actually the right deliverable.

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

Roadmap-like answers now pass through a structured content renderer before display. Plain text sections such as `What to do`, `Practical steps`, `Key context`, `Timing`, and `Watch-outs` are presented as readable headings, numbered steps, and bullet rows instead of a single dense paragraph.

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

Dialogue entries are not ellipsis-truncated in the completed mission Dialogue tab. Compact live dashboard surfaces can still summarize or clamp text, but the Dialogue tab is the full readable contribution record.

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

The report tab uses the report composer renderer, but its label and sections adapt to `deliverableMode`.

For `direct_answer`, the tab is presented as Answer and shows only:

- Answer
- Optional Reviewer Note

It does not show consulting/report sections.

For `mission_report`, it displays polished sections such as:

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
- Tracked token estimate
- Average latency
- Retry count
- Failure count
- Parallelism percentage
- Consensus percentage
- Agent utilization
- Single-agent baseline comparison

These metrics are calculated from `MissionContext`, replay records, workstream/task state, dependencies, dialogue length, conflicts, confidence scores, and participating agents. They are not shared hardcoded values. The single-agent comparison uses separate baselines for quality, coverage, confidence, and perspectives. Completion time uses actual mission runtime when available and falls back to a telemetry estimate only when runtime is missing.

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
  -> Qwen key resolved from saved browser key or local env key
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

## Running Mission Presentation

During mission execution, Mission Control presents agent communication through a Mission Operations Board instead of the old orbit graph/message overlay.

The board shows:

- Mission Engine routing state in its own card
- The active specialist with that agent's shared icon and color
- Agent state in a compact Agent Roster as Working, Finished, or Waiting
- A responsive agent progress strip with each role's icon, status, percentage, and thin progress bar
- The latest agent signal as a compact findings summary, not the full raw output
- Recent signal rows for prior updates with one-line summaries, timestamps, and inspect behavior
- A compact metrics strip for task completion, active agents, average response, tracked tokens, estimated cost, and success rate
- Mission Intelligence as a high-z-index overlay instead of a permanent right column
- Mission Intelligence shows the selected mission configuration, live/final mission metrics, and a short complete Current Decision summary
- Full Transcript for complete dialogue review

This keeps live communication readable while preserving the same underlying `MissionContext.dialogue`, `agentStates`, and `currentAgent` data.

Long agent text is clamped on the dashboard and remains available through Inspect or Full Transcript. Current Decision in Mission Intelligence should summarize complete context without ellipses. The running presentation uses compact cards with natural vertical page scrolling and small internal scroll areas only where useful. It avoids fixed viewport-height clipping so live context and agent messages remain readable.

## Qwen Key Gate

Mission execution requires a resolved Qwen API key before the engine starts.

The app resolves keys through `src/lib/qwenConfig.ts`:

1. Saved browser key from localStorage
2. Local developer env key from `VITE_QWEN_API_KEY`
3. No key

If no key exists, Mission Control blocks launch and routes the user to Settings. This keeps fresh open-source clones from running with a missing or bundled key.

The Settings page also exposes runtime diagnostics, connection testing, local storage telemetry, mission preferences, appearance controls, and developer toggles. These are presentation/control surfaces only and do not change the mission graph orchestration model.

Settings telemetry is deliberately local and conservative:

- Runtime cards show provider, model, base URL host, connection status, and the latest user-triggered connection check.
- Streaming and vision capability cards are not shown unless the app has verified model capability data.
- Today's Local Activity is derived from saved mission history and replay telemetry; it is not provider billing data.
- Clear Cache removes replay event payloads from saved history while preserving mission records and final reports.
- Export/Import Settings operate on UI preference JSON and do not alter agent reasoning, mission graphs, or final report composition.

The Settings page now persists operational preferences through `src/lib/settingsPreferences.ts`.

These preferences affect execution surfaces without changing planner reasoning:

- Auto Save Reports determines whether mission completion/cancellation writes to Mission History.
- Stream Responses switches the Qwen client between streamed and non-streamed response handling.
- Retry Failed Requests and Retry Count control Qwen request retries before surfacing failure/fallback behavior.
- Mission Timeout controls the per-request Qwen timeout.
- Remember Previous Context controls whether mission history is used for recommended prompts.
- Developer Mode and Verbose Logs feed the existing runtime debug pathway.
