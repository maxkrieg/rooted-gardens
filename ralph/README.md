# Ralph loop — autonomous build of Rooted Gardens

Drives the entire `PHASES.md` build by running a **fresh `claude -p` process per task**. Each
iteration re-reads `CLAUDE.md` + `PHASES.md` + the repo, completes **one** task, checks it off,
and commits. The only state between runs is **git history + the PHASES.md checkboxes** — so the
loop survives crashes, can be stopped/resumed anytime, and never accumulates context drift over a
long build.

## Files

| File         | Purpose |
|--------------|---------|
| `loop.sh`    | The driver: bootstraps git, runs iterations, guardrails, logging, summary. |
| `PROMPT.md`  | The per-iteration contract handed to each fresh agent (runner-agnostic). |
| `logs/`      | Per-iteration output (`iter-NNN.log`), git-ignored. |

## Usage

```bash
# Safe inspect — prints config + remaining count + the command, changes nothing
DRY_RUN=1 ./ralph/loop.sh

# Smoke test — run 2 iterations: task 1.1 (scaffold) + task 1.2 (first DB task,
# exercises Supabase CLI + Docker/OrbStack — de-risks your biggest dependency early)
MAX_ITERS=2 ./ralph/loop.sh

# Full run — grind through every actionable task. Wrap in `caffeinate -s` so macOS
# doesn't sleep mid-build (sleep stalls iterations and can trip the per-iter timeout).
caffeinate -s ./ralph/loop.sh

# Watch progress from another terminal
tail -f ralph/logs/iter-*.log
```

Stop anytime with **Ctrl-C** — every completed task is already committed. Re-run
`caffeinate -s ./ralph/loop.sh` to resume from where it left off (it re-derives state from
the checkboxes).

**Prerequisites:** a container runtime (Docker Desktop or OrbStack) must be **running**, and the
Supabase CLI installed — the local DB stack (`supabase start`) needs them. macOS only: `caffeinate`
is built in; on Linux use `systemd-inhibit` or `caffeine`.

## Config (env vars)

| Var | Default | Meaning |
|-----|---------|---------|
| `MODEL` | `sonnet` | Model alias passed to `claude --model`. |
| `MAX_ITERS` | `200` | Hard cap on iterations. |
| `BRANCH` | `ralph/build` | Branch the loop works on. |
| `PROMPT` | `ralph/PROMPT.md` | The iteration contract. |
| `NO_PROGRESS_LIMIT` | `3` | Abort after this many consecutive no-progress iterations. |
| `ITER_TIMEOUT` | `1800` | Per-iteration hard timeout (seconds), if `timeout`/`gtimeout` exists. |
| `SLEEP` | `2` | Pause between iterations. |
| `VERBOSE` | `1` | Pass `--verbose` to the agent. |
| `DRY_RUN` | `0` | Print intended actions; make no changes. |

## How tasks are tracked

Checkboxes in `PHASES.md` are the source of truth:

- `- [ ]` — not started (actionable)
- `- [x]` — complete
- `- [~]` — blocked / human-gated, with a `<!-- blocked: … -->` note

When the run ends, the loop prints the remaining `- [~]` tasks — your human to-do list.

## Guardrails

- **Git checkpoint every iteration** (the agent commits; if it forgets, the loop snapshots a
  fallback commit). Any bad step is recoverable with `git revert` / `git reset`.
- **No-progress guard** aborts the loop if `NO_PROGRESS_LIMIT` iterations in a row neither commit
  nor reduce the todo count — prevents infinite spinning.
- **Sentinels** end the loop cleanly: `RALPH_COMPLETE` (all done) or `RALPH_BLOCKED_ALL` (only
  human-gated work remains).
- **Per-iteration timeout** kills a hung agent (needs `timeout`/`gtimeout`).

## Safety

- The loop runs the agent with **`--dangerously-skip-permissions`** — it executes commands fully
  unsupervised. It's confined to the `ralph/build` branch; prefer running it on a checkout/machine
  without sensitive credentials in scope.
- `.env*` is git-ignored and the agent only writes **placeholders**, never real secrets.
- **Local Supabase only.** The loop never touches a remote project or the Supabase MCP; database
  work uses the `supabase` CLI (`supabase start`, migrations, `supabase db reset`). Remote
  provisioning, QuickBooks, Twilio, and deploys are **human-gated** and get flagged `- [~]`.
- macOS has no `timeout` by default: `brew install coreutils` to get `gtimeout` (the loop runs
  without a hard timeout otherwise).

## What it will NOT do (left for you)

Phase 0 (Twilio 10DLC registration, Intuit developer app, cloud account provisioning), live
QuickBooks pushes, live SMS sends, and Vercel deploys. The code for credential-gated features is
written and typechecked locally, marked `<!-- live-untested: needs <cred> -->`.
