# Settings Page Options

This file documents the current Settings page behavior for Agent Society.

## Qwen Connection

- Qwen API Key: saves a browser-local key in localStorage. A saved browser key overrides any local `.env.local` key.
- Base URL: saves the OpenAI-compatible Qwen/DashScope endpoint used by the client.
- Model: saves the active Qwen model name used by mission execution.
- Test Connection: sends a minimal request to the configured Qwen runtime. A successful response records latency, model availability, verification time, and the active runtime fingerprint. A rejected request clears the prior success state and shows the current API-health error.
- Reveal key: deliberately reveals a browser-saved key; it remains disabled when only an environment key or no key is available.
- Copy masked key: copies only the masked representation, never the full secret.
- Save Qwen Settings: saves a pasted key or reuses the existing browser-saved key when only the endpoint/model changes.
- Delete: removes only the browser-saved key and is disabled when no browser-local key exists.

## Mission Preferences

- Auto Save Reports: when enabled, completed or cancelled mission contexts are saved to Mission History. When disabled, missions can complete without being written to local history.
- Stream Responses: when enabled, Qwen requests use streaming mode and the client collects streamed response chunks into the final agent output.
- Remember Previous Context: when enabled, mission recommendations can use saved history. When disabled, recommendations fall back to default presets.
- Retry Failed Requests: when enabled, transport failures, request timeouts, HTTP 408, and server errors are retried according to Retry Count. Authentication, quota, and other non-retryable client errors are not retried, and failed live requests never become mock mission results.
- Enable Keyboard Shortcuts: enables global `Alt+Shift+M/H/R/S` navigation for Mission Control, Mission History, Reports, and Settings.
- Mission Timeout: controls the per-Qwen-request timeout in seconds.
- Retry Count: controls how many additional Qwen request attempts are made after the first failed attempt.

## Appearance

- Theme: changes the application background palette and is also exposed as `data-agent-theme` on the document root.
- Accent Color: changes global accent, selection, scrollbar, ambient particle, and glow colors through `data-agent-accent` and `--agent-settings-accent`.
- Animation Level: changes ambient particle/glow animation speed through `data-agent-animation` and `--agent-settings-animation-speed`.
- Particle Density: changes the rendered ambient particle and star counts through `data-agent-particles`.
- Glass Blur: changes backdrop blur on glass surfaces through `data-agent-glass-blur` and `--agent-settings-blur`.
- Reduce Motion: disables ambient CSS animation and requests reduced Framer Motion throughout the app through `data-agent-reduce-motion`.

Appearance settings are loaded and applied when the application starts, not only when the Settings page is open. Every appearance change is also broadcast to active consumers so the current page updates immediately.

## Developer

- Developer Mode: enables the existing runtime debug flag and reveals the Developer Debug mission panel.
- Verbose Logs: enables lightweight Qwen request attempt/status logs and also reveals the Developer Debug mission panel.
- Reset Preferences & Appearance: restores mission preferences, appearance, developer options, timeout/retry values, and connection-test state. It does not delete API credentials or mission history.

## Local Storage

- Clear Cache: removes replay event payloads from saved missions while preserving mission records, final reports, and Qwen settings.
- Export Settings: downloads current Settings page preferences and appearance values as JSON.
- Import Settings: opens the file picker, validates supported Agent Society settings fields, normalizes option values, and clamps timeout/retry numbers before importing them. Malformed or unrelated JSON is rejected with an error toast.

## Storage Keys

- `agent-society-settings-options`: mission preferences, appearance options, timeout, and retry count.
- `agent-society-qwen-connection-test`: last connection test result for the active runtime fingerprint.
- `agent-society-runtime-settings`: Qwen credentials and existing runtime flags.
