# Agent Society - Current Project Summary

## Short Brief

Agent Society is a futuristic AI Mission Control application built with Next.js, React, TypeScript, Tailwind CSS, Zustand, Framer Motion, shadcn/Radix UI, Lucide icons, and a frontend Mission Engine.

The product lets a user enter a complex mission brief, configure execution style, launch a multi-agent collaboration, watch the mission run, inspect the graph, replay execution, and receive a polished final deliverable.

The project is now a Mission Graph driven agent society with a dedicated presentation layer.

## Current App Type

The current workspace is a frontend-first Next.js application.

Important:

- There is no active backend/database in this workspace.
- Missions run through the frontend Mission Engine.
- The app supports mock mode and Qwen mode.
- Qwen is not called during replay.
- Runtime settings and mission history are stored locally in the browser.
- Presentation renderers prevent raw internal payloads from appearing in normal UI.

## Main Technologies

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion
- Zustand
- shadcn/Radix UI components
- Lucide icons
- Qwen-compatible client integration
- Local replay/event reconstruction engine

## Main Product Areas

### Mission Control

Mission Control is the main user experience.

It includes:

- Dark futuristic mission-control UI
- Sticky desktop sidebar
- Mobile navigation drawer
- Mission brief composer
- Mission configuration controls
- Compact mission header during execution
- Agent Council Room
- Completed mission summary
- Detailed inspection tabs
- Floating replay overlay

### Mission Brief Composer

Before launch, the user can:

- Enter a mission brief
- Adjust mission configuration
- Launch the mission
- Use recommended mission prompts

When the user types in the mission brief, the Mission Config button can draw attention so the user remembers to configure parameters.

Configuration includes options such as mission type, depth, time horizon, budget range, risk tolerance, and output format. Time horizon and risk tolerance support a "None specified" style state.

## Agent Society Model

The system uses these agent identities:

- Planner
- Research Agent
- Product Strategist
- Technical Architect
- Marketing Strategist
- Finance Agent
- Risk Critic
- Mediator
- Finalizer

### Agent Participation

Planner and Finalizer are expected in completed missions.

Other agents participate because the mission graph assigns them meaningful work. The system should not force Product, Marketing, Finance, Risk, or Mediator into every mission.

Mediator participates only when a real conflict needs mediation.

## Mission Engine

The Mission Engine owns orchestration.

It manages:

- Mission context
- Agent state
- Workstreams
- Execution tasks
- Dependencies
- Parallel task groups
- Dialogue entries
- Conflicts
- Replay events
- Timeline entries
- Final report
- Efficiency metrics

## Semantic Mission Context

Mission Type is an execution preference, not a domain category.

The mission engine no longer relies on hardcoded domain catalogs for mission understanding. Semantic context is derived from:

- The user's objective text
- Extracted objective terms
- Agent definitions
- Agent capabilities
- Planner graph output

This keeps the system domain-agnostic and avoids adding new mission-type templates for every possible user request.

## Mission Graph

The Mission Graph is the core execution model.

It contains:

- Mission id
- Workstreams
- Agents
- Task nodes
- Dependencies
- Assignments
- Statuses
- Outputs
- Conflicts
- Synchronization points
- Finalization readiness
- Parallel groups
- Conflict zones
- Synthesis readiness criteria

Each task can include:

- Title
- Description
- Primary agent
- Supporting agents
- Dependencies
- Status
- Confidence
- Output
- Acceptance criteria
- Expected outputs
- Started/completed timestamps

Supported task statuses:

- pending
- ready
- running
- blocked
- completed
- revised
- cancelled

## Planner Output Handling

The Planner is expected to return structured JSON.

The system can:

- Parse normal JSON.
- Extract JSON from markdown/code fences.
- Extract the first valid JSON object when possible.
- Repair planner output when possible.
- Rebuild workstreams from semantic mission context if parsing fails.

The recovery path is not a domain-template catalog. It uses the same semantic context and agent capability matching to keep the UI coherent.

## Agent Council Room

The Council Room is the main running/completed mission surface.

It includes:

- Agent roster
- Circular council area
- Mission Engine center node
- Active speaking agents with glow/pulse
- Latest speech bubbles
- Full Transcript drawer
- Mission Intelligence panel
- Workstream Strip
- Workstream Inspector drawer
- Completed mission summary

The experience is designed to feel like watching a small AI council collaborate, not reading raw logs.

Agent visual identity is centralized in `src/features/mission-control/components/agent-icons.ts`, so the Agents page, Agent Roster, Dialogue tab, and Network graph use the same Lucide icon and agent color for each role. Runtime state is shown as secondary badges, overlays, glow, or pulse rather than replacing the agent's identity icon.

## Humanize Agent Society Presentation Layer

The UI now has a dedicated presentation renderer:

`src/features/mission-control/components/council/presentation-renderer.ts`

This renderer converts structured mission data into:

- Human-readable agent summaries
- Bullet lists
- Workstream cards
- Conflict cards
- Timeline narration
- Replay event summaries
- Final report sections

Normal UI should not display:

- Raw JSON
- Object literals
- Arrays
- `null`
- `undefined`
- Parser output
- Internal payloads
- Developer notes
- Raw replay metadata

The older agent output formatter delegates to the presentation renderer.

## Dialogue Presentation

The Dialogue tab now:

- Uses each agent's real icon, matching the Agents/Network page
- Uses agent-specific colors
- Shows message type only when useful
- Shows conflict badges only for actual conflict entries
- Dedupes identical repeated messages
- Shows only one Finalizer synthesis contribution, using the latest final synthesis when older missions contain duplicate Finalizer entries
- Renders structured payloads into summaries, bullets, and cards

This prevents repeated Finalizer/Mediator messages and avoids misleading conflict labels.

## Final Report Presentation

The Final Report tab uses a report composer style renderer.

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

The renderer:

- Avoids short preview truncation for the Consulting Summary
- Dedupes repeated specialist contribution lines
- Hides empty/no-op sections
- Hides Risk Summary when no meaningful risk content exists
- Hides Resources when no meaningful resource content exists
- Keeps orchestration details secondary to the user-facing answer

## Workflow Tab

The Workflow tab shows graph execution structure.

It displays:

- Task nodes
- Parallel waves
- Conflict count
- Synthesis readiness
- Task cards inside each wave

The gray helper text in workflow wave headers has been removed. Task cards still show useful task details.

## Workstreams Tab

The Workstreams tab shows concise workstream cards.

Each card can show:

- Title
- Subtitle/description
- Owner
- Status
- Confidence
- Dependencies
- Supporting agents
- Deliverables
- Acceptance criteria
- Expected outputs

## Conflicts Tab

The Conflicts tab renders human-friendly dispute cards.

It can show:

- Dispute title
- Risk/severity
- Participants
- Summary
- Arguments/options
- Mediator decision
- Resolved action
- Status

Conflicts are not fabricated. If no conflict exists, the app should not pretend one exists.

## Timeline Tab

The Timeline tab now renders natural execution events.

Each event describes:

- What changed
- Who or what changed it
- Why it mattered
- What happened next

## Efficiency Tab

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

## Network Tab

The Network tab is a real animated React Flow graph.

It includes:

- Movable agent nodes
- Agent icons
- Distinct agent colors
- Animated edges
- Moving packets
- Active node glow
- Completed node glow
- Conflict edges
- Mediator edges
- Workstream count per agent

Mediator appears or glows only when an active conflict exists or mediator participation is present.

## Replay System

Replay is a floating global overlay.

Replay supports:

- Mini dock
- Expanded timeline
- Inspector mode
- Play/pause
- Step backward/forward
- Restart
- Exit replay
- Speed control
- Follow toggle
- Adaptive toggle
- Click-to-seek event markers
- Picture-in-picture mode
- Dragging

Replay uses saved Mission Engine events.

It does not call Qwen.
It does not regenerate missions.

The replay inspector now shows readable event details instead of raw event JSON.

## Mission History

Mission history is stored locally.

Entries can include:

- Mission brief
- Configuration
- Workstreams
- Dialogue
- Conflicts
- Final report
- Efficiency metrics
- Replay events
- Saved/completed status

Reopening a completed mission restores elapsed duration, involved agents, workstreams, dialogue colors/icons, timeline, final report, efficiency metrics, and replay state when replay events are available.

## Reports Page

The Reports page lists completed reports.

It supports:

- Copy Markdown
- Export Markdown
- Human-readable report preview

The visible JSON export button was removed so normal UI does not expose raw mission objects.

## Settings

Settings currently include:

- Qwen API Key
- Qwen Base URL
- Qwen Model

## Mock Mode And Qwen Mode

The app supports:

- Mock mode for demos and development
- Qwen mode for real model responses

## Important UX Fixes Completed

- Sidebar stays stable while content scrolls.
- Completed Council Room no longer shows crowded overlapping bubbles.
- View Full Report selects and scrolls to Final Report.
- Replay Mission no longer opens Full Transcript.
- Full Transcript and per-message expand actions are separate.
- Agent expand opens Agent Contribution Drawer.
- Replay is floating and draggable.
- Replay inspector no longer shows raw JSON.
- Reports page no longer exposes JSON export.
- Dialogue uses agent icons instead of initials.
- Dialogue shows one consolidated Finalizer synthesis instead of repeated Finalizer cards.
- Duplicate identical dialogue messages are hidden.
- Conflict labels only appear on true conflict entries.
- Final Report sections are deduped and no-op sections are hidden.
- Workflow tab no longer shows the gray header helper text.
- Hardcoded semantic domain catalogs were removed from the mission engine.
- Settings no longer shows the environment-variable helper paragraph, mock fallback toggle, or developer debug mode toggle.

## Verification

The project has been verified with:

```txt
npx tsc --noEmit
npm run lint
npm run build
```

All checks passed after the latest updates.

## High-Level Product Pitch

Agent Society is an AI mission operating system.

Instead of asking one model to produce one answer, the app creates a council of specialized agents around a Mission Graph. The Planner decomposes the mission, specialists work on meaningful workstreams, Risk Critic challenges weak assumptions when needed, Mediator resolves real disagreements, and Finalizer assembles a polished final deliverable.

The Council Room makes collaboration visible. The replay system lets users inspect how the mission unfolded. The presentation layer turns structured execution data into a premium, human-readable consulting experience.
