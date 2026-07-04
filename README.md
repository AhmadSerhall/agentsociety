# Agent Society

Frontend-only AI Mission Control demo for multi-agent planning, disagreement resolution, and mission report synthesis.

## Bring Your Own Qwen API Key

Agent Society is open source and does not include a shared Qwen API key. Anyone who clones or downloads the repo must provide their own key before missions can run.

1. Clone the repo.
2. Create or log in to a Qwen/DashScope account.
3. Generate an API key from the Qwen/DashScope console.
4. Run the app and paste the key in Settings, or copy `.env.example` to `.env.local` for local development.
5. Start the app and launch missions after the key is saved or available locally.

For local env-based testing:

```bash
cp .env.example .env.local
```

Then set:

```bash
VITE_QWEN_API_KEY=your_key_here
VITE_QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
VITE_QWEN_MODEL=qwen-turbo
```

Browser-saved keys override the local env key. Clearing the browser key falls back to the env key when one exists.

## Environment Safety

This project runs Qwen calls directly from the browser. Because it is frontend-only, any key you use is available to the client runtime. Use restricted local development, hackathon, or test keys only.

Never commit `.env.local` or real API keys. `.env`, `.env.local`, and `.env.*.local` are ignored for safety.
