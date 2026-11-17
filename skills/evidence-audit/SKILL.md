---
name: evidence-audit
description: Independently verify important claims against the sources they cite, and label each supported, contradicted, unclear, or missing. Use before acting on research, when a claim is surprising or decision-critical, or when you need to know whether a brief can be trusted.
---

# Evidence Audit

An audit answers one question: **does the evidence actually support what is being
claimed?** It is not a second research pass, a summary, or a review of writing
quality.

## When it is worth it

Audit when a claim is:

- decision-critical: a plan, ADR, dependency choice, migration, or architecture
  depends on it
- surprising, or convenient for the conclusion
- disputed, or the only source is weak
- about security, money, licensing, performance, or compatibility
- going into something durable: a PR description, doc, ADR, or release note

Do not audit trivia, claims you can verify directly in the repo, or a brief you
are about to treat as exploratory only.

## Process

1. **Extract claims.** Turn the brief into atomic claims. One claim per row; no
   compound sentences.
2. **Triage.** Mark each claim decision-critical or not. Audit only the critical
   ones plus anything that looks overstated. State which claims you skipped.
3. **Re-fetch.** Open the cited source yourself. Never accept the citation,
   title, or snippet as proof. If a source cannot be reached, that claim is
   `missing evidence`, not `supported`.
4. **Compare.** Find the passage that supports or contradicts the claim. Quote
   it. Check the wording and the certainty: "can" is not "does", "may" is not
   "will", a benchmark is not a guarantee, and a v1 doc is not v2 behavior.
5. **Check scope.** Right product? Right version? Right platform? Right date?
   Official or secondary? A correct quote from the wrong version still
   contradicts the claim.
6. **Assign a status** (below) and a confidence.
7. **Judge the conclusion.** Say whether it holds, needs narrowing, or should
   change - and which specific claim drives that.

## Status rubric

| Status             | Use when                                                                        |
| ------------------ | ------------------------------------------------------------------------------- |
| `supported`        | The source states the claim, at the same scope and certainty.                   |
| `contradicted`     | The source says otherwise, or a stronger source does.                           |
| `unclear`          | The source is related but ambiguous, partial, or about another version/context. |
| `missing evidence` | No inspectable source, or the source cannot be fetched.                         |

Support, contradiction, and absence are different findings. Do not turn
`unclear` into `supported` because the claim is plausible.

## Source-quality signals

Downgrade a claim when its source is:

- **stale** for a fast-moving tool (check the version and date against the claim)
- **secondary**: a summary of a summary, an aggregator, or a repost
- **circular**: several pages citing the same unverified origin
- **motivated**: vendor marketing, a competitor comparison, an affiliate post
- **contextless**: no version, no date, no environment, no reproduction
- **anecdotal**: one person's experience presented as general behavior

Upgrade when the source is the official docs, the repository, a changelog, an
RFC, a spec, or a reproducible benchmark - and it matches the version in use.

## Output

```markdown
## Verified claims

- Claim - source - quoted passage - why it supports the claim

## Contradicted claims

- Claim - source - the passage or fact that contradicts it - correction

## Weak / unclear / unsupported claims

- Claim - what is wrong - what would settle it

## Material source-quality concerns

- Source - problem - effect on the conclusion

## Missing evidence

- Claim - what is absent - the check that would settle it

## Material contradictions

- Source A vs Source B - what differs - which is stronger and why

## Implications for the original conclusion

Holds / needs narrowing / should change, and the claim that drives it.
```

For each material claim include the status, the source, short reasoning, and
confidence. Label interpretation and inference explicitly.

If nothing material is wrong, say exactly: `No material issues found.` Then stop -
do not manufacture findings to look rigorous.

## Delegating

Call the `subagent` tool directly:

```text
subagent({
  agent: "evidence-auditor",
  description: "Audit <topic> claims",
  prompt: "<brief verbatim>\n\nThe decision: <...>\nClaims that matter: <...>\nAudit only these; report which you skipped."
})
```

Pass the brief unchanged. Do not pre-filter it to the claims you already believe,
and do not tell the child the conclusion you want.

## Common failures

- Auditing the summary instead of the claims.
- Checking that a URL exists instead of what it says.
- Accepting a quote without its version or date.
- Treating agreement between two low-quality sources as corroboration.
- Resolving a contradiction silently by picking the more convenient side.
- Expanding into fresh research instead of reporting `missing evidence`.
