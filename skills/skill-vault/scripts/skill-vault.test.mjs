/**
 * skill-vault — regression tests (zero dependency, node:test).
 *
 * Run: node --test scripts/skill-vault.test.mjs
 *
 * Every test builds real git repos in a temp directory and drives the CLI as a
 * subprocess. No network, no sleeps, no mocks of git.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "skill-vault.mjs");
const GIT_ENV = {
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function git(dir, ...args) {
  return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", env: { ...process.env, ...GIT_ENV } }).trim();
}

function tmp(prefix) {
  return mkdtempSync(join(tmpdir(), `skill-vault-${prefix}-`));
}

/** A vault clone with one skill, optionally pushed to a bare origin. */
function makeVault({ remote = false } = {}) {
  const root = tmp("vault");
  const vault = join(root, "MySkills");
  mkdirSync(join(vault, "skills", "demo"), { recursive: true });
  writeFileSync(
    join(vault, "skills", "demo", "SKILL.md"),
    "---\nname: demo\ndescription: demo skill\n---\n\n# Demo\n\nOriginal.\n",
  );
  writeFileSync(join(vault, "README.md"), "# Vault\n");
  git(vault, "init", "-b", "main");
  git(vault, "add", "-A");
  git(vault, "commit", "-m", "init");
  if (remote) {
    const bare = join(root, "origin.git");
    git(root, "init", "--bare", "-b", "main", bare);
    git(vault, "remote", "add", "origin", bare);
    git(vault, "push", "-u", "origin", "main");
  }
  return { root, vault };
}

/** A project with a lock entry and an installed copy for `demo`. */
function makeProject(vault) {
  const project = tmp("project");
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "p", packageManager: "pnpm@12.18.0" }, null, 2));
  writeFileSync(
    join(project, "skills-lock.json"),
    JSON.stringify(
      {
        version: 2,
        skills: {
          demo: {
            source: "Ginushmal/MySkills",
            commit: git(vault, "rev-parse", "HEAD"),
            sourceType: "github",
            skillPath: "skills/demo/SKILL.md",
            computedHash: "x",
          },
        },
      },
      null,
      2,
    ),
  );
  cpSync(join(vault, "skills", "demo"), join(project, ".agents", "skills", "demo"), { recursive: true });
  return project;
}

function run(args, { cwd, vault, home, env = {} }) {
  const base = { ...process.env, ...GIT_ENV, HOME: home, USERPROFILE: home, ...env };
  if (vault) base.SKILLS_VAULT_DIR = vault;
  else delete base.SKILLS_VAULT_DIR;
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd, env: base, encoding: "utf8" });
}

function withSetup(options = {}) {
  const { vault, root } = makeVault(options);
  const project = makeProject(vault);
  const home = tmp("home");
  const cleanup = () => {
    rmSync(root, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  };
  return { vault, project, home, cleanup };
}

test("new scaffolds a vault skill with valid frontmatter", () => {
  const { vault, project, home, cleanup } = withSetup();
  try {
    const result = run(["new", "greeter", "--description", "Use when greeting: ever."], { cwd: project, vault, home });
    assert.equal(result.status, 0, result.stderr);
    const text = readFileSync(join(vault, "skills", "greeter", "SKILL.md"), "utf8");
    assert.match(text, /^---\nname: greeter\ndescription: "Use when greeting: ever\."\n---/);
    assert.match(text, /# Greeter/);
  } finally {
    cleanup();
  }
});

test("new rejects a non-kebab name and an existing skill", () => {
  const { vault, project, home, cleanup } = withSetup();
  try {
    const bad = run(["new", "Bad_Name", "--description", "x"], { cwd: project, vault, home });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /kebab-case/);

    const dup = run(["new", "demo", "--description", "x"], { cwd: project, vault, home });
    assert.equal(dup.status, 2);
    assert.match(dup.stderr, /already exists/);

    const noDesc = run(["new", "other"], { cwd: project, vault, home });
    assert.equal(noDesc.status, 1);
    assert.match(noDesc.stderr, /missing required flag --description/);
  } finally {
    cleanup();
  }
});

test("where --set stores per-machine config and the environment still wins", () => {
  const { vault, project, home, cleanup } = withSetup();
  const other = tmp("other-vault");
  try {
    mkdirSync(join(other, "skills"), { recursive: true });
    execFileSync("git", ["init", "-b", "main", other], { env: { ...process.env, ...GIT_ENV } });

    const set = run(["where", "--set", vault], { cwd: project, home });
    assert.equal(set.status, 0, set.stderr);
    const config = JSON.parse(readFileSync(join(home, ".skills-vault.json"), "utf8"));
    assert.equal(resolve(config.vault), resolve(vault));

    const fromConfig = run(["where"], { cwd: project, home });
    assert.equal(fromConfig.status, 0, fromConfig.stderr);
    assert.match(fromConfig.stdout, new RegExp(`Vault:  ${resolve(vault).replace(/\\/g, "\\\\")}`));

    const fromEnv = run(["where"], { cwd: project, home, vault: other });
    assert.ok(fromEnv.stdout.includes("from SKILLS_VAULT_DIR"), fromEnv.stdout);
    assert.ok(fromEnv.stdout.includes(resolve(other)), fromEnv.stdout);
  } finally {
    cleanup();
    rmSync(other, { recursive: true, force: true });
  }
});

test("verify is clean when copies match, including CRLF line endings", () => {
  const { vault, project, home, cleanup } = withSetup();
  try {
    const installed = join(project, ".agents", "skills", "demo", "SKILL.md");
    writeFileSync(installed, readFileSync(installed, "utf8").replace(/\n/g, "\r\n"));

    const result = run(["verify"], { cwd: project, vault, home });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /IN SYNC/);
  } finally {
    cleanup();
  }
});

test("verify exits 1 and names the file when an installed copy drifted", () => {
  const { vault, project, home, cleanup } = withSetup();
  try {
    appendFileSync(join(project, ".agents", "skills", "demo", "SKILL.md"), "\nlocal edit\n");
    const result = run(["verify"], { cwd: project, vault, home });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /DIFFERS/);
    assert.match(result.stdout, /SKILL\.md \(differs\)/);
    assert.match(result.stderr, /drift found/);
  } finally {
    cleanup();
  }
});

test("verify reports a skill that is installed but missing from the vault", () => {
  const { vault, project, home, cleanup } = withSetup();
  try {
    const lock = JSON.parse(readFileSync(join(project, "skills-lock.json"), "utf8"));
    lock.skills.ghost = { ...lock.skills.demo };
    writeFileSync(join(project, "skills-lock.json"), JSON.stringify(lock, null, 2));
    mkdirSync(join(project, ".agents", "skills", "ghost"), { recursive: true });
    writeFileSync(join(project, ".agents", "skills", "ghost", "SKILL.md"), "# ghost\n");

    const result = run(["verify"], { cwd: project, vault, home });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /MISSING-IN-VAULT/);
  } finally {
    cleanup();
  }
});

test("commit refuses an empty change and commits skill changes with -m", () => {
  const { vault, project, home, cleanup } = withSetup();
  try {
    const empty = run(["commit", "-m", "noop"], { cwd: project, vault, home });
    assert.equal(empty.status, 1);
    assert.match(empty.stderr, /nothing staged/);

    appendFileSync(join(vault, "skills", "demo", "SKILL.md"), "\nRefined.\n");
    const committed = run(["commit", "-m", "docs(demo): refine", "--skill", "demo"], { cwd: project, vault, home });
    assert.equal(committed.status, 0, committed.stderr);
    assert.match(git(vault, "log", "-1", "--pretty=%s"), /docs\(demo\): refine/);
  } finally {
    cleanup();
  }
});

test("commit refuses staged files outside skills/ unless --all", () => {
  const { vault, project, home, cleanup } = withSetup();
  try {
    appendFileSync(join(vault, "skills", "demo", "SKILL.md"), "\nchange\n");
    appendFileSync(join(vault, "README.md"), "\nreadme change\n");
    git(vault, "add", "README.md");

    const refused = run(["commit", "-m", "mixed"], { cwd: project, vault, home });
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /outside skills\//);

    const allowed = run(["commit", "-m", "mixed", "--all"], { cwd: project, vault, home });
    assert.equal(allowed.status, 0, allowed.stderr);
    const files = git(vault, "show", "--name-only", "--pretty=", "HEAD").split("\n").filter(Boolean).sort();
    assert.deepEqual(files, ["README.md", "skills/demo/SKILL.md"]);
  } finally {
    cleanup();
  }
});

test("pull --dry-run prints the installer command without running it", () => {
  const { vault, project, home, cleanup } = withSetup({ remote: true });
  try {
    const result = run(["pull", "--dry-run"], { cwd: project, vault, home });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /pnpm dlx skills@latest update -p -y/);
  } finally {
    cleanup();
  }
});

test("pull --dry-run uses add for a vault skill that is not in the lock", () => {
  const { vault, project, home, cleanup } = withSetup({ remote: true });
  try {
    mkdirSync(join(vault, "skills", "fresh"), { recursive: true });
    writeFileSync(join(vault, "skills", "fresh", "SKILL.md"), "---\nname: fresh\ndescription: fresh\n---\n\n# Fresh\n");
    git(vault, "add", "-A");
    git(vault, "commit", "-m", "feat(fresh): add skill");
    git(vault, "push");

    const result = run(["pull", "--skill", "fresh", "--dry-run"], { cwd: project, vault, home });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /add Ginushmal\/MySkills --skill fresh -y/);
  } finally {
    cleanup();
  }
});

test("pull refuses while the vault has unpushed commits", () => {
  const { vault, project, home, cleanup } = withSetup({ remote: true });
  try {
    appendFileSync(join(vault, "skills", "demo", "SKILL.md"), "\nlocal only\n");
    git(vault, "add", "-A");
    git(vault, "commit", "-m", "local only");

    const result = run(["pull", "--dry-run"], { cwd: project, vault, home });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unpushed commit/);
    assert.match(result.stderr, /skill-vault\.mjs push/);
  } finally {
    cleanup();
  }
});

test("push does nothing when the vault already matches its upstream", () => {
  const { vault, project, home, cleanup } = withSetup({ remote: true });
  try {
    const result = run(["push"], { cwd: project, vault, home });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Nothing to push/);
  } finally {
    cleanup();
  }
});

test("status reports the vault, the detected package manager and per-skill state", () => {
  const { vault, project, home, cleanup } = withSetup();
  try {
    const result = run(["status"], { cwd: project, vault, home });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /vault {5}/);
    assert.match(result.stdout, /pm=pnpm/);
    assert.match(result.stdout, /pnpm dlx skills@latest/);
    assert.match(result.stdout, /demo.*IN SYNC/);
  } finally {
    cleanup();
  }
});

test("status explains that no vault is configured on this PC", () => {
  const { project, home, cleanup } = withSetup();
  try {
    const result = run(["status"], { cwd: project, home });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /none on this PC/);
    assert.match(result.stdout, /pm=pnpm/);
  } finally {
    cleanup();
  }
});

test("commands that write to the vault fail with setup guidance when no vault is configured", () => {
  const { project, home, cleanup } = withSetup();
  try {
    const result = run(["commit", "-m", "x"], { cwd: project, home });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /no vault clone configured/);
    assert.match(result.stderr, /where --set/);
  } finally {
    cleanup();
  }
});

test("--vault overrides the environment and unknown flags are rejected", () => {
  const one = makeVault();
  const two = makeVault();
  const project = makeProject(one.vault);
  const home = tmp("home");
  try {
    const override = run(["where", "--vault", two.vault], { cwd: project, vault: one.vault, home });
    assert.equal(override.status, 0, override.stderr);
    assert.ok(override.stdout.includes(resolve(two.vault)), override.stdout);

    const unknown = run(["status", "--bogus", "x"], { cwd: project, vault: one.vault, home });
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /unknown flag --bogus/);
  } finally {
    for (const p of [one.root, two.root, project, home]) rmSync(p, { recursive: true, force: true });
  }
});

test("skill names from the vault are listed by verify targets and reject path traversal", () => {
  const { vault, project, home, cleanup } = withSetup();
  try {
    const result = run(["verify", "--skill", "../escape"], { cwd: project, vault, home });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /invalid skill name/);

    const missing = run(["verify", "--skill", "nope"], { cwd: project, vault, home });
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /neither in skills-lock\.json nor in the vault/);
  } finally {
    cleanup();
  }
});

test("verify skips skills installed from a different repository", () => {
  const { vault, project, home, cleanup } = withSetup();
  try {
    const lock = JSON.parse(readFileSync(join(project, "skills-lock.json"), "utf8"));
    lock.skills.external = { ...lock.skills.demo, source: "someone/other-skills" };
    writeFileSync(join(project, "skills-lock.json"), JSON.stringify(lock, null, 2));
    mkdirSync(join(project, ".agents", "skills", "external"), { recursive: true });
    writeFileSync(join(project, ".agents", "skills", "external", "SKILL.md"), "# external\n");

    const result = run(["verify"], { cwd: project, vault, home });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /external\s+OTHER SOURCE \(someone\/other-skills\)/);
  } finally {
    cleanup();
  }
});

test("a project without skills-lock.json is not a project", () => {
  const { vault, home, cleanup } = withSetup();
  const stray = tmp("stray");
  try {
    const result = run(["status"], { cwd: stray, vault, home });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /not inside a project with skills-lock\.json/);
  } finally {
    cleanup();
    rmSync(stray, { recursive: true, force: true });
  }
});

test("installed copies are found in agent directories other than .agents/skills", () => {
  const { vault, project, home, cleanup } = withSetup();
  try {
    cpSync(join(project, ".agents", "skills", "demo"), join(project, ".claude", "skills", "demo"), { recursive: true });
    rmSync(join(project, ".agents"), { recursive: true, force: true });

    const result = run(["verify"], { cwd: project, vault, home });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\.claude\/skills/);
  } finally {
    cleanup();
  }
});

test("no vault clone configured still allows reading the lock", () => {
  const { project, home, cleanup } = withSetup();
  try {
    const result = run(["verify"], { cwd: project, home });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /no vault clone configured/);
    assert.ok(existsSync(join(project, "skills-lock.json")));
  } finally {
    cleanup();
  }
});
