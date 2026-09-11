---
name: generate-llm-pricing-report
description: >-
  Use this skill to research, validate, and generate a highly structured, benchmarked LLM API pricing comparison report. Trigger this when the user asks for the latest LLM subscription prices, API costs, or an updated tiered matrix of model providers.
---

# Generate LLM Pricing Report

When asked to update or generate the LLM pricing comparison report, follow this exact multi-stage procedure to ensure the report reflects current community consensus and 100% accurate live pricing.

## Phase 1: Discovery & Scouting (Community Consensus)

First, discover what the developer community currently considers the best options. Deploy a swarm of `flash` sub-agents using `invoke_subagent` to scout the internet.

1. **Agent 1 (Reddit & Quora Researcher):** "Search Reddit (r/LocalLLaMA, r/ChatGPTCoding, etc.) and Quora for recent discussions about the best LLM API aggregators and subscriptions for agentic coding. Look for platforms that support 3 tiers (cheap, mid-tier, top-tier). What are the community favorites and their pros/cons?"
2. **Agent 2 (Hacker News & Dev Blogs Researcher):** "Search Hacker News, Dev.to, and developer blogs for recent articles comparing LLM API providers (aggregators vs subscriptions) for agentic coding. Summarize the prevailing opinions on price-to-value ratio and developer experience."
3. **Agent 3 (General Web & YouTube Researcher):** "Search the general web and YouTube summaries for reviews on the 'best LLM subscription or pay-as-you-go API for coding'. Note their relative performance, quotas, and hidden costs."

Wait for all Phase 1 agents to return. Based on their findings, identify the top ~6 platforms (including top aggregators, direct APIs, and popular IDE/subscriptions).

## Phase 2: Live Price Validation

Do NOT rely on your internal memory for prices. You must deploy a second swarm of `flash` sub-agents to gather live, exact pricing data from the official websites of the platforms identified in Phase 1 (always including the user's baselines: Open Code Go and Gemini AI Pro).

Deploy the following types of agents:
1. **Aggregator Validators (e.g., OpenRouter, DeepInfra):** Find exact per-1M-token input/output prices for a Cheap model (e.g., DeepSeek/Gemini Flash), a Mid-Tier model (e.g., Qwen 72B), and a Top-Tier model (e.g., Claude 3.5 Sonnet, Qwen Max, Kimi K3). Note any deposit fees or prompt caching discounts.
2. **Subscription Validators (e.g., Cursor, Poe, Open Code Go, Gemini AI Pro):** Find the exact monthly cost, hard caps/limits (e.g. usage value multipliers, fast request counts, compute points, compute quotas), and available models.
3. **Direct API Validators (e.g., Anthropic, DeepSeek):** Find exact 1M-token input/output prices, peak vs off-peak rates, and exact prompt caching (read/write) rates.

Wait for all Phase 2 agents to return before proceeding.

## Phase 3: The Standardized Benchmark Math

Once you have the raw prices, you MUST calculate the cost using this exact standardized "Standard Coding Task" metric so platforms can be compared equally:
- **Input Tokens:** 20,000 (System prompt + codebase read)
- **Output Tokens:** 1,000 (Code generated)
- **Formula:** `Cost = (20,000 / 1,000,000 * Input Price) + (1,000 / 1,000,000 * Output Price)`
- **Tasks per $10:** `10 / Cost`

## Phase 4: Generate the Final Report

Use `write_to_file` to create a markdown artifact named `llm_pricing_update_<YYYY-MM>.md`.

The report must follow this exact structure:

1. **Header & Context:** Explain the Standard Coding Task metric (20k in, 1k out).
2. **Tier 1 (Cheap/Fast):** A table comparing the top budget options based on Tasks per $10.
3. **Tier 2 (Mid-Tier):** A table comparing mid-tier reasoning models based on Tasks per $10.
4. **Tier 3 (Top-Tier):** A table comparing frontier models (Claude, Qwen Max, Kimi) based on Tasks per $10, highlighting prompt caching impact.
5. **The Unified Final Ranking:** A master table comparing Monthly Cost, Tier Access, and the biggest pros/cons.

**Crucial Rules for the Output:**
- Separate the user's baseline subscriptions (Open Code Go and Gemini AI Pro) with a ⭐ to note they are baselines.
- Explicitly highlight if a platform passes through prompt caching (e.g., OpenRouter) or if it doesn't (e.g., Poe).
- Clearly expose marketing gimmicks (like "$10 gives $60 usage value" or "compute points") by reducing them to the "Tasks per $10" metric.
