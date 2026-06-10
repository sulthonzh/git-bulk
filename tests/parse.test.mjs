import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findRepos,
  resolveRepos,
  parseArgs,
  repoStatus,
  repoBranch,
  formatStatus,
  formatJSON,
  formatMarkdown,
  COMMANDS,
  HELP,
} from "../src.js";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// --- findRepos ---

describe("findRepos", () => {
  it("finds git repos at depth 1", () => {
    const base = mkdtempSync(join(tmpdir(), "gb-"));
    const repo1 = join(base, "repo1");
    mkdirSync(join(repo1, ".git"), { recursive: true });
    mkdirSync(join(base, "not-a-repo"), { recursive: true });
    const repos = findRepos(base);
    assert.deepEqual(repos, [repo1]);
  });

  it("finds repos at depth 2", () => {
    const base = mkdtempSync(join(tmpdir(), "gb-"));
    const nested = join(base, "org", "my-repo");
    mkdirSync(join(nested, ".git"), { recursive: true });
    const repos = findRepos(base, { depth: 2 });
    assert.equal(repos.length, 1);
    assert.ok(repos[0].endsWith("my-repo"));
  });

  it("respects ignore list", () => {
    const base = mkdtempSync(join(tmpdir(), "gb-"));
    mkdirSync(join(base, "node_modules", "pkg", ".git"), { recursive: true });
    mkdirSync(join(base, "my-repo", ".git"), { recursive: true });
    const repos = findRepos(base, { ignore: ["node_modules"] });
    assert.equal(repos.length, 1);
    assert.ok(repos[0].endsWith("my-repo"));
  });
});

// --- resolveRepos ---

describe("resolveRepos", () => {
  it("uses explicit repos when provided", () => {
    const result = resolveRepos({ repos: ["/a", "/b"] });
    assert.equal(result.length, 2);
    assert.ok(result[0].endsWith("/a"));
  });

  it("falls back to findRepos", () => {
    const base = mkdtempSync(join(tmpdir(), "gb-"));
    mkdirSync(join(base, "r", ".git"), { recursive: true });
    const result = resolveRepos({ root: base });
    assert.equal(result.length, 1);
  });
});

// --- parseArgs ---

describe("parseArgs", () => {
  it("parses command", () => {
    const r = parseArgs(["node", "cli", "status"]);
    assert.equal(r.command, "status");
  });

  it("defaults to null command", () => {
    const r = parseArgs(["node", "cli"]);
    assert.equal(r.command, null);
  });

  it("parses --root", () => {
    const r = parseArgs(["node", "cli", "--root", "/home"]);
    assert.equal(r.root, "/home");
  });

  it("parses --repos comma-separated", () => {
    const r = parseArgs(["node", "cli", "--repos", "/a,/b"]);
    assert.deepEqual(r.repos, ["/a", "/b"]);
  });

  it("parses --depth", () => {
    const r = parseArgs(["node", "cli", "--depth", "3"]);
    assert.equal(r.depth, 3);
  });

  it("parses --format", () => {
    const r = parseArgs(["node", "cli", "--format", "json"]);
    assert.equal(r.format, "json");
  });

  it("parses --verbose", () => {
    const r = parseArgs(["node", "cli", "-v"]);
    assert.equal(r.verbose, true);
  });

  it("parses --help", () => {
    const r = parseArgs(["node", "cli", "-h"]);
    assert.equal(r.help, true);
  });

  it("captures git args after --", () => {
    const r = parseArgs(["node", "cli", "run", "--", "log", "--oneline"]);
    assert.deepEqual(r.gitArgs, ["log", "--oneline"]);
  });

  it("parses --ignore", () => {
    const r = parseArgs(["node", "cli", "--ignore", "dist,build"]);
    assert.deepEqual(r.ignore, ["dist", "build"]);
  });
});

// --- formatStatus ---

describe("formatStatus", () => {
  it("handles empty repos", () => {
    assert.equal(formatStatus([]), "No repos found.");
  });

  it("formats basic status", () => {
    const repos = [
      { name: "repo-a", branch: "main", dirty: 0, ahead: 0, behind: 0, hasRemote: true },
    ];
    const out = formatStatus(repos);
    assert.ok(out.includes("repo-a"));
    assert.ok(out.includes("main"));
    assert.ok(out.includes("1 repo"));
  });

  it("shows dirty and ahead/behind", () => {
    const repos = [
      { name: "r", branch: "dev", dirty: 3, ahead: 2, behind: 1, hasRemote: true },
    ];
    const out = formatStatus(repos);
    assert.ok(out.includes("3 changed"));
    assert.ok(out.includes("↑2"));
    assert.ok(out.includes("↓1"));
  });
});

// --- formatJSON ---

describe("formatJSON", () => {
  it("outputs valid JSON", () => {
    const repos = [{ name: "x" }];
    const out = formatJSON(repos);
    assert.deepEqual(JSON.parse(out), repos);
  });
});

// --- formatMarkdown ---

describe("formatMarkdown", () => {
  it("outputs markdown table", () => {
    const repos = [
      { name: "r1", branch: "main", dirty: 0, ahead: 0, behind: 0, hasRemote: true },
    ];
    const out = formatMarkdown(repos);
    assert.ok(out.includes("# Git Bulk Status"));
    assert.ok(out.includes("| Repo |"));
    assert.ok(out.includes("| r1 |"));
  });

  it("handles empty repos", () => {
    assert.ok(formatMarkdown([]).includes("No repos"));
  });
});

// --- COMMANDS & HELP ---

describe("COMMANDS", () => {
  it("lists all expected commands", () => {
    assert.ok(COMMANDS.includes("status"));
    assert.ok(COMMANDS.includes("pull"));
    assert.ok(COMMANDS.includes("fetch"));
    assert.ok(COMMANDS.includes("run"));
    assert.ok(COMMANDS.includes("dirty"));
  });
});

describe("HELP", () => {
  it("contains usage info", () => {
    assert.ok(HELP.includes("git-bulk"));
    assert.ok(HELP.includes("status"));
    assert.ok(HELP.includes("pull"));
    assert.ok(HELP.includes("--root"));
  });
});
