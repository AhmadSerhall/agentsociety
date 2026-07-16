/**
 * Agent Council — Alibaba Cloud / Qwen Cloud Integration
 *
 * This browser-side client connects Agent Council to Alibaba Cloud's
 * Qwen/DashScope OpenAI-compatible Chat Completions API.
 *
 * Default endpoint:
 * https://dashscope-intl.aliyuncs.com/compatible-mode/v1
 *
 * Default model:
 * qwen-turbo
 *
 * The API key is provided by the user through Settings or local environment
 * configuration. This file is the main proof of Alibaba Cloud API usage for
 * the hackathon submission.
 */

import type {
  QwenChatRequest,
  QwenChatResponse,
  QwenMessage,
  ApiError,
} from "@/types";
import { DEFAULT_QWEN_BASE_URL, DEFAULT_QWEN_MODEL, getResolvedQwenSettings } from "@/lib/qwenConfig";
import { getSavedSettingsOptions } from "@/lib/settingsPreferences";

export interface QwenClientConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

export interface QwenRuntimeInfo {
  provider: "Qwen" | "Mock";
  hasApiKey: boolean;
  hasUsableApiKey: boolean;
  keySource: "saved" | "env" | "none";
  maskedApiKey: string;
  model: string;
  baseUrl: string;
  baseHost: string;
  isLocalBaseUrl: boolean;
}

export class QwenApiError extends Error {
  code: string;
  details?: unknown;
  constructor(e: ApiError) {
    super(e.message);
    this.name = "QwenApiError";
    this.code = e.code;
    this.details = e.details;
  }
}

function getClientConfig(): QwenClientConfig {
  const resolved = getResolvedQwenSettings();
  return {
    baseUrl: resolved.qwenBaseUrl || DEFAULT_QWEN_BASE_URL,
    apiKey: resolved.qwenApiKey || "",
    defaultModel: resolved.qwenModel || DEFAULT_QWEN_MODEL,
    defaultTemperature: 0.7,
    defaultMaxTokens: 4096,
  };
}

function getHost(baseUrl: string) {
  try {
    return new URL(baseUrl).host;
  } catch {
    return "invalid-url";
  }
}

function isLocalHost(host: string) {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
}

export function getQwenRuntimeInfo(): QwenRuntimeInfo {
  const cfg = getClientConfig();
  const baseHost = getHost(cfg.baseUrl);
  const isLocalBaseUrl = isLocalHost(baseHost) || baseHost === "invalid-url";
  const hasApiKey = Boolean(cfg.apiKey.trim());
  const hasUsableApiKey = hasApiKey && !isLocalBaseUrl;
  return {
    provider: hasUsableApiKey ? "Qwen" : "Mock",
    hasApiKey,
    hasUsableApiKey,
    keySource: cfg.apiKey ? getResolvedQwenSettings().source : "none",
    maskedApiKey: getResolvedQwenSettings().maskedApiKey,
    model: cfg.defaultModel,
    baseUrl: cfg.baseUrl,
    baseHost,
    isLocalBaseUrl,
  };
}

export function isMockMode(): boolean {
  return getQwenRuntimeInfo().provider === "Mock";
}

function chatCompletionsUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function sanitizeMessages(messages: QwenMessage[]): QwenMessage[] {
  return messages
    .filter((message) => message.role === "system" || message.role === "user" || message.role === "assistant")
    .map((message) => ({ role: message.role, content: message.content }));
}

async function readStreamedCompletion(res: Response) {
  const text = await res.text();
  let content = "";
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.replace(/^data:\s*/, "");
    if (!data || data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }> };
      content += parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? "";
    } catch {
      // Ignore non-JSON stream keepalive lines.
    }
  }
  return content.trim();
}

export function createQwenClient(config?: Partial<QwenClientConfig>) {
  const cfg = { ...getClientConfig(), ...config };

  async function chat(
    messages: QwenMessage[],
    overrides?: { model?: string; temperature?: number; maxTokens?: number; signal?: AbortSignal }
  ): Promise<string> {
    if (typeof window !== "undefined" && (window as unknown as { __AGENT_SOCIETY_REPLAY_ACTIVE__?: boolean }).__AGENT_SOCIETY_REPLAY_ACTIVE__) {
      console.warn("[Agent Council Replay] Blocked Qwen chat call during replay mode.");
      throw new QwenApiError({ code: "REPLAY_BLOCKED", message: "Replay mode never calls Qwen or any LLM." });
    }

    const settings = getSavedSettingsOptions();
    const body: QwenChatRequest = {
      model: overrides?.model ?? cfg.defaultModel,
      messages: sanitizeMessages(messages),
      temperature: overrides?.temperature ?? cfg.defaultTemperature,
      max_tokens: overrides?.maxTokens ?? cfg.defaultMaxTokens,
      stream: settings.preferences.streamResponses,
    };

    const attempts = settings.preferences.retryFailedRequests ? Math.max(1, settings.retryCount + 1) : 1;
    let res: Response | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (settings.preferences.verboseLogs) {
        console.info(`[Agent Council] Qwen request attempt ${attempt + 1}/${attempts}`, {
          model: body.model,
          stream: body.stream,
          timeoutSeconds: settings.missionTimeout,
        });
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.max(1, settings.missionTimeout) * 1000);
      const abortFromOuter = () => controller.abort();
      overrides?.signal?.addEventListener("abort", abortFromOuter, { once: true });
      try {
        res = await fetch(chatCompletionsUrl(cfg.baseUrl), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (settings.preferences.verboseLogs) {
          console.info("[Agent Council] Qwen response status", { status: res.status, ok: res.ok });
        }
        if (res.ok || attempt === attempts - 1) break;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        lastError = error;
        if (attempt === attempts - 1) throw error;
      } finally {
        clearTimeout(timeout);
        overrides?.signal?.removeEventListener("abort", abortFromOuter);
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }

    if (!res) throw lastError instanceof Error ? lastError : new QwenApiError({ code: "NETWORK", message: "Qwen request failed before receiving a response." });

    if (!res.ok) {
      const err: ApiError = await res.json().catch(() => ({
        code: "UNKNOWN",
        message: res.statusText,
      }));
      throw new QwenApiError(err);
    }

    if (body.stream) {
      const streamed = await readStreamedCompletion(res);
      if (streamed) return streamed;
      throw new QwenApiError({ code: "EMPTY", message: "No streamed completion content returned." });
    }

    const data: QwenChatResponse = await res.json();
    if (!data.choices?.length) {
      throw new QwenApiError({ code: "EMPTY", message: "No completion choices returned." });
    }
    return data.choices[0].message.content;
  }

  return { chat };
}

/** Mock client that returns plausible responses based on system prompt. */
export function createMockClient() {
  async function chat(messages: QwenMessage[]): Promise<string> {
    const systemMsg = messages.find((m) => m.role === "system");
    const role = systemMsg?.content.slice(0, 60) ?? "Unknown";

    // Simulate network delay
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));

    const mockResponses: Record<string, string> = {
      Planner: `Based on the mission brief, I've identified 4 key workstreams:\n\n**Workstream 1: Market Research & Validation**\n- Analyze target market size and growth trends\n- Identify top 5 competitors and their positioning\n- Validate core assumptions with 10+ customer interviews\n- Deliverable: Market Validation Report\n\n**Workstream 2: Product Definition & MVP**\n- Define core user personas (3 primary)\n- Prioritize features using MoSCoW framework\n- Create MVP feature specification\n- Deliverable: Product Requirements Document\n\n**Workstream 3: Technical Architecture & Build Plan**\n- Evaluate technology options against requirements\n- Design system architecture with scalability targets\n- Create sprint-level implementation plan\n- Deliverable: Technical Architecture Document\n\n**Workstream 4: Go-to-Market & Launch**\n- Define pricing strategy and revenue model\n- Plan launch channels and content calendar\n- Set up analytics and success metrics dashboard\n- Deliverable: GTM Launch Playbook`,
      Research: `## Research Summary\n\n### Market Context\n- Total addressable market estimated at $4.2B globally, growing at 18% CAGR\n- Primary segment (SMB restaurants) represents ~$800M with 65% digital readiness\n- Key trend: 72% of restaurants now prefer integrated platforms over point solutions\n\n### Competitive Landscape\n- **Competitor A**: Market leader, strong in POS but weak in AI features (pricing: $299/mo)\n- **Competitor B**: AI-first approach, limited restaurant-specific features (pricing: $199/mo)\n- **Competitor C**: Comprehensive suite, high pricing barrier for SMBs (pricing: $499/mo)\n\n### Key Assumptions\n1. Target customers have basic digital literacy and existing internet connectivity\n2. Average willingness to pay is $150-250/month for an AI-powered platform\n3. 30-day launch timeline is aggressive but feasible with MVP-only scope\n4. Regulatory compliance (data privacy) is manageable with standard practices`,
      Product: `## Product Strategy\n\n### Vision\nAn AI-powered operations platform that reduces restaurant administrative overhead by 60% within the first 90 days of adoption.\n\n### Target Users\n1. **Restaurant Owner/Operator** (primary): Needs inventory, staff scheduling, and cost insights\n2. **Kitchen Manager**: Needs recipe management, waste tracking, and prep coordination\n3. **Front-of-House Manager**: Needs reservation optimization, table management, and customer feedback\n\n### MVP Scope (Phase 1)\n- AI-powered inventory management with demand forecasting\n- Automated staff scheduling based on demand patterns\n- Daily cost/revenue dashboard with AI insights\n- Basic integration with existing POS systems\n\n### Phase 2 Features\n- Customer sentiment analysis from reviews\n- Dynamic pricing recommendations\n- Supplier negotiation assistant\n\n### Success Metrics\n- 50 restaurant sign-ups in first 30 days\n- 40% reduction in food waste (measured at 60 days)\n- 25% reduction in scheduling conflicts`,
      Technical: `## Technical Architecture\n\n### Recommended Stack\n- **Frontend**: Next.js 16 (App Router) + TypeScript + TailwindCSS + shadcn/ui\n- **Backend**: Next.js API Routes (serverless) for MVP, migrate to dedicated services at scale\n- **Database**: PostgreSQL via Supabase (managed) for relational data\n- **AI/ML**: Qwen Cloud API for natural language features, custom fine-tuning pipeline\n- **Infrastructure**: Vercel for hosting, Cloudflare for CDN and edge functions\n- **Monitoring**: Sentry for errors, Mixpanel for analytics\n\n### System Architecture\n\`\`\`\n[Client App] → [API Gateway] → [Auth Service]\n                         → [Core Service] → [PostgreSQL]\n                         → [AI Service] → [Qwen API]\n                         → [Notification Service]\n\`\`\`\n\n### Implementation Phases\n- **Sprint 1-2**: Auth, data models, basic CRUD\n- **Sprint 3-4**: AI inventory forecasting integration\n- **Sprint 5-6**: Scheduling engine, dashboard\n- **Sprint 7-8**: POS integration, testing, polish\n\n### Technical Risks\n1. AI response latency (>3s) — mitigated by streaming and caching\n2. POS API fragmentation — mitigated by adapter pattern\n3. Data migration complexity — mitigated by CSV import tool`,
      Marketing: `## Go-to-Market Strategy\n\n### Positioning\n"AI-powered restaurant operations — automate the tedious, focus on the culinary."\n\n### Launch Channels\n1. **Direct Outreach**: Target 200 independent restaurants via personalized emails\n2. **Industry Partnerships**: Partner with 3 restaurant associations for co-marketing\n3. **Content Marketing**: Publish 12 SEO-optimized articles on restaurant tech trends\n4. **Social Proof**: Secure 5 beta testimonials before public launch\n\n### Content Calendar (30 Days)\n- Week 1-2: Teaser content — "The Future of Restaurant Ops" blog series\n- Week 3: Product demo video + beta waitlist opening\n- Week 4: Launch announcement + press release + influencer outreach\n\n### Growth Tactics\n- Freemium model: Free 14-day trial, then $149/mo\n- Referral program: 1 month free for each successful referral\n- Restaurant community engagement on Reddit, Facebook Groups\n\n### Budget Allocation\n- Content creation: 25% ($3,750)\n- Paid ads (Google + Meta): 40% ($6,000)\n- Partnerships & events: 20% ($3,000)\n- Tools & analytics: 15% ($2,250)`,
      Finance: `## Financial Plan\n\n### Startup Budget (First 90 Days)\n\n| Category | Monthly | 90-Day Total |\n|----------|---------|-------------|\n| Engineering (2 devs) | $16,000 | $48,000 |\n| AI API Costs | $800 | $2,400 |\n| Infrastructure (Vercel, DB) | $200 | $600 |\n| Marketing & GTM | $5,000 | $15,000 |\n| Legal & Compliance | $1,500 | $4,500 |\n| Tools & Licenses | $500 | $1,500 |\n| Contingency (10%) | $2,400 | $7,200 |\n| **TOTAL** | **$26,400** | **$79,200** |\n\n### Revenue Projections\n- Month 1: 10 paying customers × $149 = $1,490\n- Month 2: 30 paying customers × $149 = $4,470\n- Month 3: 60 paying customers × $149 = $8,940\n- **Quarter 1 Revenue**: $14,900\n\n### Runway\nWith $50K initial funding: ~2 months at full burn, extending to 4 months with MVP revenue.\nBreak-even target: 180 customers (~$26,820 MRR)`,
      Risk: `## Risk Assessment\n\n### Critical Risks\n\n**1. 30-day launch timeline is unrealistic**\n- Current plan allocates 8 sprints for a product that realistically needs 12+\n- Mitigation: Reduce MVP scope to core inventory + dashboard only\n\n**2. Single-agent AI dependency on Qwen API**\n- No fallback if Qwen API has downtime or rate limits\n- Mitigation: Implement response caching and graceful degradation\n\n**3. Underestimated customer acquisition cost**\n- $15,000 marketing budget assumes $50 CAC, but B2B SaaS averages $200-500\n- Mitigation: Focus on high-intent channels (restaurant associations, word-of-mouth)\n\n### Moderate Risks\n- **POS integration complexity** may delay launch by 2-4 weeks\n- **Data privacy compliance** requires legal review not yet budgeted\n- **Team size (2 devs)** is minimal for the proposed scope\n\n### Overall Assessment\nThe plan is ambitious and directionally sound, but the timeline and budget assumptions need recalibration. I recommend extending the launch to 60 days and increasing the initial budget to $100K.`,
      Mediator: `## Mediation Decision\n\n### Conflict 1: Timeline Disagreement\n- **Risk Critic position**: 30 days is unrealistic, recommends 60 days\n- **Planning team position**: 30 days is achievable with reduced MVP scope\n- **Decision**: Adopt a 45-day timeline. This preserves momentum while incorporating a 50% buffer for unexpected delays. Revised MVP scope includes inventory management and dashboard only — scheduling moves to Phase 2.\n\n### Conflict 2: Budget Concerns\n- **Risk Critic position**: Marketing budget assumptions are too optimistic\n- **Finance Agent position**: Budget is adequate with contingency\n- **Decision**: Increase marketing contingency from 10% to 20% and reallocate $2,000 from tools budget. This brings total to ~$82K with stronger safety margin.\n\n### Conflict 3: Team Capacity\n- **Risk Critic position**: 2 developers insufficient\n- **Technical Architect position**: Feasible with MVP scope reduction\n- **Decision**: Maintain 2 developers but plan for a 3rd hire at Month 2 using early revenue. Add a part-time contractor for POS integration.`,
      Finalizer: `## Mission Report: AI SaaS Platform for Restaurants\n\n### Executive Summary\nAgent Council has produced a comprehensive execution plan for launching an AI-powered restaurant operations SaaS platform within 45 days. The plan was developed through 8 specialized agent perspectives, with 3 key disagreements identified and resolved through mediation.\n\n### Mission Objective\nLaunch an AI-powered SaaS platform that reduces restaurant administrative overhead by 60%, targeting 60 paying customers within 90 days.\n\n### Workstreams\n1. Market Research & Validation (Research Agent)\n2. Product Definition & MVP (Product Strategist)\n3. Technical Architecture (Technical Architect)\n4. Go-to-Market Strategy (Marketing Strategist)\n5. Financial Planning (Finance Agent)\n6. Risk Assessment & Mitigation (Risk Critic)\n\n### Key Mediator Decisions\n- Timeline: Extended from 30 to 45 days with reduced MVP scope\n- Budget: Increased to ~$82K with stronger contingency\n- Team: Plan for 3rd developer hire at Month 2\n\n### Efficiency Metrics\n- Multi-agent coverage: 9 specialized perspectives\n- Conflicts resolved: 3 (timeline, budget, team capacity)\n- Estimated single-agent quality: 55% → Multi-agent: 87%\n- Confidence score: 8.2/10\n\n### Final Recommendation\nProceed with the 45-day launch plan. The multi-agent analysis has identified and resolved critical gaps that a single-agent approach would likely miss. Priority actions: secure $82K funding, begin market validation immediately, and start technical sprint 1 within 3 days.`,
    };

    // Find best matching mock response
    for (const [key, response] of Object.entries(mockResponses)) {
      if (role.includes(key)) return response;
    }
    return `[Mock Response] Processed by agent matching: "${role.slice(0, 40)}..."`;
  }

  return { chat };
}
