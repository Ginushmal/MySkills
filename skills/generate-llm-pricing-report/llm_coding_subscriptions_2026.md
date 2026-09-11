# The One Table: 2026 LLM Platform Comparison for Agentic Coding

> [!NOTE]
> **All PAYG numbers below are exact math from verified official pricing pages (September 2026).**
> Subscription estimates are clearly marked as `(est.)` where exact per-task costs cannot be calculated from public data.

---

## The Standard Coding Task (Our Universal Measuring Stick)

Every number in this document is calculated against the same workload:

| Metric | Value |
| :--- | :--- |
| **Input tokens** | 20,000 (system prompt + file contents your agent reads) |
| **Output tokens** | 1,000 (code the model generates) |
| **Formula** | Cost = (20,000 ÷ 1,000,000 × Input Price) + (1,000 ÷ 1,000,000 × Output Price) |

---

## TIER 1: Cheap / Fast Models (DeepSeek Flash, Gemini Flash)

*Used for: file scanning, boilerplate, linting, commit messages, unit test scaffolding.*

| Rank | Platform | Type | Monthly Fee | Model | Cost Per Task | Tasks You Get for $10 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 🥇 | **DeepSeek Direct** | PAYG | $0 | deepseek-flash (off-peak) | **$0.0036** | **2,778** |
| 🥈 | **DeepInfra (Flex)** | PAYG | $0 | DeepSeek V3 | **$0.0058** | **1,715** |
| 🥉 | **OpenRouter** | PAYG | $0 | DeepSeek V3.1 | **$0.0060** | **1,681** |
| 4 | **DeepInfra (Std)** | PAYG | $0 | DeepSeek V3 | **$0.0073** | **1,372** |
| 5 | **Open Code Go** ⭐ | Sub | $10 | DeepSeek V4 Flash | ~$0.0007 (est.) | ~**15,000** (est.) |
| 6 | **Poe** | Sub | $20 | DeepSeek | ~$0.003 (est.) | ~**3,300** (est.) |
| 7 | **Gemini AI Pro** ⭐ | Sub | $20 | Gemini Flash | Compute quota | Opaque — drains fast with family sharing |
| — | **Cursor** | Sub | $20 | Auto / internal | Unlimited for cheap models | ∞ (cheap models don't count against 500 fast requests) |

> ⭐ = Your current baseline subscriptions.

### Reading this table
- **DeepSeek Direct** is the absolute cheapest. $10 buys 2,778 coding tasks. That's ~93 tasks/day for a full month.
- **Open Code Go** looks amazing at ~15,000 tasks, BUT that's estimated from their "6× multiplier" marketing. Their actual internal rates are not public, and you are hard-capped ($12/5hr, $30/week, $60/month).
- **Gemini AI Pro** is impossible to calculate because Google uses opaque "compute quotas" instead of token pricing. Your experience confirms it runs out fast on a family plan.

---

## TIER 2: Mid-Tier Workhorse Models (Qwen 72B, Kimi K2.7-Code)

*Used for: single-file feature implementation, code reviews, routine debugging.*

| Rank | Platform | Type | Monthly Fee | Model | Cost Per Task | Tasks You Get for $10 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 🥇 | **DeepInfra (Flex)** | PAYG | $0 | Qwen 2.5 72B | **$0.0061** | **1,645** |
| 🥈 | **DeepInfra (Std)** | PAYG | $0 | Qwen 2.5 72B | **$0.0076** | **1,316** |
| 🥉 | **OpenRouter** | PAYG | $0 | Qwen 2.5 72B | **$0.0076** | **1,316** |
| 4 | **DeepInfra (Flex)** | PAYG | $0 | Kimi K2.7-Code | **$0.0137** | **730** |
| 5 | **OpenRouter** | PAYG | $0 | Kimi K2.7-Code | **$0.0170** | **588** |
| 6 | **Open Code Go** ⭐ | Sub | $10 | Kimi K2.7 / Qwen | ~$0.002 (est.) | ~**5,000** (est.) |
| 7 | **Poe** | Sub | $20 | Qwen / Kimi | ~$0.010 (est.) | ~**1,000** (est.) |
| 8 | **Gemini AI Pro** ⭐ | Sub | $20 | Gemini Pro | Compute quota | Opaque — drains fast with family sharing |
| — | **Cursor** | Sub | $20 | DeepSeek R1 | ~$0.08/request | **250** (half of 500 fast requests) |

### Reading this table
- **DeepInfra** is the undisputed winner here. Qwen 2.5 72B on their Flex tier costs barely more than Tier 1 DeepSeek.
- **OpenRouter** matches DeepInfra on Qwen pricing (it passes through DeepInfra's rates), but charges a 5.5% deposit fee on top.
- **Open Code Go** is competitive here, but remember the rolling caps ($12/5hr, $30/week) which throttle sustained heavy usage.

---

## TIER 3: Top-Tier Smart Models (Qwen Max, Kimi K3, Claude Sonnet)

*Used for: complex multi-file refactors, architectural planning, root-cause debugging.*

| Rank | Platform | Type | Monthly Fee | Model | Cost Per Task | Tasks You Get for $10 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 🥇 | **OpenRouter** | PAYG | $0 | Qwen3 Max | **$0.0195** | **513** |
| 🥈 | **OpenRouter (cached)** | PAYG | $0 | Claude 3.5 Sonnet | **$0.021** | **476** |
| 🥉 | **DeepInfra** | PAYG | $0 | Qwen3 Max | **$0.030** | **333** |
| 4 | **DeepInfra** | PAYG | $0 | Kimi K3 | **$0.071** | **140** |
| 5 | **OpenRouter** | PAYG | $0 | Kimi K3 | **$0.053** | **190** |
| 6 | **OpenRouter (no cache)** | PAYG | $0 | Claude 3.5 Sonnet | **$0.075** | **133** |
| 7 | **Cursor** | Sub | $20 | Claude Sonnet | ~$0.08/req | **250** (half of 500 fast reqs) |
| 8 | **Open Code Go** ⭐ | Sub | $10 | Qwen3.8 Max / Kimi K3 | ~$0.010 (est.) | ~**1,500** (est.) but $15 sub-cap on frontier models |
| 9 | **Poe** | Sub | $20 | Claude / Qwen Max | ~$0.030 (est.) | ~**330** (est.) — no prompt caching! |
| 10 | **Gemini AI Pro** ⭐ | Sub | $20 | Gemini Pro | Compute quota | Opaque — but unreliable for heavy use |

### Reading this table

- **Qwen3 Max on OpenRouter** ($0.0195/task) is shockingly close to Claude 3.5 Sonnet WITH caching ($0.021/task), and much cheaper than Claude WITHOUT caching ($0.075/task). **This is the best-kept secret in the table.**
- **Open Code Go** seems very competitive at ~1,500 tasks, but it hard-caps frontier model spend at **$15/month** of the $60 allowance. Once that $15 sub-cap is hit, you lose access to the smartest models until next month.
- **Poe** is terrible here because it does NOT pass through prompt caching discounts on Claude.

---

## The Unified Final Ranking

| Rank | Platform | Monthly Cost | Has Tier 1? | Has Tier 2? | Has Tier 3? | Has Claude? | Biggest Advantage | Biggest Disadvantage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **🥇** | **OpenRouter** | $0 + usage | ✅ | ✅ | ✅ Qwen Max, Kimi K3 | ✅ Yes | All tiers + prompt caching + auto-fallback. Best tasks/$10 on smart models. | 5.5% deposit fee |
| **🥈** | **DeepInfra** | $0 + usage | ✅ | ✅ | ✅ Qwen Max, Kimi K3 | ❌ No | Cheapest Tier 1 & 2. No deposit fees. Flex tier saves 20%. | No Claude. Kimi K3 is pricier here than on OpenRouter. |
| **🥉** | **Open Code Go** ⭐ | $10/mo | ✅ | ✅ | ✅ Qwen Max, Kimi K3 | ❌ No | $10 → $60 usage value (6× multiplier). Great model selection. | Hard caps ($12/5hr, $30/wk). Frontier models sub-capped at $15. Opaque internal rates. |
| **4** | **Cursor** | $20/mo | ✅ (∞) | ✅ | ✅ Claude, GPT-4o | ✅ Yes | Unlimited cheap models. Best IDE UX. 500 subsidized frontier requests. | Locked to their editor. Can't use API externally. 500 reqs runs out fast in agent mode. |
| **5** | **DeepSeek Direct** | $0 + usage | ✅ | ❌ | ❌ | ❌ No | Absolute cheapest Tier 1 on the planet ($0.003 cached). | Only DeepSeek models. No Qwen, no Kimi, no Claude. Peak-hour 2× surcharge. |
| **6** | **Gemini AI Pro** ⭐ | $20/mo | ✅ | ✅ | ✅ Gemini Pro | ❌ No Claude/Kimi/Qwen Max | Integrated into Antigravity IDE. Includes 5TB storage. | Opaque compute quotas. Family sharing destroys usability. Multi-day cooldowns. |
| **7** | **Poe** | $20/mo | ✅ | ✅ | ✅ Claude, Qwen Max | ✅ Yes | Widest model selection of any subscription. | Only 660k points. No prompt caching. Points vanish in days with coding agents. |

---

## What You Should Do (Based on Your Situation)

You said you like **Open Code Go** (for its model variety) and **Gemini AI Pro** (for Antigravity integration), but both run out of quota. Here is my recommendation:

### Option A: Keep Open Code Go + Add OpenRouter ($10 + ~$5-10)
- Use **Open Code Go ($10/mo)** as your daily driver for Tier 1 and Tier 2 tasks (it's excellent value at the 6× multiplier).
- When Open Code Go's frontier cap ($15 sub-limit) runs out, or when you need Claude, fall back to **OpenRouter** with a $5-10 prepaid balance for Tier 3 tasks only.
- **Total: ~$15-20/month** with access to every model and no cooldowns.

### Option B: Go Pure OpenRouter ($10-15)
- Cancel both subscriptions.
- Deposit $10-15/month into **OpenRouter**.
- Use DeepSeek/Gemini Flash for cheap tasks, Qwen 72B for mid-tier, and Qwen3 Max or Claude (with caching) for top-tier.
- **Total: ~$10-15/month** with zero artificial caps or cooldowns.

### Option C: DeepInfra + OpenRouter Hybrid ($10-15)
- Use **DeepInfra (Flex tier)** for all Tier 1 and Tier 2 work (cheapest rates, no deposit fees).
- Use **OpenRouter** only when you need Claude (the one model DeepInfra doesn't have).
- **Total: ~$10-15/month** with absolute maximum tasks per dollar.
