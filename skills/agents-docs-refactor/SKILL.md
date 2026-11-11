---
name: agents-docs-refactor
description: Use periodically (about every 10 applied changes or monthly) or when AGENTS.md files, ARCHITECTURE.md, OCR review rules, or project skills feel duplicated, bloated, contradictory, or messy. Cleans and restructures instruction documents without changing the rules or decisions.
---

# Agents Docs Refactor

Clean the instruction set without changing what it requires. This skill merges, moves, shortens
and reorganises. It never adds a rule, reinterprets a decision or changes behavior.

Adding or updating a rule is `agents-docs-sync`. Changing a decision is `adr-management`.
Feature behavior belongs to OpenSpec.

## 1. When to use

Run when any of these is true:

- About every 10 applied OpenSpec changes, or monthly — whichever comes first.
- A file exceeds its budget (see §3) or is close to it.
- The same rule appears in two places, or two rules disagree.
- A new app, package, tool or command changed the document hierarchy.
- After a large architecture change, when boundaries or commands may have drifted.
- Before major onboarding, so a new reader finds one clear home per topic.

Do not use this skill to:

- add or update a rule, capture a repeated review finding, or record a new convention — use
  `agents-docs-sync`;
- change an architecture decision or supersede an ADR — use `adr-management`;
- change a feature requirement — edit the OpenSpec change or spec;
- fix code, tests or configuration behavior.

## 2. Inputs

- In scope: root `AGENTS.md`; every `apps/*/AGENTS.md` and `packages/*/AGENTS.md`;
  `.docs/ARCHITECTURE.md`; `.opencodereview/rule.json` and `.opencodereview/rules/*.md`;
  `.agents/skills/*/SKILL.md`; `README.md` and `CONTRIBUTING.md` when present.
- Read-only reference: `.docs/Proposal.md`, `.docs/adr/`, `.docs/adr/README.md`,
  `openspec/config.yaml`, the active OpenSpec change.
- Known pain points: the human's complaint, repeated OCR false positives, commands or paths an
  agent got wrong, sections reviewers skip.

## 3. Inventory

List every document before editing. Record its home, budget and current size.

| Path | Owner (home) | Budget |
|---|---|---|
| `AGENTS.md` | universal rules | 180 |
| `apps/*/AGENTS.md`, `packages/*/AGENTS.md` | package rules | 80 each |
| `.docs/ARCHITECTURE.md` | architecture facts | 260 |
| `.opencodereview/rule.json`, `.opencodereview/rules/*.md` | review focus | — |
| `.agents/skills/*/SKILL.md` | procedures | 200 project-authored; imported references exempt |
| `README.md`, `CONTRIBUTING.md` | human onboarding | — |
| `openspec/config.yaml` | project context, read-only here | — |
| `.docs/adr/*.md` | decisions, immutable | one page |

- Count lines per file: `wc -l <file>` on POSIX, `(Get-Content <file>).Count` on Windows.
  Flag files over budget and files close to it.
- Missing files are findings, not failures: record "absent" and continue.
- Name who is accountable for each file. A rule with no owning home is an orphan (§4).

## 4. Findings

Classify each issue before fixing it. One finding names one location and one operation.

| Finding | Test |
|---|---|
| Duplication | The same rule, verbatim or paraphrased, exists in two homes. |
| Conflict | Two rules disagree on behavior, command, boundary or scope. |
| Staleness | The rule names a file, command, tool or package that no longer exists. |
| Misplacement | A package rule in the root file, a universal rule in a package, an architecture fact in `AGENTS.md`, a decision in a guide. |
| Verbosity | Essays, repeated rationale, or examples that restate a rule already stated above. |
| Missing link | An architecture or ADR fact copied instead of linked to its owner. |
| Orphan | A rule with no owning file, or one no reader would find. |
| Broken link | A path, anchor or cross-reference that does not resolve. |

## 5. Rule ledger

- Before editing, extract every rule into a temporary ledger outside the repository or in a
  gitignored path. One row per rule: id, one-line statement, home, `file:line`.
- Split bundled bullets into separate rows only when the split preserves meaning.
- Mark each row `keep`, `merge into <id>`, `move to <home>`, `shorten` or `delete`.
- After editing, read every file back and confirm each row has exactly one home and no row was
  lost. Before and after counts must reconcile.
- Never commit the ledger; delete it once the report is written.

## 6. Refactor operations

Apply the smallest operation that clears the finding. Keep the wording that carries the rule.

- **Merge duplicates.** Keep the copy in the canonical home; replace the other with one link,
  or remove it when the link adds nothing.
- **Move to the correct home.** Move the rule text, not a summary, to the document whose owner
  in §3 matches the rule's scope. A decision belongs in an ADR, which this skill never writes.
- **Split a bloated file.** Split by audience and home, not into equal halves. Each new file
  gets one owner and a link to the others.
- **Delete a stale rule.** Only with evidence that the path, command or behavior is gone.
  Record the evidence and where its content went.
- **Shorten prose.** Delete repeated rationale, history and examples that restate the rule.
  Keep one imperative sentence per rule.
- **Replace rationale with an ADR link.** Link the existing ADR in one line. If no ADR covers
  the decision, do not write one here — stop and report it.
- **Update cross-references.** Fix links after every move, rename or deletion.
- **Keep OCR rules aligned.** If an invariant, boundary or package path changed, update the
  context block in `.opencodereview/rules/*.md` so it does not contradict `AGENTS.md`. Leave
  review focus and severity policy as they are.

## 7. Hard rules

- **Do not add a rule.** Only split, merge, move, shorten or delete with evidence.
- **Do not change a decision.** Do not reinterpret, extend or reword an ADR.
- **Do not change behavior or architecture.** If a document and the code disagree, report the
  disagreement; do not pick a side.
- **Preserve meaning.** A shorter rule must require exactly the same thing.
- **Keep ambiguous rules.** Flag the ambiguity and the question for the human.
- **Never delete a rule silently.** Record `old home → new home`, or the evidence and where the
  content went.
- **Do not touch code, tests, `.env`, `openspec/config.yaml` semantics or ADR text.**
- **Finish the inventory before editing.** Do not turn the pass into a rewrite of every document.

## 8. Validation

- Re-read every edited file in full.
- Every link resolves. Check each link you touched and each link in a moved section; prefer a
  path relative to the file.
- Budgets still hold: compare each file against its budget in §3. A file over budget is a
  finding to fix, not a number to round.
- The ledger reconciles: every rule has exactly one home and the counts match.
- No duplicate rule remains: search the new text for a distinctive phrase from each merged rule.
- When `.opencodereview/` exists, its rules still resolve:
  `ocr rules check apps/web/src/main.tsx` and `ocr rules check packages/pipeline/src/index.ts`.
  Confirm every `rule` path in `rule.json` exists.
- `vp check` does not format `.docs/`, `.agents/` or `openspec/`; `.prettierignore` excludes
  them. Do not expect it to validate or rewrite these files.

## 9. Output

Report, in this order:

1. **Before / after** — one row per file: lines before, lines after, budget.
2. **Rules merged** — `id: old homes → new home`.
3. **Rules moved** — `id: old home → new home`.
4. **Rules deleted** — the rule, the evidence, and where its content went.
5. **Links fixed** — `file → target` for every broken reference repaired.
6. **Unresolved** — ambiguities, conflicts and decisions for the human, each with `file:line`
   and the question.
7. **What got cleaner** — three to five checkable bullets, e.g. "tenancy rules now stated once
   in root §3".

Do not add a "proposed rules" section. A gap found here is an unresolved item, not an edit.

## 10. Stop conditions

Stop and report when:

- two rules conflict and choosing a winner needs a decision;
- a rule's meaning is unclear, or its scope cannot be inferred;
- a fix would change behavior, a boundary, a gate, a public contract or an ADR;
- deleting a rule needs evidence you cannot produce;
- the inventory shows the pass will exceed the session's scope — many files, a full rewrite, or
  a split with no agreed owners.

Report the finding, the options and a recommendation. Do not guess and do not edit around it.

## 11. Anti-patterns

- Rewriting documents for tone or style when no finding exists.
- Deleting live rules to hit a budget; cut duplication and rationale instead.
- Moving package rules to root for "visibility"; it breaks the read order.
- Copying architecture facts into `AGENTS.md` to save a click.
- Turning the audit into a rule-writing session.
- Replacing a precise rule with a vague summary that no longer constrains.
- Editing an ADR, a spec or a test to make the documents agree.
- Reporting "cleanup done" without before/after counts and a reconciled ledger.
