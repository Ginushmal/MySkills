#!/usr/bin/env node
/**
 * Regression tests for the idea-gallery CLI.
 *
 * Zero dependencies: run with `node --test scripts/idea-gallery.test.mjs`.
 * Every case uses a fresh temporary gallery, so the real gallery is never touched.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "idea-gallery.mjs");
const CARD_RE = /^\d{4}-.+\.md$/;

function tempRoot(t) {
  const root = mkdtempSync(join(tmpdir(), "idea-gallery-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeBody(root, text, name = "body.md") {
  const path = join(root, name);
  writeFileSync(path, text, "utf8");
  return path;
}

function run(gallery, args) {
  return spawnSync(process.execPath, [SCRIPT, ...args, "--dir", gallery], {
    encoding: "utf8",
  });
}

function cards(gallery) {
  return existsSync(gallery)
    ? readdirSync(gallery).filter((name) => CARD_RE.test(name))
    : [];
}

function add(gallery, name, bodyPath) {
  return run(gallery, [
    "add",
    "--name",
    name,
    "--description",
    "Test idea.",
    "--origin",
    "user",
    "--body-file",
    bodyPath,
  ]);
}

function h1Lines(text) {
  return text.split(/\r?\n/).filter((line) => /^#\s+\S/.test(line));
}

test("rejects a body whose first non-empty line is an H1", (t) => {
  const root = tempRoot(t);
  const gallery = join(root, "gallery");
  const body = writeBody(root, "# Rate cap dashboard\n\nBody.\n");
  const original = readFileSync(body, "utf8");

  const result = add(gallery, "Rate cap dashboard", body);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must not start with an H1/);
  assert.match(result.stderr, /script writes the card title/);
  assert.equal(existsSync(gallery), false);
  assert.deepEqual(cards(gallery), []);
  assert.equal(readFileSync(body, "utf8"), original);
});

test("rejects a title after leading blank lines", (t) => {
  const root = tempRoot(t);
  const gallery = join(root, "gallery");
  const body = writeBody(root, "\n\n# Rate cap dashboard\n\nBody.\n");

  const result = add(gallery, "Rate cap dashboard", body);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must not start with an H1/);
  assert.deepEqual(cards(gallery), []);
});

test("rejects a title with CRLF line endings", (t) => {
  const root = tempRoot(t);
  const gallery = join(root, "gallery");
  const body = writeBody(root, "# Rate cap dashboard\r\n\r\nBody.\r\n");

  const result = add(gallery, "Rate cap dashboard", body);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must not start with an H1/);
  assert.deepEqual(cards(gallery), []);
});

test("accepts a later H1 and keeps it below the generated title", (t) => {
  const root = tempRoot(t);
  const gallery = join(root, "gallery");
  mkdirSync(gallery);
  const body = writeBody(root, "Intro paragraph.\n\n# Details\n\nBody.\n");

  const result = add(gallery, "Later heading", body);

  assert.equal(result.status, 0);
  const files = cards(gallery);
  assert.equal(files.length, 1);
  const text = readFileSync(join(gallery, files[0]), "utf8");
  const headings = h1Lines(text);
  assert.equal(headings.length, 2);
  assert.equal(headings[0], "# Later heading");
  assert.equal(headings[1], "# Details");
});

test("accepts an H2 opening as body content", (t) => {
  const root = tempRoot(t);
  const gallery = join(root, "gallery");
  mkdirSync(gallery);
  const body = writeBody(root, "## Requirements\n\n- one\n");

  const result = add(gallery, "H2 opening", body);

  assert.equal(result.status, 0);
  const files = cards(gallery);
  assert.equal(files.length, 1);
  const text = readFileSync(join(gallery, files[0]), "utf8");
  assert.equal(h1Lines(text).length, 1);
  assert.match(text, /## Requirements/);
});

test("writes exactly one H1 for a clean body", (t) => {
  const root = tempRoot(t);
  const gallery = join(root, "gallery");
  mkdirSync(gallery);
  const body = writeBody(root, "A short idea.\n");

  const result = add(gallery, "Clean idea", body);

  assert.equal(result.status, 0);
  const files = cards(gallery);
  assert.equal(files.length, 1);
  const text = readFileSync(join(gallery, files[0]), "utf8");
  const headings = h1Lines(text);
  assert.deepEqual(headings, ["# Clean idea"]);
});

test("does not treat a hashtag as an H1", (t) => {
  const root = tempRoot(t);
  const gallery = join(root, "gallery");
  mkdirSync(gallery);
  const body = writeBody(root, "#hashtag is not a heading\n");

  const result = add(gallery, "Hashtag idea", body);

  assert.equal(result.status, 0);
  assert.equal(cards(gallery).length, 1);
});

test("rejection consumes no idea id", (t) => {
  const root = tempRoot(t);
  const gallery = join(root, "gallery");
  mkdirSync(gallery);
  const titled = writeBody(root, "# Rejected idea\n\nBody.\n", "titled.md");
  const clean = writeBody(root, "A clean idea.\n", "clean.md");

  const rejected = add(gallery, "Rejected idea", titled);
  assert.equal(rejected.status, 1);
  assert.deepEqual(cards(gallery), []);

  const accepted = add(gallery, "Clean idea", clean);
  assert.equal(accepted.status, 0);
  const files = cards(gallery);
  assert.equal(files.length, 1);
  assert.match(files[0], /^0001-/);
});
