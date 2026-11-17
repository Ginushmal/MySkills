---
name: second-opinion
description: Stress-test a plan, design, or direction before committing - surface hidden assumptions, drift from earlier decisions, and what you may be missing. Use before an expensive or irreversible change, when a bug resists normal analysis, or late in a long session when context may have drifted.
---

# Second Opinion

A second opinion exists to catch the failure modes that normal review misses:
assumptions that quietly changed, a decision that contradicts an earlier one, and
a plan that is coherent only because you have been staring at it.

It is not a routine code review. Use `reviewer` for that.

## When it is worth it

- the change is expensive to undo: schema, public API, auth, data migration,
  dependency replacement, release process
- the evidence conflicts, or a previous attempt failed in a way you cannot
  explain
- the plan grew by accretion and nobody re-checked it end to end
- you are deep into a long session and the original instruction is far behind
- someone is about to be told "yes" on a weak basis

Do not use it for a settled question, a small local edit, or as a substitute for
tests.

## Brief the advisor

A fresh child has none of your history. Anything you leave out, it cannot
recover. The brief must contain:

1. **The goal** in the user's terms, plus the acceptance condition.
2. **The plan or decision** under review, concretely enough to critique.
3. **Decisions and constraints already made**, including ones that are not
   obvious from the code. This is the contract the advisor protects.
4. **Evidence**: what you observed, what you assumed, what you did not check.
5. **What has already been tried**, and how it failed.
6. **The specific question** you want answered. "Thoughts?" invites a summary.
7. **The boundary**: advise only; no edits.

## What to ask it to challenge

- Which inherited decision does this plan contradict or quietly weaken?
- What is assumed but never verified?
- What happens on the failure path, not just the happy path?
- What is the reversible version of this, and is the extra cost worth avoiding?
- If this is right, which alternative should be obviously wrong - and is it?
- What would make us stop and reverse course later, and would we notice?

## Delegating

Call the `subagent` tool directly:

```text
subagent({
  agent: "oracle",
  description: "Second opinion: <decision>",
  prompt: "<goal>\n<plan>\n<decisions and constraints>\n<evidence>\n<tried>\n<question>\nAdvise only; do not edit."
})
```

Run one advisor, not three. If its answer challenges the direction or leaves a
material tradeoff open, continue the _same_ child session with one focused
follow-up rather than launching a new one.

## Using the answer

The advisor recommends; you and the user decide. Classify its points:

- **Accept** - concrete, evidenced, and inside the approved scope. Act on it.
- **Investigate** - plausible but unverified. Verify before changing course.
- **Reject** - contradicted by source, tests, or an explicit user decision. Say
  why, briefly.
- **Escalate** - needs a product, authority, or scope decision. Ask the user.

Never let an advisor's opinion silently override an explicit instruction, and
never treat agreement as approval.

## If you cannot delegate

Run the same checklist yourself, in writing, before acting:

1. Restate the original goal and every decision made since.
2. Name the assumption each step depends on.
3. Look for two steps that rely on incompatible assumptions.
4. Ask what evidence would falsify the plan, and whether you have it.
5. Ask what you would advise a colleague to do if they showed you this plan.

Write the answer down. The value is in the artifact, not the feeling of having
thought about it.
