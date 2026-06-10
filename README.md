# git-bulk

Run git commands across multiple repos at once.

You know the drill — you've got 10 repos cloned locally, and you need to pull them all, check which ones have uncommitted changes, or see what branch each one is on. Doing it one by one is tedious. `git-bulk` fixes that.

## Why this exists

I work with a lot of repos (45+ at last count). Every morning I want to:
- See which repos have dirty state
- Pull latest changes
- Check if I'm behind remote

Doing `git status` 45 times is not it. This tool does it in one command.

## Install

```bash
npm install -g git-bulk
```

Or just run it directly:

```bash
npx git-bulk status --root ~/projects
```

## Usage

```bash
# Show status of all repos in current directory
git-bulk status

# Scan a specific directory
git-bulk status --root ~/projects

# Pull all repos
git-bulk pull

# Fetch all repos
git-bulk fetch

# Show current branch per repo
git-bulk branch

# List all branches per repo
git-bulk branches

# List only repos with uncommitted changes
git-bulk dirty

# Run any git command across all repos
git-bulk run -- log --oneline -5
git-bulk run -- diff --stat
git-bulk run -- stash list
```

## Options

| Flag | Description |
|------|-------------|
| `--root <dir>` | Root directory to scan (default: current) |
| `--repos <paths>` | Comma-separated repo paths (skip discovery) |
| `--depth <n>` | Scan depth (default: 1) |
| `--ignore <dirs>` | Directories to skip (default: node_modules,.cache,.Trash) |
| `--format <fmt>` | Output: text, json, markdown |
| `--verbose, -v` | Show full paths |
| `--help, -h` | Show help |

## Output formats

```bash
# Human-readable (default)
git-bulk status
# 3 repos — 2 clean, 1 dirty
#   my-app  main  ✗ 2 changed  ↑1
#   my-api  develop  ✓
#   my-lib  main  ✓  ↓3

# JSON (for scripts)
git-bulk status --format json

# Markdown (for docs/reports)
git-bulk status --format markdown
```

## Exit codes

- `0` — all repos clean (for `status`/`dirty`), or success
- `1` — dirty repos found (CI-friendly: fail if uncommitted changes)
- `2` — error (no repos found, bad command)

## How it works

1. Scans the root directory for folders containing `.git/`
2. Runs the requested git command in each repo
3. Formats and outputs the results

No API tokens, no config files, no setup. Just works with your existing git installation.

## Zero dependencies

Only uses Node.js built-ins. No external packages.

## License

MIT
