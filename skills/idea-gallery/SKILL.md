---
name: idea-gallery
description: Capture and consult the user's Idea Gallery — a numbered backlog of ideas the user stated or explicitly endorsed ("good idea", "save this for later", "add this to the gallery"). Use at the start of every openspec explore / brainstorm / planning session to load active idea names, when the user voices or endorses an idea worth keeping, when the user drifts into a side-tangent idea the current change will not capture (offer to save it — ask first), when an idea looks related to the current discussion, and to read, refine, reopen, or close ideas (done / rejected / expired). Project-agnostic; works in any repo.
---

# Idea Gallery

A durable, cross-session backlog of **the user's** ideas. Ideas surface in unrelated chats,
explorations and brainstorms; without a gallery they vanish when that session ends. Each idea is
one numbered Markdown file with a YAML frontmatter; a script owns all mechanics (numbering,
naming, frontmatter, validation) so agents never hand-edit idea files.

## The golden rule: provenance

Only two kinds of ideas enter the gallery:

- `origin: user` — the user stated the idea themselves.
- `origin: user-endorsed` — an agent (or anyone) suggested it and the user explicitly endorsed
  it ("good idea", "yes, for later", "save that").

**Never capture agent-invented ideas on your own initiative.** Silence is not endorsement. Record
the user's own words in the idea body — the raw idea is theirs, not your paraphrase of it.

How capture is triggered:

| Situation | Action |
|---|---|
| User explicitly says save / add to gallery, or endorses a suggestion | Capture directly |
| User voices a side-tangent idea that the current change will not capture | **Offer**: "save this to the idea gallery?" — capture only on an explicit yes |
| Agent-invented idea the user never reacted to | Never capture, never offer as if it were theirs |

Watch for tangents actively: when the user muses about something good but out of scope — or an
idea surfaced earlier in the session and never made it into the change — offer to save it before
the session ends. One short offer, no pressure; a no or a shrug means leave it.

## When to use

1. **Explore / brainstorm / planning session starts** → run `list` (active only). Scan names and
   descriptions; `read <id>` only the ones that look relevant to this session.
2. **The user states or endorses an idea** that is out of scope for the current work → capture it
   (see Capture flow). **The user voices a tangent** the change will not capture → offer to save
   it, capture only on approval. In-scope work belongs in the current change, not the gallery.
3. **An idea ships, dies, or stales** → close it with `status` (see Lifecycle). When a change that
   came from a gallery idea is archived, mark the idea `done` with that change id.
4. **The user asks about past ideas** → `list --all`, `read`.

## Explore flow

```
session starts --> list (active only)
                     |
              something relevant?
                     |
                   read <id>
                     |
        tell the user: "idea NNNN relates to / overlaps this"
                     |
              user approves? --no--> leave it; optionally note a breadcrumb
                     |yes
        incorporate the idea into this session's scope
```

Mention and ask — never silently fold an idea into scope. A declined-but-relevant idea may get a
breadcrumb note (`note <id> --text "considered in <change>, deferred because ..."`) so the next
explorer sees why it is still active.

## Capture flow

1. Confirm the trigger: an explicit save/endorsement, or a yes to your offer. No trigger, no add.
2. Run `list` first. If an active idea covers the same thought, do **not** add a near-duplicate:
   ask the user "extend idea NNNN or file a new one?". Extend with `note`.
3. New idea → `add` with the correct `--origin`, a description ≤ 200 chars (script-enforced),
   and a body carrying the user's raw idea. Use `--body-file` for multi-line bodies.
4. `--context` records where it came from (session topic, change id) — cheap provenance.

Notes are **append-only**: they refine an idea, never rewrite it. If the user's new direction
fundamentally changes an idea, ask, then file a new idea and mark the old one `expired` with a
pointer to its successor.

## Lifecycle

```
active --> done      --change <change-id> required (which change implemented it)
       --> rejected  --note required (why decided against)
       --> expired   --note required (why no longer relevant)
done|rejected|expired --> active   reopen; --note required (why revived)
```

Status lives in the frontmatter only; filenames never change, so references never rot. Every
transition appends an audit line under `## Notes`.

## CLI

Run from the repo root. Script: `scripts/idea-gallery.mjs` relative to this skill directory
(Node ≥ 18, zero dependencies).

```bash
node .agents/skills/idea-gallery/scripts/idea-gallery.mjs <command>
```

| Command | Required flags | Optional |
|---|---|---|
| `list` | — (defaults to active only) | `--all` or `--status <s>` |
| `read <id>` | — | — |
| `add` | `--name --description --origin` + one of `--body` / `--body-file` | `--context` |
| `note <id>` | `--text` | `--context` |
| `status <id> --set done` | `--change` | `--note` |
| `status <id> --set rejected\|expired\|active` | `--note` | — |

Examples:

```bash
... add --name "Rate cap dashboard" --description "Per-page UI showing remaining publish slots and blocked warnings." --origin user --body-file idea.md --context "explore session on rate caps"
... note 7 --text "User clarified: caps are per-page, not per-channel."
... status 7 --set done --change add-rate-caps --note "Shipped with the dashboard."
... status 3 --set rejected --note "User decided against: overlaps with existing queue view."
```

Exit codes: `0` ok, `1` validation/usage error (read the message, fix the call), `2` not found.

## Storage and portability

- Gallery directory: `--dir <path>` flag > `IDEA_GALLERY_DIR` env > `.docs/ideas` under cwd.
- Files: `NNNN-slug.md`, zero-padded id assigned by the script (max + 1). Id = the number.
- Frontmatter: flat scalar keys only (`id, name, description, status, origin, captured, context,
  updated, resolved_by, resolution_note`) — the script is the only writer.
- **Portable**: copy this skill folder into any project; it has no project-specific dependencies.
  Projects may add pointer lines in their AGENTS.md or agent config ("during explore, use the
  idea-gallery skill"), but the skill works from its description alone. Set `IDEA_GALLERY_DIR`
  or `--dir` if the project keeps docs elsewhere (e.g. `docs/ideas`).

## Hard rules

- Never hand-create or hand-edit idea files; every read/write goes through the script.
- Never capture an idea the user did not state or explicitly endorse, and never without their
  go-ahead: an explicit request/endorsement, or a yes to your offer.
- Never delete idea files; close them with a status instead. History stays.
- Keep descriptions short and specific (≤ 200 chars) — they are the context budget every future
  explore session pays.
