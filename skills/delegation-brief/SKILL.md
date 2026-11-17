---
name: delegation-brief
description: Package context for a subagent. A fresh child knows only what is in its prompt or reachable at a path you name. Use before launching scout, researcher, evidence-auditor, worker, reviewer, or oracle, or when a child returned work based on assumptions you never gave it.
---

# Delegation Brief

A subagent starts with an empty context. It does not see this conversation, the
files you have open, the plan you discussed, or the decision you made three
messages ago. Only two channels cross the boundary:

1. **The `prompt` you pass to `subagent`** - the whole of it.
2. **Paths you name**, which the child reads with its own tools.

Coming back, only the child's **final response** crosses. Its tool output,
intermediate reasoning, and dead ends do not. Write the brief so the final
response is the whole handoff.

## What must cross

| Item                              | Why                                            |
| --------------------------------- | ---------------------------------------------- |
| Goal and acceptance condition     | Otherwise the child invents success.           |
| Authority and boundary            | Whether it may edit, and where it must stop.   |
| Decisions already made            | Prevents relitigating settled choices.         |
| Constraints and invariants        | Architecture, style, compatibility, policy.    |
| Evidence with paths and line refs | Lets the child verify instead of trust.        |
| What was already tried            | Stops it repeating a failed approach.          |
| Output shape                      | Makes the result usable without a follow-up.   |
| Stop conditions                   | Keeps it bounded and prevents silent guessing. |

## Brief skeleton

```markdown
## Goal

What outcome is needed, and what counts as done.

## Authority

What you may change; what is read-only; what needs approval.
Publishing (commit/push/PR) is: <allowed | forbidden>.

## Decisions already made

- D1: <decision> - because <reason>. Do not revisit unless evidence contradicts it.
- D2: ...

## Constraints

- <architecture / pattern / style / compatibility / policy>

## Evidence

- `path/to/file.ts:120-180` - what it shows
- <URL or doc> - what it says (fetched on <date>)

## Tried already

- <approach> - failed because <reason>

## Task

The specific work, in order.

## Validation

The exact commands to run, or "report the command for the parent to run".

## Output

The shape you want back. Cite `file:line` for claims.

## Stop and report when

- <blocking condition>
```

Aim for 20-60 lines. If it needs much more, write it to a file and pass the
path instead (see below).

## Transport

**Inline (default).** Paste the skeleton into `prompt`. Best for one child, or
for briefs that stay short.

**File (long or reused).** Write the brief once, then pass the path to every
child that needs it:

- `.opencode/notes/<slug>.md` in the project - visible, but shows up as an
  untracked file; keep it out of git.
- The session temp directory - invisible to the repo, still readable by the
  child (external reads are allowlisted in this setup).

Say "Read `<path>` first. It is the contract." A path is a pointer, not a
guarantee: confirm you wrote it before launching.

**Session continuation.** Pass the child's `sessionID` back to `subagent` to
continue the same conversation. The child keeps its own context, so you only
send the delta: new evidence, a changed decision, one focused question. This is
the closest analogue to a forked context, and it is the right way to run a
multi-round consultation instead of re-briefing from scratch.

Rules of thumb:

- New child, new brief. Never assume a second child saw the first one's brief.
- Parallel children each need their own complete brief, plus a distinct angle.
- Reusing a child means sending deltas, not the whole history again.
- Never paste the transcript. Summarise decisions and evidence instead.

## Per-role emphasis

| Agent              | The brief must contain                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `scout`            | Anchors (paths, symbols, error text), the boundary to cover, and what the next agent will do with the map.    |
| `researcher`       | Version/platform/date constraints, the decision the answer supports, the angles, and the stop budget.         |
| `evidence-auditor` | The brief verbatim plus the specific claims the decision depends on. Do not pre-filter to claims you believe. |
| `worker`           | The approved plan as a contract, edit boundary, validation commands, and the escalation rule.                 |
| `reviewer`         | The exact ref/range or diff under review, the requirements it is judged against, and the verdict format.      |
| `oracle`           | The decision log and the specific question. See below.                                                        |

## Oracle: the decision log

`oracle` exists to catch drift from earlier decisions, so the decisions are the
brief. Because it starts fresh, a missing log is a missing contract. Include:

```markdown
## Decisions already made

- D1: Chose <X> over <Y> because <reason>. Status: settled.
- D2: Deferred <Z>; revisit after <trigger>.
- D3: <assumption that was never verified>.

## The plan under review

Concrete enough to critique: steps, files, sequencing.

## Evidence

What you observed, what you assumed, what you did not check.

## The question

One decision, not "thoughts?".

## Boundary

Advise only. Do not edit. Do not propose extra agents.
```

If the history is too long to restate, extract the log with `grep` over your
plan/ADR/notes files and pass the relevant lines. Do not expect the oracle to
reconstruct decisions you never wrote down; expect it to name the assumptions it
had to infer, and treat those as a finding about your own record keeping.

Follow up by continuing the same `sessionID` with only the new fact or the
counter-argument. One or two focused rounds; not an open-ended debate.

## Reviewer: the contract

A reviewer judges against something. Always pass:

- the commit/ref/range or the diff itself
- the requirement, plan, or acceptance criteria it is judged against
- what changed since the last review, if this is a re-review
- the verdict format and severity scale you expect

"Review my changes" produces a generic review. "Review `git diff main...HEAD`
against the acceptance criteria in `.opencode/notes/<slug>.md`; P0 blocks merge"
produces a verdict you can act on.

## Anti-patterns

- "Continue what we discussed." The child has no idea what that was.
- Pasting the whole transcript: noisy, expensive, and it buries the decisions.
- Passing a conclusion without its evidence, then asking for a second opinion.
- Naming a file you have not verified exists, or a symbol you have not checked.
- Re-briefing a resumed child from zero, which discards what it already learned.
- Asking one child to both decide and execute, then treating its choice as
  approved.
