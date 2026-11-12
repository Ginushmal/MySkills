---
name: change-walkthrough
description: Build a reviewer's navigation map through the code a change actually touched — an ordered path of file:line stops with short verbatim snippets and the reason each piece changed, so a human can review the implementation top to bottom without reconstructing the route. Not a summary of the OpenSpec plan. Writes the Markdown file into the active OpenSpec change folder when the project has one for this change, otherwise under the docs directory, plus a short chat summary. Also answers the reviewer's follow-up questions while they review — language- and framework-agnostic plain-language explanations of unfamiliar syntax, tool findings, and pre-existing code. Use when the user says "walk me through the changes", "explain what was implemented so I can review", "change walkthrough", "review walkthrough", or asks for a walkthrough before archiving.
---

# Change Walkthrough

A walkthrough is a **reading path through the code that changed**, not a report
about the change.

The reviewer keeps the diff open in another pane and wants to understand what
the implementation does, in an order that makes sense. Your job is to be the
guide: name the next place to look, say what it does now, say why it is that
way, hand over. Everything else is noise.

Write for a senior engineer. Do not explain programming basics. Do explain
anything stack-specific that is not obvious from the name (a decorator, a macro,
a lazy-init pattern, a framework convention) in a short parenthetical.

## What this document is not

- **Not a restatement of `proposal.md`, `design.md`, `tasks.md`, or the specs.**
  The reader has those. Copying their content produces a longer document with no
  new information. Reference an artifact only when it explains _why the code is
  shaped this way_, in one clause at most.
- **Not a changelog or a file inventory.** `git diff --name-status` already lists
  every file. A table repeating it adds nothing to navigate by.
- **Not a summary of the change at all.** Do not open with "this change moves X
  into Y, adds Z" and then re-tell the same story five times. The path is the
  summary.
- **Not an assessment.** No severity, risk ratings, approval, or "looks good".
  Report facts, including facts that look like gaps.

The test of a good walkthrough: a reviewer who has not seen the diff can read it
straight through, opening each cited location in turn, and finish knowing how
the implementation works — without ever needing to jump back to an earlier
section or open the plan documents.

## Inputs

Resolve in this order; ask only if a genuinely blocking ambiguity remains.

1. **Change scope** — an OpenSpec change id, a branch/commit/PR, a path range,
   or the uncommitted working tree. If the user gives none:
   - dirty tree → `git diff HEAD` plus untracked files;
   - clean tree → the current branch against its merge base with the default
     branch (`git merge-base HEAD origin/HEAD` or `main`/`master`).
2. **The diff** — the primary source of truth for this document. Read it in
   full: `git diff --stat`, `git diff --name-status`, then the hunks plus
   surrounding file content.
3. **Plan artifacts** — read for intent and vocabulary only, never to copy:
   - `openspec/changes/<change>/proposal.md`, `design.md`, `tasks.md`
   - `openspec/changes/<change>/specs/**/spec.md`
   - archived change → `openspec/changes/archive/*<change>*/`
   - ADRs under `<docs-dir>/adr/` when a decision actually explains the code.
4. **Docs directory (fallback only)** — resolve once, before writing anything:
   - `docs/` if it exists at the repo root;
   - otherwise `.docs/` if it exists;
   - otherwise create `.docs/`.
     Do not create a second docs directory in a repo that already has one, and do
     not rename or migrate an existing `docs/` to `.docs/`.
     Skip this step entirely when the walkthrough goes into an active OpenSpec
     change folder (next item).
5. **Output path** — user-specified if given. Otherwise:
   - **Active OpenSpec change (preferred)** — the project uses OpenSpec _and_ the
     scoped change still exists as an active change directory. Detect it rather
     than assuming: the repo root has `openspec/` (or a `planningHome.root`
     reported by `openspec list --json`), and `openspec/changes/<change>/`
     exists outside `openspec/changes/archive/`. Then write
     `openspec/changes/<change>/walkthrough.md`.
     This is safe and intended: `openspec validate` and `openspec status` read
     only the declared artifacts (`proposal.md`, `design.md`, `tasks.md`,
     `specs/**/*.md`), so an extra root-level file is ignored; and
     `openspec archive` moves the whole change directory, so the file travels
     with it into `openspec/changes/archive/<YYYY-MM-DD>-<change>/`.
   - **No such change (fallback)** — no OpenSpec in the project, no active
     change matching the scope, or the change is already archived. Write
     `<docs-dir>/walkthroughs/<YYYY-MM-DD>-<change-slug>.md`, where the slug is
     the change directory name with any leading date stripped. If the repo has
     an established location for this kind of note, follow it instead.
     Never add a file to an archived change directory; archived changes are a
     historical record.

   Hard placement rule: never write anywhere under
   `openspec/changes/<change>/specs/`. That tree is reserved for delta specs —
   a stray markdown file there is a validation ERROR, and any delta-shaped
   content is silently dropped at archive time.

If there is no plan artifact, reconstruct intent from the user's brief, then
commit messages, then the branch name, and say so on the first line of the
document (`Plan source: reconstructed from …`). Never pretend a plan existed.

## Procedure

1. **Read the diff first, plan second.** Build the change set from
   `git diff --stat` and `git diff --name-status` plus untracked files. Separate
   real source from generated/vendored churn — lockfiles, `dist/`, `build/`,
   `coverage/`, minified assets, snapshots, generated clients, `node_modules/`.
   Generated files are never explained; say so in one line if the reviewer would
   otherwise wonder why they are missing.
2. **Choose the path before writing a word.** Decide the sequence in which a
   reviewer should open the code: usually the entry point or the thing that
   changed shape first, then the code it drives, then the wiring that makes it
   live, then the test that documents the behaviour. `tasks.md` is a hint for
   grouping, not a mandate — where the plan's order would send the reviewer
   somewhere premature, follow the code and order the sections by what has to be
   understood next. Never order sections by file name or by diff order.
3. **Read the changed files, not only the hunks.** To say what a function does
   now you need the surrounding file. Read whole files for anything materially
   changed; read hunks only for large mechanical edits.
4. **Pin each stop.** For every section, collect the exact current line numbers
   and symbols a reviewer must open, and the concrete reason the code changed
   there. If the reason is not evident from the code and not recorded, write
   "Reason not recorded" rather than inventing one.
5. **Write the document** using the template below, in path order.
6. **Verify before saving** (see _Verification_).
7. **Deliver**: write the file, then print the chat summary. Do not commit it
   unless asked.

## Document template

````markdown
# <Change name> — code walkthrough

**Scope:** `<range>` (<n> files, +<a> / -<d>) · **Plan source:** `openspec/changes/<change>/`

<2–3 sentences that give the reviewer the through-line: what the code does now
and how the parts connect. Orientation, not a change summary.>

## Path

1. `path/to/a.ts:42` — <why the reviewer starts here>
2. `path/to/b.ts:120` — <what it does with that>
3. `path/to/c.ts:15` — <where it is wired in>
4. `path/to/a.spec.ts:30` — <the test that pins the behaviour>

## 1. <What this stop does, phrased as behaviour or mechanism>

**Read:** `path/to/a.ts:42-88` (then `path/to/a2.ts:12-30` if the helper matters)

**What changed:** <2–4 sentences of behaviour in causal order. What this code
does now, and what it no longer does. No line-by-line recital.>

```<lang>
<verbatim snippet, ≤ 12 lines, only when the shape is decisive>
```

**Why:** <1–2 sentences. The technical reason this code had to change. If
`design.md` or an ADR records it, name it in one clause — do not restate it.>

**Next:** `path/to/b.ts:120` — <why the reader goes there now>

## 2. <Next stop>

<same shape: Read → What changed → optional snippet → Why → Next>

## Not covered by this diff

- <plan item with no matching code, removed behaviour, or a follow-up the plan
  mentions but did not implement — at most 4 bullets; omit the section if empty>
````

Adapt section titles to what the code does; keep the _shape_ fixed. A section
that would have nothing to say is not a section — drop it.

## Writing rules

- **Each section is one stop on the path, and it ends by pointing at the next
  one.** A reader must never have to work out where to go.
- **Every behavioural claim carries a `file:line`.** "The handler now retries
  once" is incomplete without `apps/x/handler.ts:88`.
- **Line numbers are current-file line numbers**, on the working tree you are
  describing — never diff hunk numbers, never numbers remembered from an earlier
  read. Re-read after any ambiguity.
- **Snippets are verbatim**, copied from the file at write time. Trim unrelated
  lines; when eliding, use the language's comment syntax (`// …`, `# …`), never
  bare `...`. Maximum ~12 lines, and only when the code's shape carries the
  explanation — a snippet that just repeats the sentence above it is noise.
- **Name the symbol, not just the file**: `RetryPolicy.shouldRetry`
  (`path:64`). Reviewers search by symbol.
- **Explain the non-obvious in parentheses**, once: "`guard let` (early return
  when the value is nil)", "`@Transactional` (opens/joins a transaction around
  the method)", "`#[derive(Default)]` (generates a zeroed constructor)".
- **Distinguish new from pre-existing.** When context is needed, mark it
  "(pre-existing)". Never imply untouched code is part of the change.
- **Name a file only where it explains behaviour.** No file inventory, no
  change-summary table, no per-task checklist: `git diff --name-status` is the
  inventory. A file no section needs to discuss is simply not mentioned.
- **Density over length.** A 6-file change should read in ~5 minutes. If a
  section needs more than ~20 lines, it is recounting the diff instead of
  guiding through it.
- **Prose in the reader's voice**: "The validator now rejects empty bodies
  before enqueueing", not "I added a check to the validator".

## Hard rules

- Do not modify source, tests, or plan artifacts. The only write is the
  walkthrough file.
- Do not paraphrase or quote the proposal, design, tasks, or specs as document
  content. One clause of attribution at most, and only where it explains code.
- Do not dump the diff. The reader has it.
- Do not invent rationale, tests, or verification. Never claim tests pass, a
  build is green, or a behaviour was confirmed unless you actually ran it.
- Do not describe planned-but-absent work as done. Use `Not touched in this
diff:`.
- Do not assign severity, risk ratings, or approve/reject language.
- Redact secrets: no tokens, keys, connection strings, or URLs with embedded
  credentials in snippets — replace with `<redacted>`.
- Do not overwrite a walkthrough for a _different_ change that happens to share
  the path; regenerating the same change may overwrite its own file.
- Do not write into `openspec/changes/archive/`, and do not write under any
  change's `specs/` tree.

## Verification before saving

1. Every cited path exists; every cited line range exists in that file.
2. Every snippet matches the file byte-for-byte after trimming.
3. The `Path` list matches the section order, and each section's `Next` points at
   the following stop (the last one to the test or the entry point of the next
   area).
4. Every section names at least one `file:line` it asks the reviewer to open.
5. No file inventory, file table, or change-summary table appears anywhere.
6. Nothing in the document paraphrases `proposal.md`, `design.md`, or
   `tasks.md`; plan artifacts are cited, never retold.
7. No secret appears in the document (grep for `token`, `password`, `secret`,
   `://user:`, long base64/hex strings).
8. Every path cited is repo-root-relative (no `../../`, no `openspec/changes/`
   prefix), so the document stays correct when the change folder is archived.

## Chat summary

After writing, print at most ~7 lines:

```text
Walkthrough: `<walkthrough-path>`
<one sentence: the through-line a reviewer should hold>
<n> stops, <m> files, base `<ref>` — navigation only, no verdicts
Start: `path:line` (<why>) → `path:line` → `path:line`
```

`<walkthrough-path>` is the path actually written — the change folder
(`openspec/changes/<change>/walkthrough.md`) or the docs fallback. Say which one
and why in one clause, e.g. "(change folder; travels into the archive)" or
"(docs fallback; no active OpenSpec change)".

## Edge cases

- **Uncommitted work** — diff against `HEAD`, include untracked files, and state
  that in **Scope**.
- **Multiple changes or commits** — accept a list; give each its own `##` area
  with its own `Path`, and keep one continuous route through the code.
- **Large change (> ~25 files or > ~1500 diff lines)** — keep one path but split
  it into 2–4 passes, each ending with an explicit "stop here" that names the
  decision worth reviewing before continuing. Still one file.
- **Plan and code disagree structurally** (task says one module, code puts it
  elsewhere) — describe the code, and note the difference in that section's
  `Why` as a fact. Do not audit the plan.
- **Non-git project** — ask for the changed file list or a diff, then continue
  unchanged.
- **Both `docs/` and `.docs/` exist** — write to `docs/`, leave `.docs/`
  untouched, and mention which one you used in the chat summary.
- **OpenSpec project, several active changes** — pick the one the diff actually
  implements (matching files/tasks/specs); if two are equally plausible, ask
  instead of guessing. Never split one walkthrough across two change folders.
- **OpenSpec project, no active change** — the walkthrough goes to the docs
  fallback. Say so in the chat summary; do not create a change directory for it.
- **Change archived before the walkthrough was written** — docs fallback. Do not
  reopen or edit the archive.
- **Walkthrough regenerated after the change was archived** — the earlier file
  now sits at `openspec/changes/archive/<date>-<change>/walkthrough.md`; write
  the new one to the docs fallback and say that the archived copy is superseded,
  rather than editing the archive in place.
- **Language you are unsure about** — read the surrounding file and its tests
  before explaining; if still unclear, describe the observable effect and say
  what you could not determine.

## Answering review questions after the walkthrough

Delivering the file is not the end of the job. The reviewer reads the diff next
to the walkthrough and comes back with questions: a line the walkthrough passed
over, a syntax they have never used, a bot or reviewer finding they cannot
evaluate, code that predates this change. Treat those questions as part of this
skill.

Answer each one in the reviewer's own terms:

- **Assume no prior knowledge** — of the language, the framework, the tool that
  raised a finding, or the file's previous state. The reviewer may be competent
  in general and still not know this stack. Explain the piece they asked about,
  not the whole change.
- **Answer the question asked, then stop.** A few sentences plus a short
  before/after excerpt is the default. No recap of the walkthrough, no re-telling
  of the plan, no design opinion. Expand only when asked again.
- **Lead with the problem.** One sentence on what was wrong or missing, then what
  the new code does about it. Behaviour before, behaviour after.
- **Name the syntax or convention and gloss it once.** Say what the construct
  actually is in this language or framework ("a plain object also inherits
  built-in properties such as `constructor`", "this marker tells the framework to
  construct and inject the class", "this macro expands to a nil check at compile
  time"). Never leave a keyword, operator, decorator, annotation, or tool label
  unexplained — but gloss it in one clause, not a tutorial.
- **Anchor to the code.** Quote the exact line or excerpt with `file:line`, the
  same way the walkthrough does. If the answer depends on code this change did
  not touch, say so and mark it "(pre-existing)".
- **Translate tool findings.** State what the tool objected to, what the fix
  changes at runtime, and whether the reviewer can observe the difference. A rule
  name is not an explanation.
- **One analogy, only when the concept is abstract**, and drop it once the
  concrete statement has landed. An analogy is a bridge, not the answer.
- **Show the old code for a behaviour change.** Read it from the diff or history
  rather than reconstructing it from memory.
- **Say what you do not know.** If the code, the plan, and the history record no
  reason, say so; do not invent one to make the answer tidier.
- **Stay read-only.** Explaining is not permission to edit the walkthrough, the
  code, or the tests. Change something only when the reviewer explicitly asks in
  that message.

Keep the walkthrough's register: plain sentences, facts, no severity, no verdict
unless the reviewer asks for a judgement — and then say what it rests on.
