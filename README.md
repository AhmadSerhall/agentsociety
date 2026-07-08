# Agent Society

**Agent Society** is an AI Mission Control platform that turns a user’s mission brief into a structured multi-agent execution process powered by Qwen/DashScope.

Instead of sending a prompt to one generic assistant, Agent Society classifies the mission, selects the smallest useful agent team, builds a Mission Graph when needed, runs specialist agents through coordinated workstreams, handles disagreements through a mediator, records replayable execution events, and delivers a polished final report or direct answer.

## Features

* AI Mission Control dashboard
* Mission brief composer
* Enter-to-launch mission flow
* AI mission configuration suggestions
* Conditional Mission Classification Engine
* Dynamic Mission Graph orchestration
* Parallel workstream execution
* Specialist agent collaboration
* Real conflict detection and mediation
* Live Mission Operations Board
* Agent roster and progress tracking
* Human-readable dialogue and timeline
* Final report synthesis
* Mission replay system
* Mission history stored locally
* Drilldown missions and sub-missions
* Qwen/DashScope API integration
* Bring-your-own API key settings flow

## Agent Council

Agent Society uses a council-style agent model:

* **Planner** — creates the Mission Graph when decomposition improves quality
* **Research Agent** — gathers context, constraints, and evidence
* **Product Strategist** — handles product scope, user value, and positioning
* **Technical Architect** — handles technical structure, architecture, and implementation planning
* **Marketing Strategist** — handles audience, channels, launch strategy, and messaging
* **Finance Agent** — handles budget, cost, and resource analysis
* **Risk Critic** — challenges weak assumptions and flags meaningful risks
* **Mediator** — resolves real conflicts when agents disagree
* **Finalizer** — synthesizes the validated work into the final deliverable

Agents are not forced into every mission. The Mission Classification Engine decides which agents are useful based on the user’s objective.

## How It Works

```txt
User Mission Brief
        ↓
Mission Configuration
        ↓
Mission Classification Engine
        ↓
Direct Specialist Path or Mission Graph
        ↓
Workstreams and Execution Tasks
        ↓
Specialist Agent Outputs
        ↓
Conflict Detection and Mediation
        ↓
Finalizer Synthesis
        ↓
Presentation Renderer
        ↓
Final Answer, Report, Timeline, Replay, and History
```

Simple missions such as translation, summarization, direct Q&A, or small writing tasks can skip heavy planning and return a direct answer.

Complex missions such as startup launches, software architecture, ERP planning, business strategy, or multi-step execution use a Mission Graph with dependencies, parallel workstreams, agent assignments, and synthesis readiness.

## Mission Graph

The Mission Graph controls how work is executed.

It can include:

* Task nodes
* Workstreams
* Assigned agents
* Supporting agents
* Dependencies
* Parallel groups
* Conflict zones
* Synchronization points
* Task status
* Confidence scores
* Agent outputs
* Finalization readiness

Supported task states include:

* `pending`
* `ready`
* `running`
* `blocked`
* `completed`
* `revised`
* `cancelled`

## Replay System

Agent Society records mission events locally so completed missions can be replayed without calling Qwen again.

Replay supports:

* Play and pause
* Step forward and backward
* Restart
* Speed control
* Timeline markers
* Event inspector
* Mission state reconstruction

Replay is useful for understanding how the agent council reached the final result.

## Presentation Layer

Agent Society includes a dedicated presentation renderer that converts structured mission data into readable UI sections.

The normal user interface avoids showing:

* Raw JSON
* Internal payloads
* Parser artifacts
* Object literals
* `null` or `undefined`
* Developer-only metadata
* Repeated agent messages

This keeps the experience polished and human-readable.

## Tech Stack

* Next.js
* React
* TypeScript
* Tailwind CSS
* Framer Motion
* Zustand
* shadcn/Radix UI
* Lucide Icons
* React Flow
* Qwen/DashScope compatible API

## Project Type

This project is a frontend-first hackathon implementation.

Important notes:

* There is no bundled backend or database.
* Mission history and replay data are stored locally in the browser.
* Qwen calls are made through the configured Qwen/DashScope-compatible endpoint.
* The project supports mock/demo behavior during development, but real mission execution requires a Qwen API key.

## Bring Your Own Qwen API Key

Agent Society is open source and does not include a shared API key.

Anyone who clones or downloads this repository must provide their own Qwen/DashScope API key before running real missions.

### Setup Steps

1. Clone the repository.
2. Create or log in to a Qwen/DashScope account.
3. Generate an API key from the Qwen/DashScope console.
4. Run the app.
5. Open **Settings**.
6. Paste your Qwen API key.
7. Launch a mission.

You can also use a local environment file for development.

```bash
cp .env.example .env.local
```

Then set:

```bash
VITE_QWEN_API_KEY=your_key_here
VITE_QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
VITE_QWEN_MODEL=qwen-turbo
```

Browser-saved keys override the local environment key. Clearing the browser key falls back to the local environment key when one exists.

## Environment Safety

This project runs Qwen calls from the browser.

Because this is a frontend-first project, any key used by the client is available to the client runtime. Use development, restricted, or hackathon testing keys only.

Never commit real API keys.

The following files are ignored for safety:

```txt
.env
.env.local
.env.*.local
```

## Installation

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Then open:

```txt
http://localhost:3000
```

## Build

```bash
npm run build
```

## Validation

The project has been checked with:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Recommended Repository Structure

```txt
agent-society/
├── public/
├── src/
│   ├── features/
│   │   └── mission-control/
│   ├── lib/
│   └── components/
├── .env.example
├── .gitignore
├── LICENSE
├── README.md
├── package.json
└── next.config.ts
```

## Architecture Diagram

The repository should include an architecture diagram showing how the frontend, Mission Engine, agent council, local browser storage, and Qwen/DashScope API connect.

Recommended file:

```txt
public/architecture-diagram.png
```

## Hackathon Submission Notes

For hackathon judging, this repository includes:

* Source code
* Setup instructions
* Qwen/DashScope configuration instructions
* Open-source license
* Local execution instructions
* Mission engine and agent council implementation
* Replay and mission history logic

## License

This project is open source and available under the terms of the license included in this repository.
