---
name: ocr-change-review
description: Use after an OpenSpec change is applied and `vp run ready` passes, when the change is substantial enough to need AI review. Runs OCR with full project background, triages findings against the spec, fixes only real issues that do not change agreed architecture or requirements, re-reviews the full diff until clean, and reports fixed vs needs-decision issues.
---

# OCR Change Review

Project review loop for an applied OpenSpec change. CLI mechanics, flags, output shape and troubleshooting live in the `open-code-review` skill; this skill adds only PolsMachine's trigger, background contract, triage rules and report format.

Authority: root `AGENTS.md` §5 and §11, `openspec/config.yaml` → `operations.apply`, and [ADR 0009](../../../.docs/adr/0009-quality-gates-openspec-ocr.md). Architecture facts: [`.docs/ARCHITECTURE.md`](../../../.docs/ARCHITECTURE.md). Do not restate them here.

## 1. Purpose and when to use

Run this loop after:

- every task in `openspec/changes/<id>/tasks.md` is complete;
- `vp run ready` (build + `vp check` + tests) passed on the final tree;
- the change meets a trigger in §2.

Do not run it for a trivial docs-only or small low-risk change — a README edit, a typo fix, a
comment-only diff. Record that decision and its reason as a waiver in the apply report and the
archive summary. If you cannot decide, ask the human. Never skip silently.

## 2. Scope decision

Auto-review when the change touches any of:

- DB schema, migration, RLS, queue or storage; auth, tenancy, OAuth, secrets or encryption.
- Publishing, rate caps or idempotency; a public API, DTO or job/event payload.
- A dependency, build, CI or tooling change; an architecture boundary, new package or app.
- A cross-cutting refactor.

Also auto-review above roughly 5 changed source files or 200 changed lines, excluding generated
code, fixtures and the lockfile. Size it with `git diff --stat`; add `git status --short` because
staged/untracked files do not appear there.

Any one trigger means review. No trigger means decide explicitly and state why. Cannot decide
means ask the human and wait. Never silently skip.

## 3. Preconditions

- `vp run ready` passed on the tree you are about to review. Do not start on a failing tree.
- The review target is the whole change, not the last fix; a bare `ocr review` covers staged,
  unstaged and untracked files together.
- The change context is available: `openspec/changes/<id>/` with proposal, spec delta, design
  and tasks.
- The change is distinguishable from the base. If it is already committed, review the range
  (`--from main --to feature-branch`) or the commit (`--commit abc1234`).
- `ocr` has a working LLM provider. If it cannot connect, stop and ask the human for
  credentials; never invent or hardcode a key.

## 4. Build the background

Write one temporary Markdown file outside the repository: `$env:TEMP` on Windows, `/tmp` or
`$TMPDIR` on POSIX. Never commit it. Never include secrets, tokens, prompts, completions or real
user data.

Include, in this order:

1. Change id, title and a 2–5 sentence summary.
2. Requirements and acceptance criteria quoted from the spec delta — observable outcomes, not
   task checkboxes.
3. Relevant ADRs and decisions, with numbers.
4. Files changed and why, grouped by package; name the new seams.
5. Trade-offs, known limitations and deliberate omissions.
6. Test evidence: which suites ran, what passed, what is uncovered and why.
7. Out of scope: what this change must not be asked to do.

Aim for one page. A reviewer without the requirements flags agreed behaviour as a bug — this
file is what prevents that. Pass it with `--background-file`; use `--background` only for a
sentence or two.

## 5. Run

PowerShell:

```powershell
ocr review --audience agent --format json --output "$env:TEMP\ocr-review.json" --background-file "$env:TEMP\ocr-background.md"
```

POSIX:

```bash
ocr review --audience agent --format json --output "${TMPDIR:-/tmp}/ocr-review.json" --background-file "${TMPDIR:-/tmp}/ocr-background.md"
```

- `--audience agent` suppresses progress UI; `--format json` gives structured findings.
- `--output` writes the full result to a file. Read that file with the file-reading tool. Never
  pipe through `head` or `tail`; that drops earlier findings.
- `--from`/`--to` or `--commit` scope a committed change; `--repo` runs from outside the repo.
- `--preview` lists the files without LLM cost; use it when the diff is large.

If the CLI exits non-zero or reports no provider, report the exact command and error and follow
the `open-code-review` skill's troubleshooting. Do not invent findings to fill the report.

## 6. Parse

Each finding has `path`, `content`, `start_line`, `end_line`, `category`, `severity`,
`suggestion_code`, `existing_code` and `thinking`.

- `start_line` and `end_line` both `0` means positioning failed. Find the code from `content`
  before acting.
- `thinking` explains intent; it is not evidence.
- Treat `low` as noise unless it is a real correctness or security risk. Never pad the report
  with it.

Read the JSON in full, but do not paste it into the transcript. Summarize counts per severity,
then work findings one at a time.

## 7. Triage

Verify every critical and high finding in the code and the spec before editing. A finding is
real only when you can point at the behaviour it breaks.

| Outcome | Test | Action |
| --- | --- | --- |
| Real | The code does what the finding says, and it violates the spec, an invariant or safe engineering. | Fix it. |
| False positive | The model missed a constraint in the background, the requirement or the architecture. | Change no code. Write the reason. Harden the rule if it will repeat. |
| Needs decision | The correct fix changes architecture, a requirement, a public API/DTO/job payload, a dependency, tenancy or secrets handling. | Do not fix. Report it with a proposed fix. |

Ties go to "needs decision" when the fix crosses a boundary listed in root `AGENTS.md` §10.

## 8. Fix loop

1. Fix real critical, high and medium findings that stay inside the agreed design.
2. Never change, weaken, skip or delete a test to satisfy a finding. If a requirement is
   genuinely wrong, change the OpenSpec spec first, then the test — a separate decision.
3. Run `vp run ready` after each fix batch. A red tree ends the loop.
4. Re-run OCR on the full diff, not only the changed lines; a fix can break code elsewhere.
5. Repeat until no fixable medium+ finding remains.

If the same false positive appears twice, harden the narrowest matching rule:
`.opencodereview/rule.json` or `.opencodereview/rules/{project,backend,web,data,library,tests}.md`.
State the recurring misread in that file, then verify the mapping with:

```bash
ocr rules check packages/db/src/repositories/example.ts
```

If a changed file matches no rule, fix the include globs or add a rule, then rerun `ocr rules check` before reviewing.

## 9. Report

Open with one line: change id, files reviewed, findings by severity after triage. Then two
sections, nothing else.

**(a) Fixed** — grouped by issue type, one line per group with file references.

```markdown
Fixed:
- Tenancy (high): scoped the draft lookup by `owner_user_id` — `packages/db/src/repositories/draft.ts`
- Idempotency (medium): added the `(page_id, slot)` uniqueness guard — `packages/db/prisma/migrations/…`
- Tests (medium): covered the blocked-slot path — `apps/worker/test/publish.test.ts`
```

**(b) Needs decision** — medium and above only. For each finding:

```markdown
- [high][architecture] `packages/pipeline/src/score.ts:42`
  Current: <current snippet>
  Problem: <what breaks and why>
  Suggested: <minimal fix snippet>
  Not fixed because: <the decision it would force>
```

Omit low severity. If nothing remains, say so in one line.

## 10. Stop conditions

Stop and report when any is true:

- No fixable medium+ finding remains — the loop is closed.
- A finding needs a decision you cannot make — list it and ask.
- `ocr` is unavailable, has no provider, or keeps failing after one diagnosis — report the exact
  error; the change stays unarchived.
- The diff is too large to review meaningfully: skipped files, repeated token-budget failures or
  timeouts. Do not claim a clean review; split the change and re-run.
- `vp run ready` is red after fixes — fix or revert before continuing.

## 11. Handoff

After the loop closes, run the `change-walkthrough` skill and write the walkthrough. Only then
suggest archiving the OpenSpec change; archive requires the walkthrough and all gates
(root `AGENTS.md` §5). Record the review outcome — fixed, decisions, waivers — in the archive
summary.

## 12. Anti-patterns

- Running OCR with no background, so agreed behaviour comes back as bugs.
- Fixing a false positive because the model sounded confident.
- Changing or weakening a test to satisfy a finding.
- Accepting an architecture or requirement change proposed by the reviewer without the human.
- Silently waiving a medium+ finding, or burying it in summary noise.
- Committing the background file, the JSON output or any temp artifact.
- Reviewing only the last fix instead of the full diff.
- Reporting low-severity nitpicks as work.
