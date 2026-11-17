---
name: sourced-research
description: Run web and docs research that stays traceable to sources - plan angles, fetch primary sources, label claims by support, and audit before relying on them. Use when learning a new library or technology, comparing options, checking versions or migrations, or any fact you should not answer from memory.
---

# Sourced Research

Research is only useful if a later reader can check it. This skill covers both
ways to do it: doing the research directly, and delegating it so the raw
fetching stays out of your context.

## 1. Decide the mode

- **Direct** when the answer needs 1-3 sources, you already know the
  authoritative sites, or you need the material in your own context to keep
  reasoning about it.
- **Delegated** when the topic is broad, needs several independent angles, is
  for a durable artifact, or would flood your context with pages you will not
  reuse. Launch `researcher`, then `evidence-auditor` on anything that changes a
  decision.
- **Hybrid** when the question is partly local (`scout` for the repo) and partly
  external (`researcher` for the library). Run both, then reconcile: the repo
  tells you which version and how it is used; the sources tell you what that
  version actually does.

## 2. Scope before searching

Write down, in one or two lines each:

- the decision the answer must support
- the exact question, including version, platform, and date sensitivity
- what would count as a good answer, and what is out of scope
- 2-4 distinct angles to search. Typical angles: the direct answer, the
  authoritative source, practical experience or benchmarks, and recent changes.

If the question cannot be answered differently by any source, you do not need
research - you need to read the code.

## 3. Gather

- Prefer primary and official sources: the project's docs, repository, changelog,
  release notes, RFCs, specs, and the code itself. Then high-quality secondary
  sources. Only then Q&A posts and blogs, and only as discovery aids.
- Open the page. A search snippet is a pointer, not evidence.
- For library and API questions, check the official docs first; if a Context7 MCP
  tool is available (directly or through `execute`), use it for current API
  surface. Use source code when docs and code disagree.
- Capture, for every claim you may repeat: the URL you actually fetched, the
  quoted passage, and the version or date it applies to.
- Reject or downgrade: stale pages for fast-moving tools, marketing copy,
  content farms, AI-generated listicles, and anything that cites another summary
  instead of the original.
- Note disagreements immediately. Do not average two conflicting sources into a
  confident answer.

## 4. Label every claim

Use exactly one of these on each decision-relevant claim:

| Label                     | Meaning                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| **Direct evidence**       | The fetched source states it. Quote if short.                            |
| **Source interpretation** | A reasonable reading of what the source says, but not its literal words. |
| **Inference**             | Your own reasoning, or a combination across sources.                     |
| **Unverified**            | Believed but not confirmed. Never present as settled.                    |

Attach **confidence: high | medium | low** and the reason for anything below
high.

## 5. Brief shape

```markdown
# Research: <topic>

## Summary

2-3 sentence direct answer.

## Findings

1. **Claim:** ... **Sources:** [Title](url). **Support:** direct evidence | interpretation. **Confidence:** high | medium | low.

## Contradictions

Disagreements with sources, or "None found".

## Missing evidence

Unverified claims and the check that would settle each.

## Sources

- Kept: Title (url) - why it matters
- Rejected: Title - short reason

## Next steps

Only the follow-up that would change the answer.
```

## 6. Audit before you act

Run an independent audit when a claim is surprising, disputed, decision-critical,
security- or money-related, or about to go into a plan, ADR, or PR. Skip it for
trivia and for claims you can verify directly in the repo.

Do not audit your own brief by re-reading it. Either launch `evidence-auditor`
with the brief verbatim, or re-fetch each cited source and check the passage as
if someone else wrote it. See the `evidence-audit` skill for the rubric.

## 7. Delegating

Call the `subagent` tool directly - not through `execute`.

```text
subagent({
  agent: "researcher",
  description: "Research <topic>",
  prompt: "<the brief described below>"
})
```

Give the child a complete brief. It starts with fresh context and cannot see
this conversation:

- the question, with version/platform/date constraints
- the decision it supports, and what counts as answered
- the angles to cover
- known local facts: exact versions from the repo, current implementation paths
- source preferences and exclusions
- the output shape from section 5
- when to stop: a follow-up only for a gap that changes the answer

For a broad question, launch two or three researchers in parallel with
_different_ angles (official docs and API surface; recent changes and migration
notes; independent experience and benchmarks), then reconcile. Do not launch
several researchers with the same prompt.

Then audit:

```text
subagent({
  agent: "evidence-auditor",
  description: "Audit <topic> claims",
  prompt: "<the brief verbatim> + <the claims the decision depends on> + <what the decision is>"
})
```

Only escalate the audit to more sources if it reports `contradicted` or
`missing evidence` on a claim that changes the answer. Otherwise report the
remaining uncertainty and stop.

## 8. Report honestly

- Separate what the sources say from what you concluded.
- Name the version and date the evidence applies to.
- If two credible sources disagree, present both and say what would settle it.
- If you ran out of budget, say which angles are uncovered rather than implying
  the picture is complete.
