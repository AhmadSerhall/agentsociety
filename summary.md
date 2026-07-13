# Agent Society - Current Project Summary

## Short Brief

Agent Society is a futuristic AI Mission Control application built with Next.js, React, TypeScript, Tailwind CSS, Zustand, Framer Motion, shadcn/Radix UI, Lucide icons, and a frontend Mission Engine.

The product lets a user enter a complex mission brief, configure execution style, launch a multi-agent collaboration, watch the mission run, inspect the graph, replay execution, and receive a polished final deliverable.

The project is now a Mission Graph driven agent society with a dedicated presentation layer.

## Recent Updates

- Final-report Risk Summary and Success Measures now use mission runtime data and display as clear, structured insights instead of generic term fragments or dense metric sentences.
- Shared structured content renders markdown tables as responsive, polished tables and blockquotes as callouts without raw markdown markers.
- Every Mission Control view now has a bottom-right scroll-to-top control with a circular scroll-progress indicator that resets on navigation.
- Recent Mission History entries can now be manually saved into the Saved Missions group.
- Agents now receive shared mission memory through prior workstream outputs, dialogue, dependencies, conflicts, planner revisions, and confidence context. Prompts require agents to acknowledge relevant earlier findings without inventing context.
- Agent confidence evolves through evidence and dependency checks instead of jumping directly to a final value. Each transition includes a reason, updates the timeline, and is stored as a replay event through the `CONFIDENCE_UPDATED` event type.
- Agent prompts now reinforce distinct role voices: Planner is structured and milestone-oriented, Research is evidence-first, Technical is implementation-focused, Marketing is customer-oriented, Finance is numerical, Risk Critic is skeptical, Mediator is diplomatic, and Finalizer is executive and concise.
- Live execution now exposes contextual activity stages such as reviewing shared context, evaluating evidence, cross-checking assumptions, preparing recommendations, and sharing findings. The Agent Council animates these updates in the active specialist card, roster, and Live Dispatch area.
- Replay reconstructs agent activity details and confidence transitions from recorded Mission Engine events, preserving the execution evolution for inspection.

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
- Press Enter to launch, Shift+Enter to insert a line break, or Ctrl/Cmd+Enter to launch
- Review local AI Mission Config Suggestions after typing

When the user types in the mission brief, the Mission Config button can draw attention so the user remembers to configure parameters.

Configuration includes options such as mission type, depth, time horizon, budget range, risk tolerance, and output format. Time horizon and risk tolerance support a "None specified" style state.

General Mission is the first mission type and the default selection. Output format defaults to `Direct Result`, which tells the engine to prefer a concise final answer for simple missions. It does not hard-disable planning for complex missions; the classifier still decides whether a mission graph is necessary.

AI Mission Config Suggestions use the same Mission Classification Engine before launch. After the user pauses typing, the composer can suggest mission type, depth, output format, time horizon, budget range, and risk tolerance with an explainable "Why?" line. The user can apply the suggestion, open the manual config drawer, or dismiss it for the current text. Manual configuration remains respected unless the user explicitly applies a new suggestion.

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

The engine now thinks before it plans. A Mission Classification Engine runs before Planner and decides whether the request needs a mission graph or can be handled by a direct specialist path.

Classification stores:

- Mission type
- Complexity score from 1-10
- Estimated workstreams and duration
- Recommended agents
- Whether planning, research, conflict resolution, and parallelism are needed
- Selected strategy
- Planning reason
- Classification confidence

For simple missions such as translation, summarization, direct Q&A, conversation, or small creative writing requests, Planner is skipped and the engine creates a minimal specialist path. If `Direct Result` is selected, that concise path is preferred even more strongly when the classifier agrees the prompt is simple enough. For complex missions such as startup launch, ERP design, software architecture, business planning, or multi-step execution, Planner creates a Mission Graph.

Agent execution is artifact-first:

- Workers produce the requested deliverable itself, such as translated text, code, research, writing, architecture, finance analysis, or campaign content.
- Reviewers inspect and correct worker output without replacing it with new unrelated work.
- Coordinators assign, merge, or resolve. Planner is not the default entry point, and Finalizer merges verified outputs instead of inventing a new deliverable.

For direct missions, the final report primary answer is pulled from the worker artifact. Generic meta-output such as "translation completed" or "mission complete" is rejected by the usefulness gate.

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

Not every mission receives a large graph. Low-complexity missions can use a direct one-or-two-step graph generated from classification rather than Planner output.

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
- Compact Mission Operations Board
- Mission Engine routing card
- Active specialist card with glow/pulse
- Summary-first Live Dispatch
- Compact agent progress strip
- Mission metrics strip
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

Actionable report bullets and practical-step cards can include stable drilldown ids. These cards do not expose internal payloads; they call the drilldown layer with human-readable source text and parent mission metadata.

## Mission Drilldown And Sub-Missions

Completed mission outputs are no longer static advice.

Actionable cards from final reports, structured action lists, practical steps, recommendations, and workstreams can open a Drilldown Mission drawer. The drawer shows:

- Parent mission title
- Selected card text
- Source type
- Related agent and workstream when available
- Suggested sub-mission prompt
- Quick Expand
- Launch Sub-Mission
- Add to Mission Backlog

Quick Expand uses the active Qwen/mock runtime to generate focused detail for the selected card without replacing the parent mission. It is scoped to the selected item and follows the existing deliverable-mode logic so simple expansions stay direct and implementation-focused.

Launch Sub-Mission starts a normal Mission Engine run with parent context and source-card metadata. Child missions store `parentMissionId`, `sourceCardId`, `sourceCardText`, `sourceAgentId`, and `sourceWorkstreamId`. Mission History and Reports show a Sub-Mission badge so parent/child relationships remain visible.

Add to Mission Backlog saves the selected follow-up on the parent mission record. The Mission Control page shows a Mission Backlog panel listing pending follow-ups, each of which can reopen the drilldown drawer.

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

Workstream cards are actionable drilldown sources. Clicking a meaningful workstream opens the Drilldown Mission drawer so the user can expand that exact piece of work, launch it as a linked sub-mission, or store it in the parent mission backlog.

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
- Tracked token estimate
- Average latency
- Retry count
- Failure count
- Parallelism percentage
- Consensus percentage
- Agent utilization
- Single-agent baseline comparison

Efficiency values are derived from the current mission context, replay events, workstreams, dialogue, task dependencies, conflicts, timing, and agent participation. They are not static demo values. The chart baselines for single-agent quality, coverage, confidence, and perspectives are calculated separately so different missions can produce different comparison shapes. Completion time now shows actual runtime when available, otherwise a telemetry estimate from task count, latency, dependencies, and complexity.

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
- Active key status
- Masked active key display
- Qwen/DashScope API key link
- Connection test
- Rich runtime health cards
- Today's local activity KPIs based on saved mission telemetry, not provider billing
- Local storage diagnostics
- Mission preference toggles
- Appearance controls
- Collapsible developer controls

Qwen settings are resolved through `src/lib/qwenConfig.ts`.

API key priority is:

1. Saved browser key in localStorage
2. Local developer env key from `VITE_QWEN_API_KEY`
3. Missing key

The full API key is never displayed. Long keys are masked in the Qwen API Key field using the first 14 characters, bullets, and the last 14 characters. Saved keys override local env keys, and clearing the saved browser key falls back to the local env key if one exists.

Fresh installs without a saved or env key show a first-run onboarding modal explaining that users must bring their own Qwen/DashScope API key. Mission launch is blocked until a key is saved or available through local env configuration.

The onboarding modal presents Qwen setup as a short ordered checklist: go to Settings, log in or create a Qwen/DashScope account, generate a key, and paste it into the Qwen API Key field.

The Settings page now presents as a premium AI Operating System configuration panel with glass cards, animated status indicators, richer runtime metrics, local storage stats, and preference/appearance controls while preserving the existing Qwen key behavior.

The runtime section only shows capabilities the app can honestly represent. Placeholder capability cards such as streaming and vision support were removed until the app has verified model capability data. The former usage panel is now "Today's Local Activity" and reports missions completed today, recorded events, and tracked tokens from local mission history rather than pretending to show exact Qwen billing data.

Local Storage actions are wired:

- Clear Cache removes replay event payloads from saved mission history while preserving mission records, reports, and Qwen settings.
- Export Settings downloads current preference and appearance settings as JSON.
- Import Settings opens the file picker and loads a valid Agent Society settings JSON file.

Settings options are now persisted through `src/lib/settingsPreferences.ts` and documented in `settingspageoptions.md`.

Functional option behavior now includes:

- Connection test state persists across page switches for the active Qwen runtime fingerprint.
- Auto Save Reports controls whether completed/cancelled missions are written to Mission History.
- Stream Responses switches the Qwen client into streaming mode and collects streamed chunks into final output.
- Remember Previous Context controls whether history is used for recommended mission prompts.
- Retry Failed Requests and Retry Count control Qwen request retry behavior.
- Mission Timeout controls the per-Qwen-request timeout.
- Developer Mode and Verbose Logs map into runtime debug behavior, and Verbose Logs prints lightweight Qwen request diagnostics.
- Appearance options are saved and applied as document root data attributes/CSS variables.
- Reset All Settings restores defaults and clears persisted connection-test state.

## Command Layer Widget

The lower-left sidebar Command Layer is now a compact live system widget instead of static explanatory text.

It shows:

- Online status
- API/runtime/mission engine/replay/agent readiness
- Latency, mission, completion, and current panel mode stats
- Rotating live activity messages
- Quick action icon buttons for Mission Control, Reports, Agents, and History

The widget is slightly taller for readability while staying inside the sidebar. The Agent Society brand block above it is centered as a row with icon plus title, and the widget includes pulse, progress, hover glow, live activity, and tooltip interactions.

Reports page copy actions now show a small bottom-right glass toast that confirms markdown was copied or explains if clipboard access was blocked.

## Running Mission View

The active mission council view no longer uses the old solar-system orbit layout. While a mission is running, the center panel now renders a Mission Operations Board:

- A compact Mission Engine card that does not overlap text or icons
- A focused active-specialist card with the correct shared agent icon and color
- Agent state is shown in a tighter Agent Roster as Working, Finished, or Waiting
- A horizontal/responsive agent progress strip with icon, status, percent, and progress bar
- A dedicated Live Dispatch panel that summarizes the latest agent signal instead of showing full transcript text
- Recent signal rows with one-line summaries, timestamps, status chips, hover, and inspect behavior
- A compact metrics strip for tasks completed, active agents, average response, tracked tokens, estimated cost, and success rate
- Mission Intelligence opens as a z-[9999] overlay instead of consuming a fixed right column
- Mission Intelligence shows the selected mission configuration and live/final mission metrics for the current run
- Full Transcript remains available for the complete message history

Long agent outputs are clamped in the dashboard and can be opened through Inspect or Full Transcript. Mission Intelligence uses a short complete summary for Current Decision instead of clipped text with ellipses. The running board uses compact cards, internal scrolling only where useful, and natural page scrolling. It does not force the Mission Engine area into a fixed 100vh-style container, so context is not clipped.

## Direct Answer Output

Mission classification now includes a `deliverableMode`:

- `direct_answer` for translation, summarization, simple explanations, simple Q&A, conversation, and lightweight education/math answers.
- `artifact` for small writing tasks, code generation/debugging, document generation, file analysis, and code review.
- `mission_report` for complex planning, business, startup, ERP, financial, architecture, and multi-step execution missions.

When `deliverableMode` is `direct_answer`, the Final Report tab is presented as Answer. It renders only the final answer and an optional reviewer note. Consulting sections such as Workstreams, Expert Contributions, Action Plan, Risk Summary, Resources, Success Measures, and Final Recommendations are intentionally hidden for simple tasks.

Direct-answer agent output now has a first-class `finalAnswer` field. The finalizer must pass through the useful worker/reviewer answer instead of inventing report sections or recommendations. The markdown exporter also emits a simple Answer document for these missions.

Roadmap, checklist, timing, watch-out, and step-based answers are rendered through a structured content component instead of being shown as one dense paragraph. The completed mission summary and report sections can display modern numbered cards, bullet rows, and lightweight section headings from the same final text.

The Dialogue tab now shows full agent message summaries without ellipsis truncation, while compact running-dashboard views can still clamp text where needed. Developer Debug fields wrap naturally so selected agents, planning status, and planning reason remain readable.

## Mock Mode And Qwen Mode

The app supports:

- Mock mode for demos and development
- Qwen mode for real model responses

Mock mode is visible when no usable key is resolved, but mission launch is guarded so users cannot accidentally run missions without configuring Qwen.

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
- First-run Qwen API key onboarding and mission launch guard were added for open-source users.

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

Instead of asking one model to produce one answer, the app classifies the request, chooses the smallest useful team, and only creates a full Mission Graph when decomposition improves quality. Planner is conditional, specialists work on meaningful workstreams, Risk Critic challenges weak assumptions when needed, Mediator resolves real disagreements, and Finalizer assembles a polished final deliverable.

The Council Room makes collaboration visible. The replay system lets users inspect how the mission unfolded. The presentation layer turns structured execution data into a premium, human-readable consulting experience.
