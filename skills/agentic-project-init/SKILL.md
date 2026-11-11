---
name: agentic-project-init
description: >-
  Use to initialize a new web project, or upgrade an existing web project, for agentic
  coding: AGENTS.md hierarchy, architecture doc, quality gates, tests, architecture lint,
  CI/hooks, dependency policy, env validation, OCR review rules, OpenSpec/ADR workflow, and
  a definition of done. Stack-agnostic; detects the existing toolchain instead of forcing one.
---

# Agentic Project Init

Build or repair the guardrails that make a repository safe for agentic coding. Detect the stack
first, write policy second; a gate is real only after it has been seen to fail.

## 1. When to use / when not

Use for a greenfield web repository before its first feature; a brownfield repository with no
instruction files, typecheck, tests or CI; or onboarding an existing codebase to agents.

Not for a one-off feature, a prototype, or a repo that forbids tooling changes; use its change workflow.

## 2. Operating principles

- **High-churn-team test.** Prefer enforceable rules — types, tests, lint, boundaries — over advice.
- **One rule, one home.** A rule lives in exactly one document; other mentions link to it.
- **Detect, don't impose.** Adopt the stack that is there; tool names are examples of a role.
- **Audit before edits.** Inventory brownfield repositories first; label assumptions, never guess.
- **Never overwrite silently.** Show a diff and get approval before replacing existing instructions.
- **Small and reversible.** One gate per change; keep the default branch green.

## 3. Phase 0 — Detect

Produce a short inventory before proposing any change.

| Area | How to find it | Record |
| --- | --- | --- |
| Stack, commands, shape | manifests, lockfiles, scripts, Makefile, workspace files, CI config | languages, frameworks, versions, package manager; exact install, build, test, lint, typecheck commands; single or monorepo; CI required checks |
| Runtime and services | Dockerfiles, compose, deploy configs, schema dirs, SDK imports | deployables, ports, stores, vendors; env names, never values |
| Quality | tests, lint/format/typecheck config, workflows | what exists, what passes, what is skipped |
| VCS and constraints | `git status`, log, branches, remotes, reverts; existing `AGENTS.md`, README, docs, licenses, hooks | clean or dirty; churn; hard rules, forbidden tools, review policy |

Run each command you find; a command that fails is a finding, not a gate. Stop on uncommitted work.

## 4. Phase 1 — Interview

Ask the human; do not infer policy from code alone.

- Invariants: what must never happen, and where each is enforced.
- Architecture: runtime units, dependency direction, deploy topology.
- Tenancy, auth, secrets, retention, and external vendors with their adapters.
- Team churn, quality bar, definition of done, review policy, exception owner, approval path for dependencies and releases.

If an answer is unavailable, propose a default, mark it `ASSUMPTION`, and confirm before enforcing.

## 5. Phase 2 — Documentation hierarchy

Create one home per kind of knowledge; nested files add only local specifics and link upward.

| Document | Owns | Must not contain |
| --- | --- | --- |
| `ARCHITECTURE.md` | current topology, modules, flows, data, reliability, deployment | checklists, procedure, duplicated rationale |
| root `AGENTS.md` | universal rules, commands, lifecycle, test doctrine, boundaries, agent behavior | full architecture, deep file trees, package specifics |
| nested `AGENTS.md` per app or package | stack, patterns, allowed and forbidden imports, local tests, never-do | product overview, universal rules, architecture facts |
| review rules (e.g. `.opencodereview/rules/*.md`) | review focus, severity, false-positive guidance | architecture, full agent workflow |
| skills (`.agents/skills/*/SKILL.md`) | multi-step procedures | product architecture, duplicated rules |
| ADRs | immutable decision history | current-state architecture, feature specs |
| specs (OpenSpec or equivalent) | feature requirements and change plans | architecture decisions, agent rules |
| `README.md` / `CONTRIBUTING.md` | human quickstart and contribution steps | agent-only rules |

Placement: universal→root, package→nested, fact→architecture, review→review rules, procedure→skill,
decision→ADR, behavior→spec, onboarding→README. Default budgets: root ≤180, nested ≤80,
architecture ≤260, skill ≤200. One rule per bullet; no directory trees; no essays — link the ADR.

## 6. Phase 3 — Enforce

Wire the gates the detected stack supports; name one command and owner in `AGENTS.md`; anything not runnable locally runs in CI first.

| Gate | Prevents | Minimum viable setup | Proof it fails |
| --- | --- | --- | --- |
| Formatter | noise and merge churn | one formatter, check mode in CI | add messy formatting → non-zero |
| Linter | unsafe patterns, banned APIs | one linter plus rules for imports and banned calls | add a banned pattern → non-zero |
| Typecheck | broken contracts at boundaries | strict checker as a CI step | introduce a type error → non-zero |
| Unit tests | behavior regressions | one runner; deterministic fakes for I/O; fixed clock and ids | break an assertion on a branch → red; revert |
| Integration tests | wiring drift against real services | disposable database/queue via containers or a test profile | stop the service → clear failure |
| E2E | broken critical journey | one journey; external vendors faked at the boundary | break a step or selector → red |
| Architecture lint | forbidden imports and cycles | explicit allowed edges; dependency-cruiser, import-linter, ArchUnit or a script | add a forbidden import → non-zero |
| Boot/health snapshot | accidental wiring changes | boot summary (routes, subscriptions, config keys) plus a snapshot | add a route or module → mismatch |
| Env validation | missing or invalid config in production | schema validated at startup; committed `.env.example`; fail fast | unset a required variable → boot exits non-zero |
| Error taxonomy | leaked internals, untyped failures | stable codes plus one boundary mapper; generic message for unknown | unknown error maps to a generic code, tested |
| Dependency policy | supply-chain and drift | one manager and lockfile; approval rule for new dependencies; optional license check | add an unapproved dependency → review or lint blocks |
| Secret scanning | leaked credentials | scanner in pre-commit and CI; `.env` ignored | commit a documented dummy token → scanner fails |

## 7. Phase 4 — Agent workflow

- **Propose and apply.** Write the spec/change (or the project's equivalent) with acceptance criteria;
  no code before it is clear; one task at a time, each ending with a runnable verification;
  expensive decisions become ADRs.
- **Gate.** Format, lint, typecheck and unit tests pass on the final tree, plus integration where
  I/O exists. A green build is not evidence a requirement is met.
- **Test doctrine.** Tests encode requirements. Never modify, weaken, skip or delete a test to
  pass. If a requirement changed, change the spec first, then the test. Fixed clock and ids.
- **Review decision.** Apply the trigger checklist in §13; ask when unsure, never silently skip.
- **Review loop.** Build background (change id, requirements, decisions, files and why, trade-offs,
  evidence, out of scope); review the full diff with OCR or an equivalent diff reviewer, using
  machine-readable output; triage critical/high/medium against the spec; fix real issues that do
  not change agreed architecture; record false positives and harden review rules; re-run the
  gate, then re-review; stop when no fixable medium+ remains. Never change tests to satisfy a
  review.
- **Review rules.** Map paths to rule files (e.g. `.opencodereview/rule.json`), exclude generated
  code and lockfiles, and say what not to flag: formatter-enforced style, alternative
  architectures, new dependencies.
- **Report and close.** Group fixes by type with file refs; list unfixed medium+ with file:line,
  snippet, reason and suggested fix. Then walk through and archive.

## 8. Phase 5 — CI and hooks

- Pre-commit: staged files only; format and lint; under ~10 seconds; no typecheck or tests.
- Pre-push: full check plus unit tests.
- CI: frozen install from the lockfile; cache keyed on the lockfile; full gate; architecture lint;
  dependency audit; secret scan; integration/e2e with service containers where required.
- Commit hook config, never global-only; `--no-verify` needs a written reason; CI runs the same
  commands as local.

## 9. Phase 6 — Verify

1. Clean checkout and clean install; run every documented command and record the outcome.
2. Prove each gate family red once: failing assertion, forbidden import, missing env var, dummy secret,
   unknown error code. Record the failure and revert each probe.
3. Run the review tool on a real diff; confirm include/exclude and rule resolution.
4. Restore the tree, remove fixtures, check links and budgets, and run the final gate green.

## 10. Phase 7 — Report

- Created, changed and skipped — with paths and reasons.
- Inventory, real command results, assumptions and deviations, each with owner and expiry.
- Proof table: deliberate break → command → observed failure.
- Next three changes, ordered, each with an acceptance check.

## 11. Stack adapters

Spec, ADR, gate and review names map to the project's equivalents; tools below are examples of a role.

| Role | Examples to adapt, not prescribe |
| --- | --- |
| Install and task runner | `pnpm install --frozen-lockfile`, `npm ci`, `yarn install --immutable`, `uv sync --frozen`, `poetry install`, `go mod download`, `make`, `just` |
| Format and lint | `prettier`, `oxlint`/`eslint`, `ruff`, `gofmt`, `golangci-lint`, `checkstyle` |
| Typecheck | `tsc --noEmit`, `pyright`, `mypy`; compiled languages check in the build |
| Tests | `vitest`, `jest`, `node:test`, `pytest`, `go test ./...`, JUnit; Testcontainers, Compose, Playwright, Cypress |
| Architecture lint | `dependency-cruiser`, ESLint boundary rules, `import-linter`, `ArchUnit`, `go-arch-lint` |
| Env validation | `zod`/`envalid`, `pydantic-settings`, typed config libraries |
| Secret scan and review | `gitleaks`, `trufflehog`; `ocr` or an equivalent diff reviewer with path rules |

- Single repo → one root gate; monorepo → aggregate at root, one command per package, nested
  `AGENTS.md` only where rules differ. One package manager per lockfile.
- JS/TS apps (Next, React, Nest, Express) map the same roles to `package.json` scripts, `tsc`, and `jest` or `vitest`.
- Django proves language independence: `uv sync --frozen`, `ruff format --check`, `ruff`, `pyright`, `pytest`, `import-linter`, `pydantic-settings`, `gitleaks`.

## 12. Brownfield rules

- Audit first; record current gate status.
- Preserve conventions unless unsafe: secret handling, unvalidated auth, untested risk paths;
  record why before changing one.
- Do not reformat the world; format changed files or land formatting as one mechanical change.
- Adopt one gate per change, starting with the highest value; keep the default branch green.
- Quarantine legacy exceptions in an explicit, shrinking baseline; record deviations with an owner
  and expiry; never disable a rule globally.
- Map existing instruction files to the ownership table and show a diff before replacing them.

## 13. Templates and checklists

Root `AGENTS.md`: read order → three-sentence project (link) → invariants → commands → lifecycle
and DoD → test doctrine → boundaries → conventions → security → agent behavior → review protocol →
maintenance → meta-rule.

`ARCHITECTURE.md`: purpose/status → context → topology → module map → flows → domain → ports →
data → reliability → observability → security → config → deployment → evolution → decision index.

Definition of done:

- [ ] Spec/change and every task are complete.
- [ ] The full gate passes on the final tree; no test was weakened, skipped or deleted.
- [ ] The review decision is recorded and the loop is closed.
- [ ] The walkthrough is written; docs updated; the change is archived.

Review trigger — run if any; ask if unsure:

- [ ] More than ~5 changed source files or ~200 changed lines, excluding lockfile and generated.
- [ ] Schema, migration, tenancy, auth, secrets or encryption.
- [ ] Public API, DTO, event or job payload.
- [ ] Dependency, build, CI or tooling; architecture boundary or new package.
- [ ] Cross-cutting refactor.

## 14. Stop conditions

Stop, state the blocker with options and a recommendation, and do not guess when:

- No test, lint or typecheck command works and the human cannot supply one.
- The deploy topology is unknown for a change that needs it.
- Product-owner decisions are missing: tenancy, retention, vendors, release path.
- A gate cannot run locally and CI cannot verify it.
- The repo has uncommitted work, a dirty branch a change would overwrite, or conflicting
  instruction files with unclear ownership.
