# Mission Engine Manual Regression Cases

Use these prompts after Mission Engine changes.

## Mission A - Business Launch

Prompt:

```txt
Create a launch strategy for a Lebanese AI SaaS startup targeting schools.
```

Expected:

- Classification: `business_launch`
- Agents include Research, Product Strategist, Marketing Strategist, Finance Agent, Risk Critic, Mediator if conflicts exist, Finalizer.
- Workstreams mention market/customer validation, offer/positioning, go-to-market, budget/resources, and launch risk.
- Timeline and final report use launch/business language.
- Network includes business/launch agents, not only technical agents.

## Mission B - Technical Debugging

Prompt:

```txt
Analyze why my React app is slow and propose an optimization plan.
```

Expected:

- Classification: `technical_debugging`
- Workstreams include performance profiling, render/re-render analysis, network/API/data-fetching audit, bundle/asset optimization, architecture/state review, roadmap/testing/monitoring.
- Product/marketing/finance workstreams are not created unless the prompt explicitly asks for product, marketing, customers, sales, budget, or pricing.
- Conflicts mention quick fixes vs deeper architecture correction and possibly frontend vs API latency investigation.
- Final report uses technical optimization recommendations.
- Network centers around Planner, Technical Architect, Risk Critic, Mediator when needed, and Finalizer.

## Mission C - Architecture Decision

Prompt:

```txt
Help me decide whether to rebuild my app in Next.js or keep React SPA.
```

Expected:

- Classification: `product_strategy`
- Workstreams include current SPA baseline, Next.js migration benefit analysis, product/user impact, cost/risk/delivery tradeoff, and decision roadmap.
- Conflict resolution addresses rebuild complexity vs incremental improvement.
- Final report gives a decision framework, not a launch plan.

## General Acceptance

- No visible `**` artifacts.
- No empty bullets.
- No `Unassigned owner` when a responsible agent exists.
- No generic fallback workstreams in successful planner parses.
- Efficiency metrics change based on completed workstreams, participating agents, confidence, and conflicts.
- Network nodes and edges reflect participating agents and dependencies.
