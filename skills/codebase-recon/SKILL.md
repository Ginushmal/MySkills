---
name: codebase-recon
description: Orient in an unfamiliar codebase and produce a compressed handoff brief - entry points, key types, data flow, likely change surface, risks. Use before planning a change in a repo you don't know, before briefing another agent, or when you need to know where a behavior actually lives.
---

# Codebase Recon

Recon is not reading the codebase. It is producing the smallest set of verified
facts that lets the next agent act without re-discovering everything.

## Before you search

Pin down:

- the behavior or feature you need to locate
- the anchors you already have: paths, symbols, routes, table names, error text,
  config keys, package names
- the boundary you are willing to leave uncovered

If the task names a file or symbol, start there. Do not begin with a repository
wide grep.

## Search order

1. **Anchors.** `glob` for path discovery, then `grep` scoped to a directory or
   file type for the symbol or string. Read the matching range.
2. **Entry point.** Find where the behavior starts: route, command, job, event
   handler, CLI, exported function, or test.
3. **One hop at a time.** Entry point -> handler -> service -> data access ->
   external call. Stop when the chain is explained.
4. **Contracts.** Note the types, interfaces, schemas, and invariants that cross
   the boundary. These constrain any change.
5. **Tests and config.** Find the tests that cover the seam, and the config that
   selects behavior (flags, env, build targets, routing).
6. **Siblings.** Look for the one existing implementation of the same pattern so
   the next agent follows it instead of inventing one.

Search discipline:

- Scoped before global. A path plus a symbol plus an include filter beats a
  repository-wide regex.
- Reserve unscoped `grep` for exhaustive checks: every call site, every import,
  or proving a name is absent.
- Do not read whole files out of curiosity. Read ranges, then widen only when
  the file is small or the seam genuinely spans it.
- Mark anything unverified as an open question, never as a fact.

## Brief shape

```markdown
# Code Context

## Files Retrieved

1. `path/to/file.ts` (lines 10-50) - why it matters

## Key Code

The critical types, interfaces, functions, and short snippets. Quote only what
the next agent must see.

## Architecture

Call path, data flow, boundaries, and ownership.

## Likely Change Surface

Files and seams that will probably change, with the reason for each.

## Constraints and Risks

Patterns to follow, coupling, migrations, feature flags, tests that constrain
the change, and anything surprising.

## Open Questions

What you could not verify, and the file or check that would settle it.

## Start Here

The first file the next agent should open and why.
```

Keep it pasteable into another agent's task. Every claim points at a path and a
line range.

## Delegating

Call the `subagent` tool directly:

```text
subagent({
  agent: "scout",
  description: "Recon <area>",
  prompt: "Goal: <what the next agent must do>.\nAnchors: <paths, symbols, error text>.\nBoundary: <what to cover, what to skip>.\nReturn the brief shape from the codebase-recon skill."
})
```

- One scout per independent area. Do not fan out several scouts over the same
  seam; you will get three overlapping briefs.
- Pass anchors, not just a topic. A fresh child cannot see your conversation.
- Ask for the boundary explicitly when the repo is large, so the brief stays
  useful instead of ambitious.
- Use `researcher` alongside `scout` only when external source would change the
  answer (for example, which version of a library the repo pins and how that
  version behaves).

## When you need more than a brief

If recon keeps expanding, stop and say so. A recon task that turns into
implementation is a scope change: report the boundary you covered and let the
main agent decide. If the code is correct but undocumented, that is a finding,
not a reason to read the rest of the repository.
