---
name: agents-docs-sync
description: Use when a new rule, convention, tool, command, package, or lesson must be added to the project's instruction documents (AGENTS.md files, ARCHITECTURE.md, OCR review rules, or project skills), or when an existing instruction is found stale or wrong. Also use after an OpenSpec change that introduced a new convention.
---

# Agents Docs Sync

Add or correct instruction documentation so every rule has exactly one home. This skill edits
instructions; it does not invent rules, change decisions, or implement code.

Read root `AGENTS.md` §12 and the document split in `openspec/config.yaml` first.

## When to use

Use when:

- the user states a new rule, preference, or working convention;
- the same OCR finding or review comment repeats and should become durable;
- a new app, package, tool, command, dependency, or check is added;
- a new architecture fact changes how work is done;
- an existing instruction is stale, wrong, duplicated, or contradicts the code;
- an OpenSpec change introduced a convention later changes must follow.

Do not use for:

- a one-off bug fix or feature behavior — use an OpenSpec change;
- an expensive-to-reverse decision — run `adr-management` first;
- a code comment, test name, or README quickstart edit;
- a rule with no evidence beyond one incident.

## Inputs

Collect before editing:

- the rule or correction in one or two sentences;
- its source: user instruction, OCR/PR comment, incident, ADR, or code;
- scope: universal, one package, architecture fact, review focus, or procedure;
- evidence: file, commit, review id, failing gate, or the behavior that proves it;
- who decided it: the human or maintainer who approved it.

## Placement

| Rule applies to | Home | Constraint |
|---|---|---|
| Every app and package | root `AGENTS.md` | Universal rules only; link detail |
| One app or package | `<app\|package>/AGENTS.md` | ≤80 lines; package-only rules |
| Architecture fact: topology, ports, flows, data, reliability, deployment | `.docs/ARCHITECTURE.md` | Update in the same change that alters it |
| Review focus, severity, false-positive guidance | `.opencodereview/rules/*.md` | One topic per file; register in `.opencodereview/rule.json` |
| Multi-step procedure with decision points | `.agents/skills/<name>/SKILL.md` | Trigger in the description |
| Expensive-to-reverse decision | `.docs/adr/NNNN-*.md` and `.docs/adr/README.md` | Use `adr-management` |
| Observable feature behavior | `openspec/specs/` | Through an OpenSpec change, not a doc edit |
| Human onboarding and setup | `README.md`, `CONTRIBUTING.md` (when present) | No agent-only rules |

One rule, one home. When two documents need it, the canonical home states it and the other links.

## Workflow

1. **Classify.** Is it a behavior, a decision, or an instruction? Who must follow it? Is it true
   everywhere or in one place?
2. **Search all instruction homes** for an existing statement, partial duplicate, or conflict:
   ```bash
   rg -n "<keywords>" AGENTS.md apps/*/AGENTS.md packages/*/AGENTS.md \
     .docs .opencodereview .agents/skills openspec
   ```
3. **Choose the home** from the table, preferring the highest (least specific) correct home.
   Move down to a package only when the rule is false elsewhere.
4. **Edit minimally.** Add one bullet or short paragraph in the existing section, style and
   imperative mood. Do not restructure the document.
5. **Update cross-references.** Fix links, the read order, indexes, and summaries that point to
   the changed text.
6. **Delete the old statement** when a rule is replaced or moved. Never leave both versions.
7. **Validate** with §Validation, then **report** with §Output.

## Conflict handling

- Contradicts an accepted ADR: stop. ADRs are immutable; ask the human to supersede it through
  `adr-management` and update the ADR index.
- Contradicts an OpenSpec spec: stop. Change behavior through the spec first; never edit the spec
  to match code.
- Contradicts another instruction: the more specific owner wins for its scope — a package
  `AGENTS.md` over a general statement — but it must not contradict a universal rule. If two
  universal rules conflict, the human decides which survives.
- Duplicates another instruction: keep one canonical statement and replace the other with a link.
- Never silently rewrite a rule to match new behavior; record the replacement and its source.

## Writing rules

- Imperative mood, one rule per bullet, short sentences.
- State the rule; link the ADR for the why. No rationale essays.
- Link a path instead of repeating its content.
- No full file trees; at most a 5–10 row map.
- No marketing, praise, filler, or "remember to".
- Keep existing headings and ordering; add a section only when no existing section owns it.
- Line budgets: root `AGENTS.md` ≤180, package `AGENTS.md` ≤80, `.docs/ARCHITECTURE.md` ≤260,
  every project-authored `SKILL.md` ≤200. Imported or vendor skill references are exempt.
  Move detail to its proper home instead of compressing prose.

## Validation

- Re-read the edited file end to end; confirm the text is in the right section and the meaning is
  unchanged except for the intended rule.
- Confirm every referenced path exists or is a path explicitly planned in the change.
- Search again for the rule's keywords; confirm one canonical statement and no contradiction.
- Count lines (`(Get-Content <file>).Count` or `wc -l <file>`) and compare with the budgets above.
- `.agents/` and `.docs/` are outside `vp check`'s format and lint scope; do not expect it to
  validate these edits. Run `vp check` only when the same change also touched code.
- If the edit names a command or script, confirm it exists in `package.json` or the tool's help.

## Output

Report in this order:

- **Changed**: files with one line each on what changed.
- **Placement**: the chosen home and why the alternatives lost.
- **Moved, merged, deleted**: old location → new location, or `none`.
- **Deferred**: rules that need an ADR, spec, or code change first.
- **Needs the human**: conflicts or budget overflows you could not resolve.

## Stop conditions

Stop and ask instead of guessing when:

- scope is unclear, or the rule could be universal or package-specific;
- the rule contradicts an accepted ADR or an OpenSpec spec;
- the edit exceeds a line budget after moving detail to its proper home;
- the rule is really a feature requirement, architecture decision, or code change;
- the evidence is a single incident and the rule would over-constrain future work;
- satisfying the rule requires changing code, schema, or a public contract.

## Anti-patterns

- Appending every new rule to root `AGENTS.md`; root is for universal rules only.
- Copying a package rule to root "so everyone sees it".
- Turning `AGENTS.md` into an architecture document or tutorial.
- Adding a rule from one review comment without evidence that it generalizes.
- Keeping the old copy "just in case"; two copies drift.
- Restating an ADR instead of linking it.
- Putting architecture facts in `AGENTS.md` or feature behavior in `.docs/ARCHITECTURE.md`.

## Related skills

- `.agents/skills/adr-management/SKILL.md` — write a decision, then link it here.
- `.agents/skills/agents-docs-refactor/SKILL.md` — periodic cleanup of the documents this skill
  edits.
- `.agents/skills/ocr-change-review/SKILL.md` — review loop that produces repeated findings.
