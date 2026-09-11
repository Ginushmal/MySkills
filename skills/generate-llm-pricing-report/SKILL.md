---
name: generate-llm-pricing-report
description: >-
  Use this skill to research, validate, and generate a highly structured, benchmarked LLM API pricing comparison report. Trigger this when the user asks for the latest LLM subscription prices, API costs, or an updated tiered matrix of model providers.
---

# Generate LLM Pricing Report

When asked to update or generate the LLM pricing comparison report, follow this exact procedure to ensure 100% accuracy based on a standardized benchmark.

## Step 1: Deploy Validation Sub-Agents

Do NOT rely on your internal memory for prices, as they change rapidly. You must deploy sub-agents using `invoke_subagent` (model: `flash`) to gather live, exact pricing data from the official websites.

Deploy 4 agents with these exact instructions:
1. **Agent 1 (OpenRouter Validator):** "Visit https://openrouter.ai/models. Find exact per-1M-token input and output prices for: Gemini Flash, DeepSeek V3/R1, Qwen 2.5 72B, Qwen Max, Claude 3.5 Sonnet, and Kimi K3. Note prompt caching discounts."
2. **Agent 2 (DeepInfra Validator):** "Visit https://deepinfra.com/pricing. Find exact per-1M-token input and output prices for: DeepSeek V3, Qwen 2.5 72B, Qwen Max, Kimi models. Note standard vs flex tier pricing."
3. **Agent 3 (Subscriptions Validator):** "Visit opencode.ai/go, poe.com, and cursor.com/pricing. What is the exact monthly cost? What are the hard caps/limits? (e.g. Open Code Go $60 usage value multiplier, Cursor 500 fast requests, Poe 660,000 points)."
4. **Agent 4 (Direct APIs Validator):** "Visit api.deepseek.com and docs.anthropic.com. Get exact 1M-token input/output prices for deepseek-flash (peak vs off-peak and cache hit) and Claude 3.5 Sonnet (cache write vs cache read)."

Wait for all 4 agents to return before proceeding.

## Step 2: The Standardized Benchmark Math

Once you have the raw prices, you MUST calculate the cost using this exact standardized "Standard Coding Task" metric:
- **Input Tokens:** 20,000
- **Output Tokens:** 1,000
- **Formula:** `Cost = (20,000 / 1,000,000 * Input Price) + (1,000 / 1,000,000 * Output Price)`
- **Tasks per $10:** `10 / Cost`

## Step 3: Generate the Final Report

Use `write_to_file` to create a markdown artifact named `llm_pricing_update_<YYYY-MM>.md`.

The report must follow this exact structure:

1. **Header & Context:** Explain the Standard Coding Task metric (20k in, 1k out).
2. **Tier 1 (Cheap/Fast):** A table comparing DeepSeek Direct, DeepInfra, OpenRouter, Open Code Go, Poe, Gemini AI Pro based on Tasks per $10.
3. **Tier 2 (Mid-Tier):** A table comparing DeepInfra (Qwen 72B), OpenRouter, etc. based on Tasks per $10.
4. **Tier 3 (Top-Tier):** A table comparing OpenRouter (Claude cached, Qwen Max), DeepInfra (Qwen Max), Cursor, Poe.
5. **The Unified Final Ranking:** A master table comparing Monthly Cost, Tier Access, and the biggest pros/cons.

**Crucial Rules for the Output:**
- Separate Open Code Go and Gemini AI Pro with a ⭐ to note they are user baselines.
- Explicitly highlight if Poe passes through prompt caching (it doesn't) and if DeepInfra has Claude (it doesn't).
- Always recommend a Tiered API Architecture (OpenRouter or DeepInfra) over flat consumer subscriptions for heavy agentic coding loops.
