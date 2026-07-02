# Agent Society - Current Project Summary

## Short Brief

Agent Society is a futuristic AI Mission Control application built with Next.js, React, TypeScript, Tailwind, Zustand, Framer Motion, shadcn/Radix UI, and a frontend Mission Engine.

The product lets a user enter a complex mission brief, launch a multi-agent collaboration, and watch an AI society plan, divide work, collaborate, challenge assumptions, resolve conflicts, and synthesize a final report.

The project is no longer a simple linear pipeline. It now behaves like a Mission Graph driven agent society:

- The Planner creates dynamic workstreams.
- Specialist agents work on assigned tasks.
- Some workstreams can run in parallel.
- Risk and specialist agents can challenge assumptions.
- Conflicts can pause affected workstreams.
- The Mediator resolves disagreements.
- The Planner can revise the Mission Graph.
- The Finalizer waits for synchronization before producing the final report.
- Mission events are recorded and can be replayed through a floating replay control system.

## Current App Type

The current workspace is a frontend-first Next.js application.

Important:

- There is no active backend/database in this current workspace.
- Missions run through the frontend Mission Engine.
- The app supports mock mode and Qwen mode.
- Qwen calls are guarded during replay so replay does not regenerate missions.
- Local browser state is used for runtime settings and mission history.

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

Mission Control is the main experience. It includes:

- Dark futuristic UI.
- Space/mission-control visual style.
- Sticky desktop sidebar.
- Mobile navigation drawer.
- Mission brief composer.
- Mission configuration controls.
- Runtime status bar.
- Compact mission header during execution.
- Agent Council Room during running/completed missions.
- Detailed inspection tabs after completion.

### Mission Brief Composer

Before launch, the user sees a large mission composer where they can:

- Enter the mission brief.
- Choose or adjust mission configuration.
- Launch the mission.
- Cancel a running mission if needed.
- Use example prompts/configurations.

After launch, the composer collapses into a compact mission header so the live Council Room appears immediately.

## Agent Society Model

The system currently uses these agent identities:

- Planner
- Research Agent
- Product Strategist
- Technical Architect
- Marketing Strategist
- Finance Agent
- Risk Critic
- Mediator
- Finalizer

### How The Agents Work

The agents are not meant to be a fixed linear chain anymore. They form a dynamic society around the Mission Graph.

The Planner:

- Reads the mission brief.
- Creates a Mission Graph.
- Defines workstreams.
- Assigns primary and supporting agents.
- Defines dependencies and parallel waves.
- Identifies possible conflict zones.
- Can revise the graph after conflicts.

Specialist agents:

- Work on assigned workstreams.
- Produce task-specific outputs.
- Collaborate with supporting agents.
- Can challenge weak assumptions.
- Can create conflicts when assumptions, scope, costs, strategy, or risks do not align.

The Risk Critic:

- Monitors assumptions throughout execution.
- Flags weak logic, unrealistic plans, missing constraints, and contradictions.
- Can trigger conflicts before final synthesis.

The Mediator:

- Receives conflict context.
- Compares both sides of the disagreement.
- Produces a decision, rationale, and resolved action.
- Can cause graph revisions or unblock tasks.

The Finalizer:

- Waits until workstreams are complete enough.
- Waits until important conflicts are resolved.
- Synthesizes all agent outputs into a final report.
- Explains workstreams, collaboration, conflicts, mediator decisions, planner revisions, and efficiency gain versus a single-agent approach.

## Mission Graph

The Mission Graph is the core execution model.

It contains:

- missionId
- workstreams
- agents
- task nodes
- dependencies
- assignments
- statuses
- outputs
- conflicts
- synchronization points
- finalization readiness
- parallel groups
- conflict zones
- synthesis readiness criteria

Each workstream/task can include:

- id
- title
- description
- assigned primary agent
- supporting agents
- dependencies
- status
- output
- confidence
- started/completed timestamps

Supported task statuses include:

- pending
- ready
- running
- blocked
- completed
- revised
- cancelled

## Planner JSON Reliability

The Planner prompt now requires strict JSON output.

The system also includes robust parsing and repair logic:

- Attempts normal JSON parsing.
- Extracts JSON from markdown/code fences if needed.
- Extracts the first valid object when possible.
- Attempts to repair planner output.
- Falls back to mission-specific fallback workstreams only if repair fails.

Fallback workstreams are now more mission-specific and no longer collapse into a tiny generic 3-step pipeline.

For example, business/money/website-selling prompts create workstreams like:

- Niche Research and Business Targeting
- Offer and Website Package Design
- Website Production Workflow
- Lead Generation and Outreach
- Pricing, Payments and Revenue Model
- Sales Risk and Client Objection Review
- Final Execution Roadmap

## Agent Council Room

The old log-heavy War Room has been transformed into a premium Agent Council Room.

During running missions it shows:

- Agent roster.
- Circular council discussion area.
- Mission Engine center node.
- Active speaking agents with glow/pulse.
- Latest 3-5 speech bubbles only.
- Full Transcript drawer for older messages.
- Mission Intelligence panel.
- Workstream Strip.
- Workstream Inspector drawer.

This makes the mission feel like watching agents collaborate instead of reading a giant log.

## Completed Mission UX

The completed state was cleaned up to avoid clutter and overlapping cards.

After completion, the Council Room switches to a calmer 3-column summary layout:

- Left: Agent roster summary.
- Center: Council Summary / Final Synthesis Preview.
- Right: Mission Intelligence summary.

The completed summary includes:

- Mission Report Ready / Council Synchronized state.
- Saved to history badge.
- Final report objective/title.
- Executive summary.
- Key decision.
- Workstream count.
- Resolved conflict count.
- Confidence score.
- CTA buttons:
  - View Full Report
  - Export Markdown
  - Replay Mission
  - Start New Mission

## Detailed Tabs

Detailed tabs remain available after completion for inspection:

- Workflow
- Workstreams
- Dialogue
- Conflicts
- Final Report
- Timeline
- Efficiency
- Network

The View Full Report button now:

- Selects the Final Report tab.
- Smooth-scrolls to the tabs section.
- Briefly highlights the detailed tabs.
- Does not open transcript.
- Does not trigger replay.

## Transcript And Contribution Drawers

### Full Transcript Drawer

The Full Transcript button opens only the transcript drawer.

It supports:

- All agent messages.
- Filter by agent.
- Filter by message type.
- Search.
- Timestamps.
- Clean formatted summaries.
- Optional raw output only when Developer Debug Mode is enabled.

### Agent Contribution Drawer

Expanding a message opens a specific agent contribution drawer instead of the full transcript.

It shows:

- Selected agent contribution.
- Related workstreams.
- Agent-specific messages.
- Confidence/context where available.
- For Risk Critic: challenged assumptions/conflicts.
- For Mediator: decisions and resolved actions.
- Raw output only in Developer Debug Mode.

## Agent Output Formatting

The UI now uses an Agent Output Formatter layer.

It:

- Detects JSON strings.
- Safely parses output.
- Converts JSON into readable summaries.
- Converts arrays into bullet lists.
- Converts planner workstreams into cards.
- Hides internal ids like workstream ids and agent ids.
- Removes visible markdown markers such as `**bold**`.
- Prevents raw JSON from appearing in normal user-facing cards.
- Allows raw output only in Developer Debug Mode.

## Mission Intelligence Panel

Mission Intelligence summarizes the current mission state.

It shows:

- Current Decision.
- Active Conflict.
- Confidence Trend / confidence score.
- Next Up.
- Blocked Tasks.
- Mediator Notes.

If there is no conflict, it shows a calm monitoring state instead of pretending something is wrong.

## Workstream Strip And Inspector

The Workstream Strip is a compact horizontal set of task cards.

Each workstream card shows:

- Title.
- Primary agent.
- Supporting/dependency info.
- Status.
- Confidence.
- Why it can run now or why it is waiting.

Clicking a workstream opens a Workstream Inspector drawer with:

- Description.
- Primary agent.
- Supporting agents.
- Dependencies.
- Current output.
- Related conflicts.

## Replay System

Replay has been transformed from a page/end-section control into a floating global replay overlay.

Replay now has three UI states:

- Mini Dock.
- Expanded Timeline.
- Inspector mode.

It floats above the application and can be controlled from anywhere.

### Replay Features

The replay system supports:

- Play/pause.
- Step backward/forward.
- Restart.
- Exit replay.
- Speed controls.
- Adaptive speed toggle.
- Auto-follow toggle.
- Raw event inspector toggle.
- Click-to-seek timeline markers.
- Colored event markers.
- Agent-colored markers.
- Conflict/mediator/finalizer/workstream event coloring.
- Picture-in-picture mode.
- Draggable overlay in mini, expanded, and inspector states.
- Dragging from any non-control area.
- Smooth dragging without selecting/highlighting page text.
- Overlay can be moved beyond top/left/right/bottom screen edges.
- Mini dock has a single colored seek slider that can move forward/backward.

### Replay Keyboard Shortcuts

- Space: play/pause.
- Left/Right: seek 1 second.
- Shift + Left/Right: previous/next event.
- Plus/Minus: speed up/down.
- R: restart.
- I: inspector mode.
- T: expanded timeline.
- P: picture-in-picture.
- Escape: exit replay.

### Replay Behavior

Replay uses recorded Mission Engine events.

It does not call Qwen again.
It does not regenerate missions.
It reconstructs mission state from saved replay events.

Adaptive replay compresses idle gaps while preserving important moments like:

- Conflicts.
- Mediator interventions.
- Finalizer events.
- Synchronization.
- Mission completion.

Auto-follow can scroll/focus relevant UI sections while replaying:

- Mission tabs.
- Mission Intelligence.
- Workstream Strip.

## Settings

Settings currently include:

- Qwen API Key.
- Qwen Base URL.
- Qwen Model.
- Allow mock fallback on Qwen failure.
- Developer Debug Mode.

Developer Debug Mode is off by default.

When enabled, debug drawers can show raw model/replay output.

## Mock Mode And Qwen Mode

The app supports:

- Mock mode for demos and development.
- Qwen mode for real agent responses.
- Mock fallback behavior when allowed.

Qwen mode is expected to return structured content, especially from the Planner. The parser/repair layer protects the app if the model returns malformed JSON or markdown.

## Mission History

Completed or saved missions can be stored locally.

Mission history entries can include:

- Mission brief.
- Configuration.
- Workstreams.
- Dialogue.
- Conflicts.
- Final report.
- Efficiency metrics.
- Replay events.

Replay can be started from saved missions if replay events exist.

## Important UX Fixes Completed In This Session

- Sidebar is sticky/fixed during main page scroll.
- Main content scrolls independently.
- Completed Council Room no longer shows crowded overlapping speech bubbles.
- View Full Report now selects and scrolls to Final Report tab.
- Replay Mission no longer opens Full Transcript.
- Full Transcript and per-message expand actions are separate.
- Agent expand opens Agent Contribution Drawer.
- Replay is now floating and draggable.
- Replay mini dock has one colored seek slider.
- Replay drag no longer highlights/selects screen text.
- Agent messages no longer show raw JSON in normal UI.
- Markdown markers are cleaned from visible message summaries.

## Verification

The project has been verified with:

```txt
npx tsc --noEmit
npm run lint
npm run build
```

All checks passed after the latest replay and Council Room updates.

## High-Level Product Pitch

Agent Society is an AI mission operating system.

Instead of asking one model to produce one answer, the app creates a society of specialized agents. The Planner turns a user brief into a Mission Graph. Specialists take ownership of workstreams, collaborate in parallel, challenge weak assumptions, resolve disagreements through a Mediator, and synchronize before the Finalizer creates the final report.

The Council Room makes the collaboration visible. The Replay system lets users inspect how the mission unfolded over time. The result feels less like a chatbot response and more like watching an AI organization think, negotiate, and execute.
