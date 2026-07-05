# Settings Page Options

This file documents the current Settings page behavior for Agent Society.

## Qwen Connection

- Qwen API Key: saves a browser-local key in localStorage. A saved browser key overrides any local `.env.local` key.
- Base URL: saves the OpenAI-compatible Qwen/DashScope endpoint used by the client.
- Model: saves the active Qwen model name used by mission execution.
- Test Connection: records a local connection test result for the active key, base URL, and model fingerprint. The result persists when switching pages and only resets when the active runtime changes or settings are reset.

## Mission Preferences

- Auto Save Reports: when enabled, completed or cancelled mission contexts are saved to Mission History. When disabled, missions can complete without being written to local history.
- Stream Responses: when enabled, Qwen requests use streaming mode and the client collects streamed response chunks into the final agent output.
- Remember Previous Context: when enabled, mission recommendations can use saved history. When disabled, recommendations fall back to default presets.
- Retry Failed Requests: when enabled, failed Qwen requests are retried according to Retry Count and the existing fallback behavior remains available.
- Enable Keyboard Shortcuts: when enabled, Settings registers shortcut handling and exposes an app-level keyboard-shortcuts flag.
- Mission Timeout: controls the per-Qwen-request timeout in seconds.
- Retry Count: controls how many additional Qwen request attempts are made after the first failed attempt.

## Appearance

- Theme: saved to localStorage and applied as `data-agent-theme` on the document root.
- Accent Color: saved to localStorage and applied as `data-agent-accent` plus `--agent-settings-accent`.
- Animation Level: saved to localStorage and applied as `data-agent-animation`.
- Particle Density: saved to localStorage and applied as `data-agent-particles`.
- Glass Blur: saved to localStorage and applied as `data-agent-glass-blur` plus `--agent-settings-blur`.
- Reduce Motion: saved to localStorage and applied as `data-agent-reduce-motion`.

## Developer

- Developer Mode: maps to the existing runtime debug flag.
- Verbose Logs: enables lightweight Qwen request attempt/status logs and also activates the runtime debug flag.
- Experimental Features: saves an app-level `window.__AGENT_SOCIETY_EXPERIMENTAL__` flag for feature-gated work.
- Reset All Settings: restores mission preferences, appearance, developer options, and connection test state to defaults.

## Local Storage

- Clear Cache: removes replay event payloads from saved missions while preserving mission records, final reports, and Qwen settings.
- Export Settings: downloads current Settings page preferences and appearance values as JSON.
- Import Settings: opens the file picker and imports a valid Agent Society settings JSON file.

## Storage Keys

- `agent-society-settings-options`: mission preferences, appearance options, timeout, and retry count.
- `agent-society-qwen-connection-test`: last connection test result for the active runtime fingerprint.
- `agent-society-runtime-settings`: Qwen credentials and existing runtime flags.
