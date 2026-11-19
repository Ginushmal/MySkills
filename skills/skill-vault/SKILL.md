---
name: skill-vault
description: Manage the user's skills vault and keep a project in sync with it. Use when the user asks to add, update, remove or scaffold a skill in the vault, to commit or push vault skill changes, to install or update vault skills into the current project, to check whether installed skills drifted from the vault, or when a managed skill copy under an agent skills directory must not be edited directly. Project- and machine-agnostic; works in any repo on any PC that has a clone of the vault.
---

# Skill Vault

The vault is a git repo of reusable agent skills (`<vault>/skills/<name>/SKILL.md`), installed into
projects with the `skills` CLI. This skill owns the downstream loop: **edit the vault → commit →
push → install/update the project → verify**. Installed copies in a project are generated; the vault
is the single source of truth.

## Golden rules

- **Edit skills in the vault, never in an installed copy.** A project copy under
  `.agents/skills/`, `.claude/skills/` or similar is generated; hand edits drift silently and are
  overwritten by the next update.
- **Commit and push are separate steps.** `commit` stays local; `push` is explicit. An install from
  GitHub cannot see an unpushed commit, so `pull` refuses until the vault is pushed.
- **Never hand-edit `skills-lock.json`.** Only the `skills` CLI writes it.
- **Never force-push.** If the vault is behind, pull/rebase deliberately, never rewrite shared
  history.
- **Verify after `pull`.** The lock must record the commit that is now on the remote.

## What the script does not do

- It does not author skill content. Edit `SKILL.md` and its `scripts/` with normal tools, then
  `commit`.
- It does not resolve local-vs-vault drift by copying project edits back. Downstream only: fix the
  vault, then `pull`. `verify` reports drift so it is caught, not merged.

## Vault resolution

Same chain everywhere: `--vault <path>` flag > `SKILLS_VAULT_DIR` environment variable > user config
`~/.skills-vault.json`. The config is per machine and outside any project, so it never gets
committed. One-time setup on a PC:

```bash
node .agents/skills/skill-vault/scripts/skill-vault.mjs where --set /path/to/MySkills
```

`where` validates the path (has `skills/`, is a git repo), prints the remote, and warns when the
remote does not match the `source` recorded in `skills-lock.json`.

On a PC **without** a vault clone, `status`, `verify` and `pull` still work (they read the lock and
GitHub); `commit`, `push` and `new` stop with "no vault clone on this PC".

## Commands

Run from the project root. Script: `scripts/skill-vault.mjs` relative to this skill directory
(Node ≥ 18, zero dependencies, no network calls of its own — the `skills` CLI does the fetching).

| Command | Purpose | Required | Optional |
|---|---|---|---|
| `where` | Resolve and validate the vault | — | `--set <path>` |
| `status` | Vault git state, project PM + installer, per-skill drift | — | — |
| `verify` | Read-only drift report; exits `1` on any drift | — | `--skill <name>` |
| `pull` | Install/update project skills through the detected PM | — | `--skill <name>`, `--dry-run` |
| `commit` | Commit vault skill changes (local only) | `-m <message>` | `--skill <name>`, `--all` |
| `push` | Push the vault branch (never forced) | — | — |
| `new` | Scaffold a vault skill folder | `<name>`, `--description <d>` | — |

`--vault <path>` is accepted by every command.

## The loop

```
user asks to change a skill
        |
        v
edit <vault>/skills/<name>/...          (vault copy, never the installed one)
        |
        v
status  --> review: dirty files, ahead count, which project skills are installed
        |
        v
commit -m "..."                         (local commit; shows the diffstat)
        |
        v
push                                    (required before a project can see it)
        |
        v
pull [--skill <name>]                   (runs the skills CLI via the project's PM)
        |
        v
verify                                  (vault vs installed copies; exit 0 = in sync)
```

### New skill from scratch

```bash
... new my-skill --description "Use when ... — state WHEN, not just what."
# fill in <vault>/skills/my-skill/SKILL.md and optional scripts/
... commit -m "feat(my-skill): add skill"
... push
... pull --skill my-skill            # `add` is used automatically for a skill not yet in the lock
... verify
```

### Removing a skill

The script has no `remove` verb: delete the folder in the vault, `commit`, `push`, then run the
installer's own removal in the project (`skills remove <name>`) and `verify`. Removing from the
vault does not uninstall it from projects; that stays an explicit step.

## Interpreting `status` and `verify`

- `ahead=N` — vault commits not on the remote. `pull` refuses while `N > 0`: GitHub cannot see them.
- `behind=N` — the clone is stale; `verify` compares against the stale clone, so `pull`/fast-forward
  first if you expect newer vault content.
- `dirty=N` — uncommitted vault changes. Commit them before pulling so they are not mixed with an
  install.
- Drift is reported per skill and per installed agent directory:
  `IN SYNC`, `DIFFERS` (with the changed files), `NOT INSTALLED`, `MISSING IN VAULT`.
- Line endings are normalized (CRLF/LF) before comparing, so a Windows checkout is not reported as
  drift.

## Package-manager detection

The installer is never called directly; it runs through the project's package manager, judged from
`packageManager` (then `devEngines.packageManager`), then lockfiles:

| Detected | Command prefix |
|---|---|
| pnpm | `pnpm dlx skills@latest` |
| npm / none | `npx -y skills@latest` |
| yarn | `yarn dlx skills@latest` |
| bun | `bunx skills@latest` |

`pull` uses `update -p -y` for skills already in the lock and `add <source> --skill <name> -y` for a
vault skill that is not installed yet. `--dry-run` prints the exact command and changes nothing.

## Portability

- No absolute paths in this skill; the vault path is per-machine config or environment.
- The project side only needs `skills-lock.json`, which the installer maintains.
- Copy this skill folder into any project, or install it with the `skills` CLI like any other vault
  skill; it behaves the same in both.
