---
name: adr-management
description: >-
  Use this skill ONLY when proposing a SIGNIFICANT architecture-changing decision (for
  example: adopting a major framework, changing the process topology, the queue, the
  rendering engine, the AI orchestration layer, the observability model, or a project-wide
  rule). DO NOT use it for minor refactors, routine configuration, or feature-level design —
  those belong in OpenSpec specs.
---

# ADR Management

Architecture decisions live in `.docs/adr/`, one numbered file per decision, using
`.docs/adr/template.md`. The index is `.docs/adr/README.md`. This project does **not**
require `pixi` or `adr-tools`; the repository is the source of truth. An optional legacy
script (`.agents/skills/adr-management/scripts/search_adrs.py`) can index ADRs semantically
with Chroma, but plain text search is the default and needs no Python dependencies.

> **When to write an ADR**
> Only for decisions that are expensive to reverse:
> - a new major framework, language, database, broker or rendering engine;
> - a change to the process topology or a package boundary;
> - a change to a cross-cutting rule (tenancy, idempotency, security, cost model);
> - a decision that supersedes an existing ADR.
>
> Feature behavior, UI details and implementation steps belong in OpenSpec changes.

## Workflow

1. **Search first.** Look for an existing decision before writing a new one:
   ```bash
   rg -i "topic keywords" .docs/adr
   # or read the index table
   cat .docs/adr/README.md
   ```
   If a relevant ADR exists, read it and check its **Status**. Do not silently contradict it;
   supersede it explicitly.

2. **Number it.** Take the next free four-digit number:
   ```bash
   ls .docs/adr | grep -E '^[0-9]{4}-' | sort | tail -1
   ```

3. **Create the file** from the template:
   ```bash
   cp .docs/adr/template.md .docs/adr/0011-your-decision.md
   ```
   Fill in Date, Status, Context, Decision, Consequences and Considered Alternatives. Keep it
   under one page: enough for a future maintainer to understand *why*, not a design document.

4. **Link it.** If it supersedes or amends an existing ADR, update both files' Status sections
   (e.g. `Superseded by 0012`) and mention the relationship in the new ADR.

5. **Index it.** Add a row to the table in `.docs/adr/README.md`.

6. **Cross-reference.** If the decision changes the architecture, update the relevant
   Architecture doc.

## Status values

- **Proposed** — written, not yet agreed.
- **Accepted** — current decision; follow it.
- **Superseded by NNNN** — historical; read the replacement.
- **Deprecated** — no longer recommended, but not yet replaced.

## Rules

- One decision per ADR. Do not bundle unrelated choices.
- Record the alternatives you actually considered and why they lost.
- Write for a maintainer who joins in two years and has no context.
- ADRs are immutable history: never rewrite an accepted decision in place; supersede it.
