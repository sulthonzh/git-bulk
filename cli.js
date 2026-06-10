#!/usr/bin/env node
import {
  parseArgs,
  HELP,
  resolveRepos,
  repoStatus,
  repoPull,
  repoFetch,
  repoBranch,
  repoBranches,
  repoRun,
  repoIsDirty,
  formatStatus,
  formatJSON,
  formatMarkdown,
} from "./src.js";

const opts = parseArgs(process.argv);

if (opts.help) {
  console.log(HELP);
  process.exit(0);
}

const command = opts.command || "status";
const repos = resolveRepos({
  root: opts.root,
  repos: opts.repos,
  depth: opts.depth,
  ignore: opts.ignore,
});

if (repos.length === 0) {
  console.error("No git repos found. Use --root to specify a directory.");
  process.exit(2);
}

const formatter =
  opts.format === "json"
    ? formatJSON
    : opts.format === "markdown"
      ? formatMarkdown
      : (data) => formatStatus(data, { verbose: opts.verbose });

switch (command) {
  case "status": {
    const results = repos.map(repoStatus);
    console.log(formatter(results));
    const dirty = results.filter((r) => r.dirty > 0);
    process.exit(dirty.length > 0 ? 1 : 0);
  }

  case "pull": {
    for (const repo of repos) {
      const r = repoPull(repo);
      const icon = r.success ? "✓" : "✗";
      console.log(`${icon} ${r.name}: ${r.output || "(already up to date)"}`);
    }
    break;
  }

  case "fetch": {
    for (const repo of repos) {
      const r = repoFetch(repo);
      const icon = r.success ? "✓" : "✗";
      console.log(`${icon} ${basename(repo)}`);
    }
    break;
  }

  case "branch": {
    const results = repos.map(repoBranch);
    if (opts.format === "json") {
      console.log(formatJSON(results));
    } else {
      for (const r of results) {
        console.log(`  ${r.name}  ${r.branch}`);
      }
    }
    break;
  }

  case "branches": {
    const results = repos.map(repoBranches);
    if (opts.format === "json") {
      console.log(formatJSON(results));
    } else {
      for (const r of results) {
        console.log(`\n${r.name}:`);
        for (const b of r.branches) {
          console.log(`  ${b}`);
        }
      }
    }
    break;
  }

  case "dirty": {
    const dirtyRepos = repos.filter(repoIsDirty).map((p) => basename(p));
    if (dirtyRepos.length === 0) {
      console.log("All repos are clean.");
    } else {
      console.log(`${dirtyRepos.length} dirty repo${dirtyRepos.length !== 1 ? "s" : ""}:`);
      for (const name of dirtyRepos) {
        console.log(`  ✗ ${name}`);
      }
      process.exit(1);
    }
    break;
  }

  case "run": {
    const cmd = opts.gitArgs.join(" ");
    if (!cmd) {
      console.error("Usage: git-bulk run -- <git-command>");
      process.exit(2);
    }
    for (const repo of repos) {
      const r = repoRun(repo, cmd);
      console.log(`--- ${r.name} ---`);
      console.log(r.output || "(no output)");
    }
    break;
  }

  default:
    console.error(`Unknown command: ${command}`);
    console.error(`Valid commands: status, pull, fetch, branch, branches, dirty, run`);
    process.exit(2);
}

function basename(p) {
  return p.split("/").pop();
}
