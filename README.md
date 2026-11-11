# MySkills

A personal skill registry for the [open agent skills ecosystem](https://skills.sh).
Every skill lives in `skills/<skill-name>/SKILL.md` and is installed into other projects with
the [`skills`](https://github.com/vercel-labs/skills) CLI (`npx skills`).

## Layout

```text
skills/
  <skill-name>/
    SKILL.md          # required: YAML frontmatter (name, description) + instructions
    ...               # optional: scripts/, templates, resources
```

`skills/` is one of the CLI's standard discovery directories, so no extra manifest is needed.
Discovery walks up to three levels deep, which also allows `skills/<category>/<skill>/SKILL.md`.

## Rules for skills in this repo

- `name` in the frontmatter must be lowercase kebab-case and match the folder name.
  The CLI uses `name` as the install identifier, so `NestJS Test Generator` would install as a
  folder called `nestjs-test-generator` but be listed under the spaced name.
- `description` is what the agent matches against. State *when* to use the skill, not just what it does.
- Skills must be portable: no absolute paths, no references to files that only exist in this repo.
  Reference other skills by name (for example "see the `open-code-review` skill"), not by relative path.
- Scripts must resolve their own dependencies. A skill that needs npm packages ships a
  `package.json` and documents the install step in its `SKILL.md`.

## Use a skill in another project

Run from the target project root:

```bash
# See what this repo offers
npx skills add Ginushmal/MySkills --list

# Install one skill into the detected agent
npx skills add Ginushmal/MySkills --skill adr-management

# Install several skills, non-interactive
npx skills add Ginushmal/MySkills --skill adr-management --skill agents-docs-sync -y

# Install everything to every detected agent
npx skills add Ginushmal/MySkills --all

# Install globally so it is available in every project
npx skills add Ginushmal/MySkills --skill adr-management -g
```

Skills land in `.agents/skills/<name>/` (the shared location for GitHub Copilot, Codex, Cursor,
Gemini CLI, OpenCode and others) and are recorded in `skills-lock.json`, which should be committed
in the target project.

Pin a tag or commit for reproducible installs:

```bash
npx skills add Ginushmal/MySkills@v1.0.0 --skill adr-management
```

## Update installed skills

After pushing changes here, run in each consuming project:

```bash
npx skills check     # report available updates and local modifications
npx skills update    # update all project skills
npx skills update adr-management
```

`skills update` compares the installed files against `computedHash` in `skills-lock.json`.
A skill you edited locally is reported as `modified` and will be overwritten by an update.

## Use a skill without installing it

```bash
npx skills use Ginushmal/MySkills@adr-management
npx skills use Ginushmal/MySkills@adr-management --agent github-copilot
```

## Add a new skill

```bash
npx skills init skills/my-new-skill
```

Then edit `skills/my-new-skill/SKILL.md`, commit, and push. It is immediately installable —
no registry publish step.

## Skill-specific setup

| Skill | Extra requirement |
| --- | --- |
| `nestjs-test-generator` | Run `npm install` inside the installed skill folder (or the project) so `ts-morph` resolves; the orchestrator imports it directly. |
| `adr-management` | Optional `scripts/search_adrs.py` needs Python + Chroma; plain `rg` search works without it. |
| `ocr-change-review` | Requires the `ocr` CLI and the `open-code-review` skill. |
