# Agent Society

Frontend-only AI Mission Control demo for multi-agent planning, disagreement resolution, and mission report synthesis.

## Environment Safety

This project runs Qwen calls directly from the browser when `NEXT_PUBLIC_QWEN_API_KEY` is set. Because it is frontend-only, any key you use is exposed to the client bundle/runtime. Use hackathon, test, or restricted keys only.

Never commit `.env.local` or real API keys. Copy `.env.example` to `.env.local` for local testing.
