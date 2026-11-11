---
name: adr-generator
description: >
  Creates Architecture Decision Records (ADRs) after implementation completes.
  Updates existing ADRs for minor refinements, only creates new ADRs for truly new
  or fully-replacing decisions. Superseded ADRs get a .suppressed.md filename suffix
  so agents can easily identify active decisions. Optionally updates
  Architectural_Blueprint.md if infrastructure-level changes occurred.
  Use this skill when the user asks to "create an ADR", "write an ADR", "generate ADRs",
  "document the decisions", or after a major implementation session completes.
  YOU MUST ALWAYS run this skill after openspec-archive skill has being finished runing.
---

# ADR Generator

After a significant implementation session, this skill captures the architectural
decisions made into formal ADRs and ensures the architectural blueprint stays current.

## Core Principle: Minimize ADR Proliferation

**Prefer updating existing ADRs over creating new ones.** A new ADR should only be
created when the decision is genuinely new (no existing ADR covers the topic) or when
the old decision is being **completely replaced** by a fundamentally different one.

## What Qualifies as a Major Decision

Create an ADR only when the decision meets one of these criteria. Skip for implementation details.

**Major (create ADR):**

- Introducing or changing a data model, schema, or source of truth
- Changing architectural patterns (pipeline, strategy, adapter, guard)
- Adding, removing, or redefining a service's responsibilities
- Adding a new external dependency that alters system capabilities
- Changing configuration precedence, merge strategy, or where config originates
- Adding or changing the contract between services (NATS message shapes, DTOs)
- Infrastructure changes (new broker, database, cache)

**Not Major (skip ADR):**

- Choosing which library implements an already-decided pattern (e.g., `js-yaml` vs `yaml`)
- Adding fields to an existing DTO within an already-established structure
- Bug fixes, refactors that preserve behavior, performance optimizations
- Test additions, formatting changes, renaming without structural change
- Scaffolding or placeholder code
- Refinements or extensions to an already-documented decision (update the existing ADR instead)

## Workflow

### Step 1 — Read Existing ADRs

List the current **active** ADRs (exclude suppressed ones) and read each one:

```
glob: docs/adr/*.md
exclude: docs/adr/*.suppressed.md
exclude: docs/adr/0000-adr-template.md
```

For each active ADR, read its **Status** line and **Decision** section.
Build a topic map:

| ADR  | Title                   | Status   | Topic                  |
| ---- | ----------------------- | -------- | ---------------------- |
| 0001 | Isolated PR Workspaces  | Accepted | git worktree isolation |
| 0002 | AI Engine Encapsulation | Accepted | AI adapter pattern     |
| ...  | ...                     | ...      | ...                    |

### Step 2 — Classify Each New Decision

For each decision from the implementation session, run it through this decision tree:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     DECISION CLASSIFICATION                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Does an existing active ADR cover this topic?                           │
│                                                                          │
│  NO  ───────────────────────────────► CREATE new ADR                    │
│                                                                          │
│  YES ── Is the core decision the same, just refined/extended?            │
│         │                                                                │
│         YES ─────────────────────────► UPDATE existing ADR              │
│         │                              (edit in place, add amendment)    │
│         │                                                                │
│         NO ── Does the new decision COMPLETELY REPLACE the old one?      │
│               (contradicts it, takes a fundamentally different approach) │
│               │                                                          │
│               YES ───────────────────► CREATE new ADR + SUPPRESS old    │
│               │                            (rename old to .suppressed.md)│
│               │                                                          │
│               NO ────────────────────► They are separate topics.        │
│                                        CREATE new ADR (no suppression).  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

#### What counts as "same decision, refined" (UPDATE):

- Adding new fields, properties, or parameters to an already-documented pattern
- Extending the scope of an existing decision (e.g., "also applies to service X")
- Clarifying ambiguity in the original decision
- Adjusting implementation details while the architectural choice stays the same
- Adding a new consequence or trade-off discovered during implementation

#### What counts as "completely replaces" (SUPPRESS):

- The new decision **contradicts** the old one (e.g., "use NATS" → "use Redis Pub/Sub")
- The old approach was **abandoned** in favor of a fundamentally different approach
- The old decision's core rationale no longer applies

#### What does NOT count as supersession:

- Building on top of an existing decision (that's an update or a separate topic)
- Adding a complementary decision in the same area
- Refining implementation details of an existing decision
- Extending a pattern to new services or contexts

### Step 3 — Update Existing ADRs (when applicable)

When a decision is a refinement of an existing ADR, **edit the ADR in place**:

1. Update the **Decision** section to reflect the refined understanding.
2. Update the **Consequences** section if new trade-offs emerged.
3. Update the **Date** line to today's date.
4. Add an entry to the **Amendments** section at the bottom of the file:

```markdown
## Amendments

| Date       | Summary                                        |
| ---------- | ---------------------------------------------- |
| 2025-07-23 | Extended config merge to support env overrides |
| 2025-08-10 | Added fallback precedence for missing fields   |
```

Keep amendments as a concise table. Each row is one amendment session.

### Step 4 — Suppress Replaced ADRs (when applicable)

When a new decision completely replaces an existing one:

1. **Rename** the old ADR file to add `.suppressed` before `.md`:
   ```
   0003-old-decision.md  →  0003-old-decision.suppressed.md
   ```
2. **Update the Status** section inside the suppressed file:
   ```markdown
   ## Status

   Superseded by [0012-new-decision](0012-new-decision.md)
   ```
3. The rest of the suppressed ADR remains as historical record.

**Why the filename suffix?** It lets future agents quickly find active ADRs:

```
glob: docs/adr/*.md          → all ADRs (active + template)
exclude: *.suppressed.md     → only active ADRs
```

### Step 5 — Group New Decisions Logically

Don't dump everything into one ADR. Split by logical concern:

```
  Session outcomes                   ADRs
  ┌──────────────────┐              ┌──────────────────────────┐
  │ Config file schema│     ──────▶  │ 0009-repo-config-file    │
  │ Validation strat  │              │   -schema.md             │
  ├──────────────────┤              ├──────────────────────────┤
  │ 3-layer merge    │     ──────▶  │ 0010-three-layer-config  │
  │ DB defaults      │              │   -merge.md              │
  ├──────────────────┤              ├──────────────────────────┤
  │ Message hierarchy │     ──────▶  │ 0011-outbound-messaging  │
  │ Outbound contract │              │   -contract.md           │
  └──────────────────┘              └──────────────────────────┘
```

Grouping rules:

- Each ADR covers **one coherent topic** that a future reader would search for independently.
- If two decisions answer different questions, they belong in different ADRs.
- If one decision is a direct consequence of another (e.g., "we chose X, therefore we need Y"), they can go in the same ADR.
- Field ownership tables and merge precedence belong together.

### Step 6 — Determine Next ADR Number

Count existing ADR files (excluding `0000-adr-template.md` and `*.suppressed.md` files)
and use the next sequential number. Use 4-digit zero-padded format: `0001`, `0002`, ..., `0011`.

If this is the first ADR, start at `0001`.

### Step 7 — Write Each New ADR

Use the template from `docs/adr/0000-adr-template.md`:

```markdown
# [NNNN]. [decision title in kebab-case, human-readable]

Date: [YYYY-MM-DD]

## Status

Accepted

## Context

[What problem existed before this decision? What was the state of the system?
What options were considered? Keep it factual — describe the landscape that led to this choice.]

## Decision

[What did you choose and why? Be specific. Include:

- The exact approach taken
- The rationale (why X over Y?)
- If applicable, a table showing field ownership, precedence, or scope

This is the core of the ADR — a future reader should understand WHAT was decided and WHY.]

## Consequences

[Pros, cons, and trade-offs. Format should help a future reader decide whether to revisit this:

**Pros:**

- ...

**Cons:**

- ...

**Trade-offs accepted:**

- ...]

## Amendments

| Date | Summary |
| ---- | ------- |
```

Keep ADRs concise. 1-2 pages max. Focus on why, not how.

### Step 8 — Update the Blueprint (if needed)

The `docs/Architectural_Blueprint.md` is the infrastructure and tech stack reference.
**Only update it when:**

- A new technology is added to the stack (new database, new broker, new library category)
- A service's responsibility fundamentally changes (e.g., "Review Processor no longer handles X")
- A new service is added or removed
- The data flow between services changes at the architecture level
- A new cross-cutting concern is introduced (new observability pattern, new security boundary)

**Do NOT update it when:**

- Implementation details change within an already-documented pattern
- New DTOs, enums, or internal classes are added
- Configuration options change
- A specific library swaps for another in the same category

When updating, be **minimal** — add a line or paragraph, don't rewrite sections.
The blueprint is a reference, not a changelog.

### Step 9 — Update the Project TODO (if needed)

The `docs/PROJECT_TODO.md` tracks the overall project implementation status. After generating ADRs for a completed implementation session, check if any work completed major blueprint sections.

**When to update the TODO:**

- A service stub/component listed in the TODO was fully implemented (e.g., GitHub responder, SizeStep, OpenCodeReviewerAdapter)
- A new architectural component was introduced that is not yet listed in the TODO (e.g., a new pipeline step type, a new notification channel)
- An entire service or module section is now fully complete (all sub-items `[x]`)

**How to update:**

1. Read `docs/PROJECT_TODO.md`
2. For each completed component, change its marker from `[~]` or `[ ]` to `[x]`
3. If a new component was introduced that has no entry, add a new checkbox entry under the appropriate blueprint section
4. If an entire top-level section is now complete, update the section header marker as well

**Example:** After implementing the real SizeStep logic, update:

```
- [~] `SizeStep` (stub — hardcoded `isTooLarge = false`)
```

to:

```
- [x] `SizeStep` (fully implemented with PR diff size analysis)
```

### Step 10 — Report

Summarize:

- ADRs **created** (new decisions)
- ADRs **updated** (existing decisions refined, with amendment summaries)
- ADRs **suppressed** (replaced decisions, renamed to `.suppressed.md`)
- Whether the **blueprint** was updated
