#!/usr/bin/env node
/**
 * skill-vault — keep a project in sync with the skills vault.
 *
 * Machine-agnostic: the vault resolves from
 *   1. --vault <path>
 *   2. SKILLS_VAULT_DIR
 *   3. ~/.skills-vault.json  (per-machine, written by `where --set`, never committed)
 *
 * Project-agnostic: the project is the nearest ancestor with skills-lock.json; the
 * installer runs through the project's own package manager.
 *
 * Commands: where, status, verify, pull, commit, push, new.
 * Exit codes: 0 ok, 1 validation/usage/drift, 2 vault not found.
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONFIG_PATH = join(homedir(), ".skills-vault.json");
const INSTALL_DIRS = [
  ".agents/skills",
  ".claude/skills",
  ".cursor/skills",
  ".opencode/skills",
  ".codex/skills",
  ".github/skills",
];
const SKIP_DIRS = new Set(["node_modules", ".git", "__pycache__", ".venv"]);
const TEXT_EXT = new Set([".md", ".mjs", ".js", ".cjs", ".ts", ".json", ".txt", ".yml", ".yaml", ".sh", ".py"]);

function fail(msg, code = 1) {
  process.stderr.write(`skill-vault: ${msg}\n`);
  process.exit(code);
}

function note(msg) {
  process.stdout.write(`${msg}\n`);
}

// ---------- argv ----------

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const isFlag = a.startsWith("--") || /^-[A-Za-z]$/.test(a);
    if (!isFlag) {
      positional.push(a);
      continue;
    }
    const key = a.startsWith("--") ? a.slice(2) : a.slice(1);
    if (key === "all") {
      flags.all = true;
      continue;
    }
    if (key === "dry-run") {
      flags["dry-run"] = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) fail(`flag --${key} needs a value`);
    if (flags[key] !== undefined) fail(`duplicate flag --${key}`);
    flags[key] = value;
    i++;
  }
  return { positional, flags };
}

function requireFlags(flags, allowed, required) {
  const boolean = new Set(["all", "dry-run"]);
  for (const key of Object.keys(flags)) {
    if (key !== "vault" && !boolean.has(key) && !allowed.includes(key)) fail(`unknown flag --${key}`);
  }
  for (const key of required) {
    if (flags[key] === undefined) fail(`missing required flag --${key}`);
  }
}

// ---------- paths ----------

function findProjectRoot(start) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "skills-lock.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readConfig() {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return readJson(CONFIG_PATH);
  } catch {
    fail(`${CONFIG_PATH} is not valid JSON; fix it or delete it`);
  }
}

function resolveVault(flags, { mustExist = true } = {}) {
  const fromFlag = flags.vault;
  const fromEnv = process.env.SKILLS_VAULT_DIR;
  const fromConfig = readConfig().vault;
  const path = fromFlag ?? fromEnv ?? fromConfig;
  const origin = fromFlag ? "--vault" : fromEnv ? "SKILLS_VAULT_DIR" : fromConfig ? CONFIG_PATH : null;
  if (!path) {
    if (!mustExist) return null;
    fail(
      "no vault clone configured on this PC. Run:\n" +
        "  skill-vault.mjs where --set <path-to-vault-clone>\n" +
        "or set SKILLS_VAULT_DIR, or pass --vault <path>.",
      2,
    );
  }
  const dir = resolve(path);
  if (!existsSync(dir)) fail(`vault path does not exist: ${dir} (from ${origin})`, 2);
  if (!existsSync(join(dir, "skills"))) fail(`${dir} has no skills/ directory (from ${origin})`, 2);
  if (!existsSync(join(dir, ".git"))) fail(`${dir} is not a git repository (from ${origin})`, 2);
  return { path: dir, origin };
}

// ---------- git ----------

function git(dir, args) {
  return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function tryGit(dir, args) {
  try {
    return git(dir, args);
  } catch {
    return null;
  }
}

function vaultState(vault) {
  const branch = tryGit(vault, ["rev-parse", "--abbrev-ref", "HEAD"]) ?? "?";
  const dirty = (tryGit(vault, ["status", "--porcelain"]) ?? "").split("\n").filter(Boolean).length;
  const upstreamRef = tryGit(vault, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  const remote = tryGit(vault, ["remote", "get-url", "origin"]);
  let ahead = null;
  let behind = null;
  if (upstreamRef) {
    const counts = tryGit(vault, ["rev-list", "--count", "--left-right", "@{u}...HEAD"]);
    if (counts) {
      const [b, a] = counts.split(/\s+/).map(Number);
      behind = b;
      ahead = a;
    }
  }
  return { branch, dirty, upstreamRef, remote, ahead, behind };
}

function headCommit(vault) {
  return tryGit(vault, ["rev-parse", "HEAD"]);
}

function normalizeRemote(url) {
  if (!url) return null;
  const m = String(url).match(/github\.com[:/]+([^/]+)\/([^/]+?)(?:\.git)?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Accepts a GitHub URL, a `owner/repo` slug, or nothing. */
function sourceName(source) {
  if (!source) return null;
  return (normalizeRemote(source) ?? source).toLowerCase();
}

/** The vault's own identity, so skills installed from another repo are not compared. */
function vaultSource(vault, lock) {
  return sourceName(vaultState(vault.path).remote) ?? sourceName(lockSource(lock));
}

// ---------- lock / installs ----------

function loadLock(projectRoot) {
  if (!projectRoot) return null;
  const lock = readJson(join(projectRoot, "skills-lock.json"));
  return lock?.skills ? lock : fail(`${join(projectRoot, "skills-lock.json")} has no 'skills' map`);
}

function lockSource(lock) {
  const counts = new Map();
  for (const entry of Object.values(lock?.skills ?? {})) {
    if (entry?.source) counts.set(entry.source, (counts.get(entry.source) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function installedDirs(projectRoot, lock) {
  const names = Object.keys(lock?.skills ?? {});
  return INSTALL_DIRS.map((rel) => {
    const dir = join(projectRoot, rel);
    if (!existsSync(dir)) return null;
    const matches = names.filter((n) => existsSync(join(dir, n, "SKILL.md"))).length;
    return matches > 0 ? { rel, dir, matches } : null;
  }).filter(Boolean).sort((a, b) => b.matches - a.matches);
}

function detectPM(projectRoot) {
  const pkgPath = join(projectRoot, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = readJson(pkgPath);
      const declared = pkg.packageManager ?? pkg.devEngines?.packageManager?.name;
      if (typeof declared === "string" && declared) {
        const name = declared.split("@")[0];
        if (["pnpm", "npm", "yarn", "bun"].includes(name)) return name;
      }
    } catch {
      /* fall through to lockfiles */
    }
  }
  const lockfiles = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lockb", "bun"],
    ["bun.lock", "bun"],
    ["package-lock.json", "npm"],
  ];
  for (const [file, pm] of lockfiles) {
    if (existsSync(join(projectRoot, file))) return pm;
  }
  return "npm";
}

function installerPrefix(pm) {
  switch (pm) {
    case "pnpm":
      return "pnpm dlx skills@latest";
    case "yarn":
      return "yarn dlx skills@latest";
    case "bun":
      return "bunx skills@latest";
    default:
      return "npx -y skills@latest";
  }
}

// ---------- file comparison ----------

function walkFiles(root) {
  const out = new Map();
  const visit = (dir) => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) visit(full);
      else out.set(relative(root, full).split("\\").join("/"), full);
    }
  };
  visit(root);
  return out;
}

function normalizeContent(path) {
  const raw = readFileSync(path);
  if (!TEXT_EXT.has(path.slice(path.lastIndexOf(".")).toLowerCase())) return raw;
  return Buffer.from(raw.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
}

function diffSkill(vaultSkillDir, installedDir) {
  if (!existsSync(vaultSkillDir)) return { state: "missing-in-vault", files: [] };
  if (!existsSync(installedDir)) return { state: "not-installed", files: [] };
  const a = walkFiles(vaultSkillDir);
  const b = walkFiles(installedDir);
  const files = [];
  for (const [rel, path] of a) {
    if (!b.has(rel)) files.push(`${rel} (missing)`);
    else if (!normalizeContent(path).equals(normalizeContent(b.get(rel)))) files.push(`${rel} (differs)`);
  }
  for (const rel of b.keys()) if (!a.has(rel)) files.push(`${rel} (extra)`);
  return { state: files.length ? "differs" : "in-sync", files };
}

function skillNames(vaultDocs) {
  const dir = join(vaultDocs, "skills");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => existsSync(join(dir, n, "SKILL.md")))
    .sort();
}

// ---------- commands ----------

function cmdWhere(positional, flags) {
  requireFlags(flags, ["set"], []);
  if (positional.length) fail("where takes no positional arguments");
  if (flags.set !== undefined) {
    const target = resolve(flags.set);
    if (!existsSync(target)) fail(`path does not exist: ${target}`);
    if (!existsSync(join(target, "skills"))) fail(`${target} has no skills/ directory`);
    if (!existsSync(join(target, ".git"))) fail(`${target} is not a git repository`);
    writeFileSync(CONFIG_PATH, `${JSON.stringify({ vault: target }, null, 2)}\n`, "utf8");
    note(`Saved vault: ${target}`);
    note(`Config: ${CONFIG_PATH}`);
  }
  const vault = resolveVault(flags);
  const state = vaultState(vault.path);
  const projectRoot = findProjectRoot(process.cwd());
  const expected = projectRoot ? normalizeRemote(lockSource(loadLock(projectRoot))) : null;
  const actual = normalizeRemote(state.remote);
  note(`Vault:  ${vault.path}  (from ${vault.origin})`);
  note(`Remote: ${state.remote ?? "none"}${actual ? ` = ${actual}` : ""}`);
  if (expected && actual && expected !== actual) {
    process.stderr.write(`skill-vault: warning: vault remote ${actual} does not match skills-lock.json source ${expected}\n`);
  }
}

function cmdStatus(flags) {
  requireFlags(flags, [], []);
  const projectRoot = findProjectRoot(process.cwd()) ?? fail("not inside a project with skills-lock.json");
  const lock = loadLock(projectRoot);
  const pm = detectPM(projectRoot);
  const vault = resolveVault(flags, { mustExist: false });

  if (vault) {
    const state = vaultState(vault.path);
    note(`vault     ${vault.path}  (${state.branch}${state.upstreamRef ? "" : ", no upstream"})`);
    note(
      `          remote=${normalizeRemote(state.remote) ?? "none"}  ahead=${state.ahead ?? "?"}  ` +
        `behind=${state.behind ?? "?"}  dirty=${state.dirty}`,
    );
  } else {
    note("vault     none on this PC (run `where --set <path>`; pull/verify still work from the lock)");
  }

  const dirs = installedDirs(projectRoot, lock);
  note(`project   ${projectRoot}`);
  note(`          pm=${pm}  installer="${installerPrefix(pm)}"  lock=${Object.keys(lock.skills).length} skills`);
  note(`          installed in: ${dirs.length ? dirs.map((d) => `${d.rel} (${d.matches})`).join(", ") : "none detected"}`);

  if (!vault || !dirs.length) return;
  const vaultId = vaultSource(vault, lock);
  for (const name of Object.keys(lock.skills).sort()) {
    const entrySource = sourceName(lock.skills[name].source);
    if (entrySource && vaultId && entrySource !== vaultId) {
      note(`          ${name.padEnd(24)} OTHER SOURCE (${lock.skills[name].source})`);
      continue;
    }
    const results = dirs.map((d) => diffSkill(join(vault.path, "skills", name), join(d.dir, name)));
    const label = results.every((r) => r.state === "in-sync")
      ? "IN SYNC"
      : results.map((r, i) => `${dirs[i].rel}:${r.state}`).join(" ");
    note(`          ${name.padEnd(24)} ${label}`);
  }
}

function cmdVerify(positional, flags) {
  requireFlags(flags, ["skill"], []);
  if (positional.length) fail("verify takes no positional arguments; use --skill <name>");
  const projectRoot = findProjectRoot(process.cwd()) ?? fail("not inside a project with skills-lock.json");
  const lock = loadLock(projectRoot);
  const vault = resolveVault(flags);
  const dirs = installedDirs(projectRoot, lock);
  if (!dirs.length) fail(`no installed skills found under ${INSTALL_DIRS.join(", ")}`);

  const targets = flags.skill ? [flags.skill] : Object.keys(lock.skills).sort();
  const vaultId = vaultSource(vault, lock);

  let drifted = 0;
  for (const name of targets) {
    if (!SKILL_NAME_RE.test(name)) fail(`invalid skill name '${name}'`);
    const entry = lock.skills[name];
    const entrySource = sourceName(entry?.source);
    if (entrySource && vaultId && entrySource !== vaultId) {
      note(`${name.padEnd(28)} OTHER SOURCE (${entry.source}) — not compared with this vault`);
      continue;
    }
    if (!entry && !existsSync(join(vault.path, "skills", name))) {
      fail(`skill '${name}' is neither in skills-lock.json nor in the vault`, 2);
    }
    for (const d of dirs) {
      const result = diffSkill(join(vault.path, "skills", name), join(d.dir, name));
      if (result.state === "in-sync") {
        note(`${name.padEnd(28)} IN SYNC   (${d.rel})`);
        continue;
      }
      drifted++;
      note(`${name.padEnd(28)} ${result.state.toUpperCase()}   (${d.rel})`);
      for (const f of result.files.slice(0, 10)) note(`  - ${f}`);
      if (result.files.length > 10) note(`  - ... ${result.files.length - 10} more`);
    }
  }

  const state = vaultState(vault.path);
  if (state.behind > 0) note(`\nnote: vault clone is behind origin by ${state.behind}; fast-forward before trusting this comparison.`);
  if (state.ahead > 0) note(`\nnote: vault has ${state.ahead} unpushed commit(s); GitHub installs cannot see them.`);

  if (drifted) {
    process.stderr.write(
      "\nskill-vault: drift found. Installed copies are generated — fix the vault copy, commit, push, then pull.\n",
    );
    process.exit(1);
  }
}

function cmdPull(positional, flags) {
  requireFlags(flags, ["skill"], []);
  if (positional.length) fail("pull takes no positional arguments; use --skill <name>");
  const projectRoot = findProjectRoot(process.cwd()) ?? fail("not inside a project with skills-lock.json");
  const lock = loadLock(projectRoot);
  const vault = resolveVault(flags);
  const pm = detectPM(projectRoot);
  const prefix = installerPrefix(pm);
  const targets = flags.skill ? [flags.skill] : [];
  for (const name of targets) if (!SKILL_NAME_RE.test(name)) fail(`invalid skill name '${name}'`);

  const state = vaultState(vault.path);
  if (!state.upstreamRef) fail("vault branch has no upstream; set one (git push -u origin <branch>) before pulling");
  if (state.ahead > 0) {
    fail(
      `vault has ${state.ahead} unpushed commit(s); an install from GitHub cannot see them.\n` +
        "  run: skill-vault.mjs push",
    );
  }
  if (state.dirty > 0) {
    process.stderr.write(`skill-vault: warning: vault has ${state.dirty} uncommitted change(s); pulling ignores them\n`);
  }
  if (state.behind > 0) note(`note: vault clone is behind origin by ${state.behind}; installing newest remote content`);

  const source = lockSource(lock);
  const unknown = targets.filter((n) => !lock.skills[n]);
  for (const name of unknown) {
    if (!existsSync(join(vault.path, "skills", name))) fail(`skill '${name}' is not in skills-lock.json nor in the vault`);
    if (!source) fail("skills-lock.json has no source to add a new skill from");
  }

  const commands = [];
  if (unknown.length) {
    commands.push(`${prefix} add ${source} --skill ${unknown.join(" --skill ")} -y`);
  }
  const updates = targets.filter((n) => lock.skills[n]);
  if (!targets.length || updates.length) {
    commands.push(`${prefix} update -p -y${updates.length ? ` ${updates.join(" ")}` : ""}`);
  }

  if (flags["dry-run"]) {
    note("would run:");
    for (const c of commands) note(`  ${c}`);
    return;
  }

  for (const command of commands) {
    note(`> ${command}`);
    try {
      execSync(command, { cwd: projectRoot, stdio: "inherit" });
    } catch {
      fail(`installer failed: ${command}`);
    }
  }

  const head = headCommit(vault.path);
  const after = loadLock(projectRoot);
  note("");
  for (const name of targets.length ? targets : Object.keys(after.skills)) {
    const entry = after.skills[name];
    if (!entry) continue;
    const same = head && entry.commit === head;
    note(`${name.padEnd(28)} lock=${entry.commit?.slice(0, 8) ?? "?"}${same ? " (matches vault HEAD)" : ""}`);
  }
}

function cmdCommit(flags) {
  requireFlags(flags, ["m", "skill"], ["m"]);
  const vault = resolveVault(flags);
  const targets = flags.skill ? [flags.skill] : [];
  for (const name of targets) {
    if (!SKILL_NAME_RE.test(name)) fail(`invalid skill name '${name}'`);
    if (!existsSync(join(vault.path, "skills", name))) fail(`skill '${name}' is not in the vault`, 2);
  }

  const paths = targets.length ? targets.map((n) => join("skills", n)) : ["skills"];
  try {
    git(vault.path, ["add", "--", ...paths]);
  } catch {
    fail(`git add failed for ${paths.join(", ")}`);
  }
  const staged = git(vault.path, ["diff", "--cached", "--name-only"]).split("\n").filter(Boolean);
  if (!staged.length) fail("nothing staged — no changes in the selected path(s)");

  const outside = staged.filter((p) => !p.replace(/\\/g, "/").startsWith("skills/"));
  if (outside.length && !flags.all) {
    fail(
      `staged changes outside skills/ would be committed:\n  ${outside.join("\n  ")}\n` +
        "unstage them (git reset <path>) or pass --all to include them deliberately",
    );
  }

  note(git(vault.path, ["diff", "--cached", "--stat"]));
  git(vault.path, ["commit", "-m", flags.m]);
  note(`\nCommitted ${staged.length} file(s) on ${git(vault.path, ["rev-parse", "--abbrev-ref", "HEAD"])}.`);
  note("Next: push the vault, then `pull` in the project.");
}

function cmdPush(flags) {
  requireFlags(flags, [], []);
  const vault = resolveVault(flags);
  const state = vaultState(vault.path);
  if (!state.upstreamRef) fail("vault branch has no upstream; run: git -C <vault> push -u origin <branch>");
  if (state.behind > 0) {
    fail(
      `vault is behind ${state.upstreamRef} by ${state.behind}; pull/rebase deliberately first (no force-push)`,
    );
  }
  if (state.ahead === 0) {
    note("Nothing to push — vault already matches its upstream.");
    return;
  }
  try {
    execSync("git push", { cwd: vault.path, stdio: "inherit" });
  } catch {
    fail("git push failed");
  }
  const after = vaultState(vault.path);
  note(`\nVault pushed: ahead=${after.ahead} (0 = remote matches). Next: pull in the project.`);
}

function cmdNew(positional, flags) {
  requireFlags(flags, ["description"], ["description"]);
  const [rawName] = positional;
  if (!rawName) fail("usage: new <name> --description <when-to-use>");
  const name = rawName.toLowerCase();
  if (!SKILL_NAME_RE.test(name)) fail(`'${rawName}' is not lowercase kebab-case (e.g. 'skill-vault')`);
  const vault = resolveVault(flags);
  const dir = join(vault.path, "skills", name);
  if (existsSync(dir)) fail(`${dir} already exists`, 2);

  mkdirSync(dir, { recursive: true });
  const title = name.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  writeFileSync(
    join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${JSON.stringify(flags.description)}\n---\n\n# ${title}\n\nTODO: instructions.\n`,
    "utf8",
  );
  note(`Created ${dir}/SKILL.md`);
  note("Fill it in, then: commit -m \"feat(" + name + "): add skill\" → push → pull --skill " + name);
}

// ---------- main ----------

const HELP = `skill-vault — keep a project in sync with the skills vault

  where  [--set <path>]                       resolve/configure the vault clone
  status                                      vault git state, project PM, per-skill drift
  verify [--skill <name>]                     read-only drift check (exit 1 on drift)
  pull   [--skill <name>] [--dry-run]         install/update project skills via the detected PM
  commit -m <message> [--skill <name>] [--all]  commit vault skill changes (local only)
  push                                        push the vault branch (never forced)
  new    <name> --description <d>             scaffold a vault skill

  --vault <path> is accepted by every command.

Vault resolution: --vault > SKILLS_VAULT_DIR > ~/.skills-vault.json
Installed copies are generated: edit the vault, commit, push, then pull.`;

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") {
    note(HELP);
    return;
  }
  const { positional, flags } = parseArgs(rest);
  switch (command) {
    case "where":
      cmdWhere(positional, flags);
      break;
    case "status":
      cmdStatus(flags);
      break;
    case "verify":
      cmdVerify(positional, flags);
      break;
    case "pull":
      cmdPull(positional, flags);
      break;
    case "commit":
      cmdCommit(flags);
      break;
    case "push":
      cmdPush(flags);
      break;
    case "new":
      cmdNew(positional, flags);
      break;
    default:
      fail(`unknown command '${command}'. Run: skill-vault.mjs help`);
  }
}

main();
