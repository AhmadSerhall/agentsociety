# Agent Society - Current Project Summary

## Project Overview

Agent Society is now a full-stack AI Mission Control project.

The product is a dark futuristic Mission Control dashboard where a user can enter a video generation mission, configure generation parameters, upload assets, launch a multi-agent workflow, and watch multiple AI agents collaborate in real time.

The project has moved beyond a static frontend demo. It now includes:

- A Next.js frontend.
- A Node.js/Express backend.
- Socket.IO real-time mission events.
- A simulated live multi-agent workflow.
- A Qwen-ready agent integration layer.
- Mock fallback mode when no Qwen API key is configured.

The current goal of the app is to feel like a premium AI operating system where agents plan, research, create, critique, mediate, and finalize a video generation blueprint.

## Current Architecture

The intended full-stack structure is:

```txt
root/
  frontend/
    Next.js frontend app

  backend/
    Node.js / Express backend
```

The backend is responsible for:

- Mission creation.
- Mission validation.
- Agent orchestration.
- Mock/Qwen agent execution.
- Socket.IO live events.
- Uploaded asset metadata handling.

The frontend is responsible for:

- Mission Control UI.
- Prompt entry.
- Asset selection and preview.
- Generation parameter drawer.
- Launching missions.
- Listening to Socket.IO events.
- Rendering live mission progress.

## Frontend Summary

The frontend includes a polished Mission Control page with:

- Dark futuristic neon design.
- Animated hero panel.
- Animated planet and space particles.
- Large mission prompt textarea.
- Add Assets button with file picker.
- Uploaded asset preview cards.
- Asset hover preview.
- Asset preview modal.
- Advanced Generation Parameters drawer.
- Launch Generation button.
- Empty prompt validation modal.
- Mission status bar.
- Agent Workflow panel.
- Generated Subtasks panel.
- Agent Dialogue panel.
- Conflict Resolution panel.
- Mission Output Preview panel.
- Mission History section.

The frontend originally used static mock timers, but it has now been connected to the backend.

## Frontend Backend Connection

The Launch Generation button now calls:

```txt
POST /api/missions
```

The frontend sends:

- `prompt`
- `negativePrompt`
- `stylePreset`
- `cameraMotion`
- `resolution`
- `duration`
- `aspectRatio`
- `assets`

After the backend returns a `missionId`, the frontend joins the mission Socket.IO room and listens for mission events.

The frontend listens for:

- `mission:started`
- `agent:started`
- `agent:message`
- `step:completed`
- `conflict:detected`
- `conflict:resolved`
- `mission:completed`
- `mission:error`

The UI updates in real time from backend events:

- Active agent.
- Generated subtasks.
- Agent dialogue messages.
- Conflict state.
- Mediator resolution.
- Render progress.
- Mission completion.
- Final blueprint output.

The frontend styling was not redesigned during backend integration. The existing Mission Control UI was preserved.

## Backend Summary

The backend is a Node.js/Express server with Socket.IO.

Installed backend dependencies:

- `express`
- `cors`
- `dotenv`
- `socket.io`
- `multer`
- `zod`
- `uuid`
- `nodemon`

Backend scripts:

```json
{
  "dev": "nodemon src/server.js",
  "start": "node src/server.js"
}
```

The backend currently supports:

- REST API mission creation.
- REST API mission lookup.
- REST API mission steps lookup.
- REST API asset upload metadata.
- Socket.IO mission rooms.
- Sequential multi-agent orchestration.
- Mock agent mode.
- Qwen agent mode.
- Mock fallback when Qwen is unavailable.

## Backend API

### Health

```txt
GET /health
```

Returns basic backend health.

```txt
GET /api/health
```

Returns Qwen/agent mode status:

```json
{
  "status": "ok",
  "agentMode": "mock"
}
```

### Create Mission

```txt
POST /api/missions
```

Accepts:

```json
{
  "prompt": "Neon city flythrough with autonomous agents coordinating a launch.",
  "negativePrompt": "",
  "stylePreset": "Cinematic",
  "cameraMotion": "Orbit",
  "resolution": "1080p",
  "duration": 8,
  "aspectRatio": "16:9",
  "assets": []
}
```

Behavior:

- Validates request with Zod.
- Rejects empty prompts with a clean `400` error.
- Creates an in-memory mission object.
- Starts the multi-agent workflow asynchronously.
- Returns a `missionId` immediately.

Example response:

```json
{
  "missionId": "uuid-here",
  "status": "queued"
}
```

### Get Mission

```txt
GET /api/missions/:id
```

Returns mission details.

### Get Mission Steps

```txt
GET /api/missions/:id/steps
```

Returns all recorded mission steps.

### Upload Mission Assets

```txt
POST /api/missions/:id/assets
```

Uses Multer and accepts uploaded files.

Current behavior:

- Stores mock file metadata in memory.
- Does not connect to cloud storage yet.

## Socket.IO Events

The backend emits:

- `mission:started`
- `agent:started`
- `agent:message`
- `step:completed`
- `conflict:detected`
- `conflict:resolved`
- `mission:completed`
- `mission:error`

The frontend joins a mission room using:

```txt
mission:join
```

And can leave with:

```txt
mission:leave
```

## Mock Multi-Agent Workflow

The backend currently runs this sequential workflow:

1. Planner Agent starts.
2. Planner decomposes the user prompt into subtasks.
3. Generated subtasks are emitted one by one.
4. Research Agent starts.
5. Creative Agent starts.
6. Technical Agent starts.
7. Critic Agent reviews previous outputs.
8. Conflict is detected between Creative Agent and Critic Agent.
9. Mediator Agent starts.
10. Mediator resolves the conflict.
11. Finalizer Agent creates a final video generation blueprint.
12. Render/preview steps are simulated.
13. Mission completes.

The workflow intentionally runs mostly sequentially so the frontend feels like a real mission dashboard.

## Backend Terminal Logs

The backend now logs the workflow clearly so it is easy to confirm the system is working.

Example logs:

```txt
[mission:id] queued -> "Neon city flythrough..."
[mission:id] mission:started
[mission:id] agent:started -> Planner Agent
[mission:id] agent:message -> Planner Agent (mock)
[mission:id] subtask:completed -> Analyze mission intent
[mission:id] agent:started -> Research Agent
[mission:id] agent:message -> Research Agent (mock)
[mission:id] conflict:detected -> Creative Agent vs Critic Agent
[mission:id] conflict:resolved -> ...
[mission:id] agent:started -> Finalizer Agent
[mission:id] mission:completed -> 100%
```

This confirms the mock multi-agent workflow is working live.

## Qwen Integration

Phase 5 added a Qwen-ready backend integration.

The backend now supports:

- `AGENT_MODE=mock`
- `AGENT_MODE=qwen`
- Qwen API key from environment variables.
- Qwen base URL from environment variables.
- Qwen model from environment variables.
- Mock fallback when Qwen is unavailable.

Environment example:

```env
PORT=5000
FRONTEND_URL=http://localhost:3000
QWEN_API_KEY=
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-plus
AGENT_MODE=mock
```

To enable Qwen mode:

```env
AGENT_MODE=qwen
QWEN_API_KEY=your_qwen_key_here
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-plus
```

If `AGENT_MODE=mock` or the API key is missing, the backend returns mock agent outputs.

If `AGENT_MODE=qwen`, the backend calls a Qwen OpenAI-compatible chat completions endpoint.

If a Qwen call fails:

- The error is logged clearly.
- The mission does not crash.
- That agent falls back to mock output.
- The workflow continues.

## Qwen Service

The Qwen service exposes:

```js
generateAgentResponse({
  agentName,
  systemPrompt,
  userPrompt,
  context,
  temperature,
  jsonMode
})
```

Responsibilities:

- Reads `AGENT_MODE`.
- Reads `QWEN_API_KEY`.
- Reads `QWEN_BASE_URL`.
- Reads `QWEN_MODEL`.
- Calls Qwen when enabled.
- Returns mock output when in mock mode.
- Returns mock fallback on failure.
- Normalizes all responses.
- Attempts JSON parsing when `jsonMode` is enabled.
- Prevents one failed agent from crashing the whole mission.

## Agent Modules

Each agent module now exports:

- `name`
- `role`
- `color`
- `systemPrompt`
- `run(input)`

Agents:

- `planner.agent.js`
- `research.agent.js`
- `creative.agent.js`
- `technical.agent.js`
- `critic.agent.js`
- `mediator.agent.js`
- `finalizer.agent.js`

### Planner Agent

Planner decomposes the user prompt into subtasks.

Expected JSON shape:

```json
{
  "summary": "",
  "subtasks": [
    {
      "id": 1,
      "title": "",
      "description": "",
      "assignedAgent": ""
    }
  ]
}
```

### Research Agent

Research extracts:

- Production requirements.
- Uploaded asset references.
- Useful constraints.

### Creative Agent

Creative generates:

- Creative direction.
- Visual style.
- Mood.
- Scene ideas.
- Pacing.

### Technical Agent

Technical converts creative direction into:

- Video generation instructions.
- Aspect ratio usage.
- Duration usage.
- Resolution usage.
- Camera motion plan.
- Asset usage plan.

### Critic Agent

Critic reviews:

- Missing details.
- Contradictions.
- Quality risks.
- Weak creative or technical decisions.

### Mediator Agent

Mediator resolves the conflict between Creative and Critic.

It produces a final decision that keeps the creative ambition but reduces risk.

### Finalizer Agent

Finalizer combines all previous outputs into a final Video Generation Blueprint.

Expected JSON fields:

- `title`
- `concept`
- `sceneBreakdown`
- `assetUsagePlan`
- `cameraPlan`
- `stylePrompt`
- `negativePrompt`
- `generationSettings`
- `qualityChecklist`
- `finalVideoPrompt`

The frontend can display structured finalizer output in the existing Mission Output Preview panel.

## Safe JSON Parsing

The backend includes a safe JSON helper.

If Qwen returns invalid JSON:

- It first tries normal `JSON.parse`.
- It attempts to extract JSON from fenced code blocks.
- It attempts to extract JSON from surrounding text.
- If parsing still fails, it falls back to text output.
- The mission continues.

## Frontend Compatibility With Qwen Output

The frontend was not redesigned.

Only compatibility was added so that:

- `mission:completed` can include final structured output.
- The existing Mission Output Preview panel can show the final blueprint title.
- The panel can show concept text.
- The panel can show final video prompt.
- The panel can show part of the quality checklist.

Existing styling remains unchanged.

## Environment Files

Backend example:

```txt
backend/.env.example
```

Includes:

```env
PORT=5000
FRONTEND_URL=http://localhost:3000
QWEN_API_KEY=
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-plus
AGENT_MODE=mock
```

Frontend example:

```txt
frontend/.env.local.example
```

Includes:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

## How To Run

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Expected URLs:

```txt
Frontend: http://localhost:3000
Backend:  http://localhost:5000
```

## How To Test The Live Workflow

1. Start the backend.
2. Start the frontend.
3. Open `http://localhost:3000`.
4. Enter a mission prompt in Mission Control.
5. Click `Launch Generation`.
6. Watch the frontend panels update live.
7. Watch the backend terminal logs.

Expected frontend behavior:

- Launch button changes to generating state.
- Agent workflow progresses agent by agent.
- Subtasks appear progressively.
- Agent dialogue appears step by step.
- Conflict appears.
- Mediator resolves conflict.
- Output preview renders progress.
- Mission completes with a final blueprint.

Expected backend behavior:

- Terminal logs show each mission step.
- `/api/health` returns `agentMode`.
- `/api/missions/:id` returns mission details.
- `/api/missions/:id/steps` returns all mission steps.

## Verification Completed

The project was verified with:

```bash
npm run lint
npm run build
node --check src/server.js
node --check src/services/qwen.service.js
node --check src/services/missionOrchestrator.service.js
```

A backend smoke test was also run:

- `/api/health` returned `agentMode: mock`.
- `POST /api/missions` returned a `missionId`.
- The full workflow ran through Planner, Research, Creative, Technical, Critic, Mediator, and Finalizer.
- Backend logs confirmed the new agent runner path was working.

## Important Current Notes

- Mock mode must remain available.
- Qwen mode is opt-in.
- Qwen failures should never crash the mission.
- The backend currently stores missions in memory only.
- Uploaded assets currently store metadata only.
- No cloud storage is connected yet.
- No database is connected yet.
- The frontend UI should not be redesigned during backend/Qwen work.
- Socket.IO event names should remain stable for frontend compatibility.

## Final Current State

Agent Society now has a working full-stack foundation:

- Premium Mission Control frontend.
- Express backend.
- Live Socket.IO mission execution.
- Multi-agent workflow.
- Mock mode.
- Qwen-ready mode.
- Agent-specific prompts.
- Safe JSON parsing.
- Final structured blueprint output.
- Clear backend logs for testing.

The project is ready for the next phase: improving persistence, adding real asset storage, refining Qwen prompts, and eventually connecting the final blueprint to an actual video generation provider.
