#!/usr/bin/env node
/**
 * idea-gallery — zero-dependency CLI for the user's Idea Gallery.
 *
 * Project-agnostic: the gallery directory resolves from
 *   1. --dir <path>            (flag, any position)
 *   2. IDEA_GALLERY_DIR        (environment variable)
 *   3. .docs/ideas             (default, relative to cwd — run from the repo root)
 *
 * Idea files: NNNN-slug.md with a flat-scalar YAML frontmatter. Agents never
 * hand-edit idea files; every mutation goes through this script.
 *
 * Commands:
 *   list   [--all | --status <active|done|rejected|expired>]   (default: active only)
 *   read   <id>
 *   add    --name <n> --description <d> --origin <user|user-endorsed>
 *          (--body <markdown> | --body-file <path>) [--context <c>]
 *   note   <id> --text <t> [--context <c>]
 *   status <id> --set <done|rejected|expired|active>
 *          [--change <change-id>] [--note <n>]
 *     done            requires --change
 *     rejected|expired require --note
 *     active (reopen) requires --note
 *
 * Exit codes: 0 ok, 1 validation/usage error, 2 not found.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const STATUSES = ["active", "done", "rejected", "expired"];
const ORIGINS = ["user", "user-endorsed"];
const MAX_DESCRIPTION = 200;
const FILE_RE = /^(\d{4})-(.+)\.md$/;

function fail(msg, code = 1) {
  process.stderr.write(`idea-gallery: ${msg}\n`);
  process.exit(code);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

// ---------- argv ----------

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      if (key === "all") {
        flags.all = true;
        continue;
      }
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) fail(`flag --${key} needs a value`);
      if (key in flags) fail(`duplicate flag --${key}`);
      flags[key] = value;
      i++;
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function requireFlags(flags, allowed, required) {
  for (const key of Object.keys(flags)) {
    if (key !== "dir" && !allowed.includes(key)) fail(`unknown flag --${key}`);
  }
  for (const key of required) {
    if (flags[key] === undefined) fail(`missing required flag --${key}`);
  }
}

function galleryDir(flags) {
  return resolve(flags.dir ?? process.env.IDEA_GALLERY_DIR ?? join(".docs", "ideas"));
}

// ---------- frontmatter (flat scalar YAML subset) ----------

const FM_KEYS = [
  "id",
  "name",
  "description",
  "status",
  "origin",
  "captured",
  "context",
  "updated",
  "resolved_by",
  "resolution_note",
];

function serialize(fm, body) {
  const lines = ["---"];
  for (const key of FM_KEYS) {
    if (fm[key] === undefined) continue;
    const v = fm[key];
    lines.push(typeof v === "number" ? `${key}: ${v}` : `${key}: ${JSON.stringify(String(v))}`);
  }
  lines.push("---", "");
  return lines.join("\n") + body.replace(/^\n+/, "");
}

function parse(text, file) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) fail(`${file}: missing frontmatter`, 1);
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const kv = line.match(/^([a-z_]+): (.*)$/);
    if (!kv) fail(`${file}: unparseable frontmatter line: ${line}`, 1);
    const [, key, raw] = kv;
    if (!FM_KEYS.includes(key)) fail(`${file}: unknown frontmatter key '${key}'`, 1);
    fm[key] = raw.startsWith('"') ? JSON.parse(raw) : Number(raw);
  }
  for (const key of ["id", "name", "description", "status", "origin", "captured"]) {
    if (fm[key] === undefined) fail(`${file}: frontmatter missing '${key}'`, 1);
  }
  if (!STATUSES.includes(fm.status)) fail(`${file}: invalid status '${fm.status}'`, 1);
  return { fm, body: text.slice(m[0].length) };
}

// ---------- storage ----------

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => FILE_RE.test(f))
    .sort()
    .map((f) => ({ file: f, id: Number(f.match(FILE_RE)[1]), path: join(dir, f) }));
}

function loadAll(dir) {
  return listFiles(dir).map((e) => ({ ...e, ...parse(readFileSync(e.path, "utf8"), e.file) }));
}

function findById(dir, rawId) {
  if (!/^\d+$/.test(String(rawId))) fail(`'${rawId}' is not a numeric idea id`);
  const id = Number(rawId);
  const entry = listFiles(dir).find((e) => e.id === id);
  if (!entry) fail(`idea ${rawId} not found in ${dir}`, 2);
  return { ...entry, ...parse(readFileSync(entry.path, "utf8"), entry.file) };
}

function save(entry, fm, body) {
  writeFileSync(entry.path, serialize(fm, body), "utf8");
}

function appendNote(body, line) {
  const entry = `- ${today()}: ${line}`;
  const m = body.match(/^## Notes\s*$/m);
  if (!m) return `${body.replace(/\s+$/, "")}\n\n## Notes\n\n${entry}\n`;
  const start = m.index + m[0].length;
  const rest = body.slice(start);
  const next = rest.search(/^#{1,2} /m);
  if (next === -1) return `${body.replace(/\s+$/, "")}\n${entry}\n`;
  const at = start + next;
  return `${body.slice(0, at).replace(/\s+$/, "")}\n${entry}\n\n${body.slice(at)}`;
}

// ---------- commands ----------

function cmdList(dir, flags) {
  requireFlags(flags, ["all", "status"], []);
  if (flags.all && flags.status) fail("--all and --status are mutually exclusive");
  if (flags.status && !STATUSES.includes(flags.status)) fail(`invalid status '${flags.status}'`);
  const wanted = flags.all ? null : (flags.status ?? "active");
  const ideas = loadAll(dir).filter((i) => wanted === null || i.fm.status === wanted);
  if (ideas.length === 0) {
    process.stdout.write(`No ${wanted ?? ""} ideas.\n`.replace("  ", " "));
    return;
  }
  for (const i of ideas) {
    const tag = wanted === null || wanted !== "active" ? ` [${i.fm.status}]` : "";
    process.stdout.write(`${String(i.id).padStart(4, "0")}  ${i.fm.name}${tag} — ${i.fm.description}\n`);
  }
}

function cmdRead(dir, positional) {
  const [id] = positional;
  if (!id) fail("usage: read <id>");
  const idea = findById(dir, id);
  process.stdout.write(readFileSync(idea.path, "utf8"));
}

function cmdAdd(dir, flags) {
  requireFlags(flags, ["name", "description", "origin", "body", "body-file", "context"], [
    "name",
    "description",
    "origin",
  ]);
  if ((flags.body === undefined) === (flags["body-file"] === undefined)) {
    fail("provide exactly one of --body or --body-file");
  }
  if (!ORIGINS.includes(flags.origin)) {
    fail(`--origin must be one of: ${ORIGINS.join(", ")} (ideas must come from the user)`);
  }
  if (flags.description.length > MAX_DESCRIPTION) {
    fail(`description is ${flags.description.length} chars; max ${MAX_DESCRIPTION}. Shorten it.`);
  }
  const slug = slugify(flags.name);
  if (!slug) fail("--name produces an empty slug; use letters/digits");
  const existing = loadAll(dir);
  const clash = existing.find((i) => i.fm.name === slug && i.fm.status === "active");
  if (clash) {
    fail(`active idea ${String(clash.id).padStart(4, "0")} already uses '${slug}'. ` +
      `If this is the same idea, extend it with: note ${clash.id} --text "..."`);
  }
  const body = flags["body-file"] !== undefined
    ? readFileSync(resolve(flags["body-file"]), "utf8")
    : flags.body;
  if (!body.trim()) fail("idea body is empty");
  const id = existing.reduce((max, i) => Math.max(max, i.id), 0) + 1;
  const fm = {
    id,
    name: slug,
    description: flags.description,
    status: "active",
    origin: flags.origin,
    captured: today(),
    ...(flags.context !== undefined ? { context: flags.context } : {}),
    updated: today(),
  };
  mkdirSync(dir, { recursive: true });
  const file = `${String(id).padStart(4, "0")}-${slug}.md`;
  writeFileSync(join(dir, file), serialize(fm, `# ${flags.name}\n\n${body.trim()}\n`), "utf8");
  process.stdout.write(`Added idea ${String(id).padStart(4, "0")}: ${join(dir, file)}\n`);
}

function cmdNote(dir, positional, flags) {
  requireFlags(flags, ["text", "context"], ["text"]);
  const [id] = positional;
  if (!id) fail("usage: note <id> --text <t> [--context <c>]");
  const idea = findById(dir, id);
  if (idea.fm.status !== "active") {
    fail(`idea ${id} is '${idea.fm.status}'; notes only append to active ideas. ` +
      `Reopen first: status ${id} --set active --note "..."`);
  }
  const line = flags.context !== undefined ? `(${flags.context}) ${flags.text}` : flags.text;
  const fm = { ...idea.fm, updated: today() };
  save(idea, fm, appendNote(idea.body, line));
  process.stdout.write(`Noted idea ${String(idea.id).padStart(4, "0")}.\n`);
}

function cmdStatus(dir, positional, flags) {
  requireFlags(flags, ["set", "change", "note"], ["set"]);
  const [id] = positional;
  if (!id) fail("usage: status <id> --set <status> [--change <id>] [--note <n>]");
  const target = flags.set;
  if (!STATUSES.includes(target)) fail(`--set must be one of: ${STATUSES.join(", ")}`);
  const idea = findById(dir, id);
  const from = idea.fm.status;
  if (from === target) fail(`idea ${id} is already '${target}'`);
  if (target === "done" && flags.change === undefined) {
    fail("closing as done requires --change <change-id> (which change implemented it)");
  }
  if ((target === "rejected" || target === "expired") && flags.note === undefined) {
    fail(`closing as ${target} requires --note (why)`);
  }
  if (target === "active" && flags.note === undefined) {
    fail("reopening requires --note (why it is revived)");
  }
  const fm = { ...idea.fm, status: target, updated: today() };
  delete fm.resolved_by;
  delete fm.resolution_note;
  if (target === "done") fm.resolved_by = flags.change;
  if (target === "rejected" || target === "expired") fm.resolution_note = flags.note;
  const detail = [
    flags.change !== undefined ? `change: ${flags.change}` : null,
    flags.note !== undefined ? flags.note : null,
  ].filter(Boolean).join(" — ");
  const audit = `status ${from} -> ${target}${detail ? ` (${detail})` : ""}`;
  save(idea, fm, appendNote(idea.body, audit));
  process.stdout.write(`Idea ${String(idea.id).padStart(4, "0")}: ${from} -> ${target}\n`);
}

// ---------- main ----------

const HELP = `idea-gallery — manage the user's Idea Gallery (run from the repo root)

  list   [--all | --status <active|done|rejected|expired>]   default: active only
  read   <id>                                                full idea file
  add    --name <n> --description <d<=200 chars> --origin <user|user-endorsed>
         (--body <md> | --body-file <path>) [--context <c>]
  note   <id> --text <t> [--context <c>]                     append-only refinement
  status <id> --set <done|rejected|expired|active>
         done: --change required | rejected/expired/active(reopen): --note required

Gallery dir: --dir <path> > IDEA_GALLERY_DIR env > .docs/ideas
Only capture ideas the user stated or explicitly endorsed. Never agent-invented.`;

function main() {
  const argv = process.argv.slice(2);
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help") {
    process.stdout.write(HELP + "\n");
    return;
  }
  const { positional, flags } = parseArgs(rest);
  const dir = galleryDir(flags);
  switch (command) {
    case "list": cmdList(dir, flags); break;
    case "read": cmdRead(dir, positional); break;
    case "add": cmdAdd(dir, flags); break;
    case "note": cmdNote(dir, positional, flags); break;
    case "status": cmdStatus(dir, positional, flags); break;
    default: fail(`unknown command '${command}'. Run: idea-gallery.mjs help`);
  }
}

main();
