import { execSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";

export function findRepos(root, { depth = 1, ignore = [] } = {}) {
  const repos = [];
  const cwd = resolve(root);

  function walk(dir, currentDepth) {
    if (currentDepth > depth) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (ignore.includes(entry.name)) continue;
      if (entry.name.startsWith(".") && entry.name !== ".git") continue;
      const full = join(dir, entry.name);
      if (existsSync(join(full, ".git"))) {
        repos.push(full);
      } else if (currentDepth < depth) {
        walk(full, currentDepth + 1);
      }
    }
  }

  walk(cwd, 1);
  return repos.sort();
}

export function resolveRepos({ root, repos: explicitRepos, depth, ignore }) {
  if (explicitRepos && explicitRepos.length > 0) {
    return explicitRepos.map((r) => resolve(r));
  }
  return findRepos(root || ".", { depth: depth || 1, ignore: ignore || [] });
}

function git(repoPath, ...args) {
  try {
    return execSync(`git ${args.join(" ")}`, {
      cwd: repoPath,
      encoding: "utf-8",
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (e) {
    return null;
  }
}

export function repoStatus(repoPath) {
  const branch = git(repoPath, "rev-parse", "--abbrev-ref", "HEAD");
  const porcelain = git(repoPath, "status", "--porcelain");
  const dirty = porcelain ? porcelain.split("\n").filter(Boolean).length : 0;

  const trackingRaw = git(repoPath, "rev-parse", "--abbrev-ref", "@{upstream}");
  let ahead = 0;
  let behind = 0;
  if (trackingRaw) {
    const countRaw = git(
      repoPath,
      "rev-list",
      "--left-right",
      "--count",
      `${trackingRaw}...HEAD`
    );
    if (countRaw) {
      const parts = countRaw.split("\t");
      behind = parseInt(parts[0], 10) || 0;
      ahead = parseInt(parts[1], 10) || 0;
    }
  }

  const remote = git(repoPath, "remote");
  const hasRemote = remote !== null && remote.length > 0;

  return {
    path: repoPath,
    name: basename(repoPath),
    branch: branch || "(detached)",
    dirty,
    ahead,
    behind,
    tracking: trackingRaw || null,
    hasRemote,
  };
}

export function repoPull(repoPath) {
  const result = git(repoPath, "pull", "--rebase");
  return {
    path: repoPath,
    name: basename(repoPath),
    output: result,
    success: result !== null,
  };
}

export function repoFetch(repoPath) {
  const result = git(repoPath, "fetch", "--all", "--prune");
  return {
    path: repoPath,
    name: basename(repoPath),
    output: result,
    success: result !== null,
  };
}

export function repoBranch(repoPath) {
  const branch = git(repoPath, "rev-parse", "--abbrev-ref", "HEAD");
  return {
    path: repoPath,
    name: basename(repoPath),
    branch: branch || "(detached)",
  };
}

export function repoBranches(repoPath) {
  const raw = git(repoPath, "branch", "-a");
  if (!raw) return { path: repoPath, name: basename(repoPath), branches: [] };
  const branches = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return { path: repoPath, name: basename(repoPath), branches };
}

export function repoRun(repoPath, cmd) {
  const result = git(repoPath, ...cmd.split(/\s+/));
  return {
    path: repoPath,
    name: basename(repoPath),
    output: result,
    success: result !== null,
  };
}

export function repoIsDirty(repoPath) {
  const porcelain = git(repoPath, "status", "--porcelain");
  return porcelain !== null && porcelain.length > 0;
}

const STATUS_ICONS = {
  clean: "✓",
  dirty: "✗",
  ahead: "↑",
  behind: "↓",
};

export function formatStatus(repos, { verbose = false } = {}) {
  if (repos.length === 0) return "No repos found.";

  const lines = [];
  let dirtyCount = 0;
  let cleanCount = 0;

  for (const r of repos) {
    const parts = [];
    parts.push(r.branch);

    if (r.dirty > 0) {
      parts.push(`${STATUS_ICONS.dirty} ${r.dirty} changed`);
      dirtyCount++;
    } else {
      cleanCount++;
    }

    if (r.ahead > 0) parts.push(`${STATUS_ICONS.ahead}${r.ahead}`);
    if (r.behind > 0) parts.push(`${STATUS_ICONS.behind}${r.behind}`);
    if (!r.hasRemote) parts.push("(no remote)");

    lines.push(`  ${r.name}  ${parts.join("  ")}`);
    if (verbose && r.dirty > 0) {
      lines.push(`    ${r.path}`);
    }
  }

  const header = `${repos.length} repo${repos.length !== 1 ? "s" : ""}`;
  const summary = `${cleanCount} clean, ${dirtyCount} dirty`;
  return `${header} — ${summary}\n${lines.join("\n")}`;
}

export function formatJSON(repos) {
  return JSON.stringify(repos, null, 2);
}

export function formatMarkdown(repos) {
  if (repos.length === 0) return "_No repos found._\n";

  const lines = ["# Git Bulk Status\n"];
  lines.push("| Repo | Branch | Dirty | Ahead | Behind | Remote |");
  lines.push("|------|--------|-------|-------|--------|--------|");

  for (const r of repos) {
    const dirty = r.dirty > 0 ? `**${r.dirty}**` : "0";
    const ahead = r.ahead > 0 ? `${r.ahead}` : "—";
    const behind = r.behind > 0 ? `${r.behind}` : "—";
    const remote = r.hasRemote ? "✓" : "✗";
    lines.push(
      `| ${r.name} | \`${r.branch}\` | ${dirty} | ${ahead} | ${behind} | ${remote} |`
    );
  }

  return lines.join("\n");
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const result = {
    command: null,
    root: null,
    repos: [],
    depth: 1,
    ignore: ["node_modules", ".cache", ".Trash"],
    format: "text",
    verbose: false,
    gitArgs: [],
    help: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    switch (arg) {
      case "--help":
      case "-h":
        result.help = true;
        break;
      case "--root":
        result.root = args[++i];
        break;
      case "--repos":
        result.repos = (args[++i] || "").split(",").filter(Boolean);
        break;
      case "--depth":
        result.depth = parseInt(args[++i], 10) || 1;
        break;
      case "--ignore":
        result.ignore = (args[++i] || "").split(",");
        break;
      case "--format":
        result.format = args[++i] || "text";
        break;
      case "--verbose":
      case "-v":
        result.verbose = true;
        break;
      case "--":
        result.gitArgs = args.slice(i + 1);
        i = args.length;
        break;
      default:
        if (!result.command) {
          result.command = arg;
        } else {
          result.gitArgs.push(arg);
        }
        break;
    }
    i++;
  }

  return result;
}

export const COMMANDS = [
  "status",
  "pull",
  "fetch",
  "branch",
  "branches",
  "run",
  "dirty",
];

export const HELP = `
git-bulk — Run git commands across multiple repos at once

Usage:
  git-bulk <command> [options]

Commands:
  status     Show branch, dirty state, ahead/behind for each repo (default)
  pull       git pull --rebase on each repo
  fetch      git fetch --all --prune on each repo
  branch     Show current branch for each repo
  branches   List all branches for each repo
  dirty      List only repos with uncommitted changes
  run <cmd>  Run arbitrary git command (e.g. git-bulk run -- stash list)

Options:
  --root <dir>       Root directory to scan for repos (default: .)
  --repos <paths>    Comma-separated list of repo paths (skips discovery)
  --depth <n>        How deep to scan for repos (default: 1)
  --ignore <dirs>    Directory names to skip (default: node_modules,.cache,.Trash)
  --format <fmt>     Output format: text, json, markdown (default: text)
  --verbose, -v      Show full paths
  --help, -h         Show this help

Examples:
  git-bulk status                    # show status of all repos in ~/projects
  git-bulk status --root ~/projects  # scan a specific directory
  git-bulk pull                      # pull all repos
  git-bulk fetch                     # fetch all repos
  git-bulk dirty                     # list repos with uncommitted changes
  git-bulk run -- log --oneline -5   # show last 5 commits in each repo
  git-bulk status --format json      # machine-readable output
`;
