#!/usr/bin/env bash
#
# ralph/loop.sh — autonomous "ralph loop" that builds Rooted Gardens through PHASES.md.
#
# Each iteration spawns a FRESH `claude -p` process that reads CLAUDE.md + PHASES.md, does
# exactly one task, checks it off, and commits. State lives only in git + the PHASES.md
# checkboxes, so the loop survives crashes and never accumulates context drift.
#
# Usage:
#   ./ralph/loop.sh                 # run until done (or guardrail trips)
#   MAX_ITERS=1 ./ralph/loop.sh     # single iteration (smoke test)
#   DRY_RUN=1 ./ralph/loop.sh       # print what it would do, change nothing
#
# Config (env vars, with defaults):
#   MODEL=sonnet  MAX_ITERS=200  BRANCH=ralph/build  PROMPT=ralph/PROMPT.md
#   LOG_DIR=ralph/logs  NO_PROGRESS_LIMIT=3  ITER_TIMEOUT=1800  SLEEP=2  VERBOSE=1  DRY_RUN=0

# Note: intentionally NOT using `set -u` — macOS ships bash 3.2, where expanding an empty
# array (`"${arr[@]}"`) under `set -u` throws "unbound variable". All vars below are defaulted.
set -eo pipefail

# --- resolve repo root (script lives in <root>/ralph) -----------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# --- config -----------------------------------------------------------------------------
MODEL="${MODEL:-sonnet}"
MAX_ITERS="${MAX_ITERS:-200}"
BRANCH="${BRANCH:-ralph/build}"
PROMPT="${PROMPT:-ralph/PROMPT.md}"
LOG_DIR="${LOG_DIR:-ralph/logs}"
NO_PROGRESS_LIMIT="${NO_PROGRESS_LIMIT:-3}"
ITER_TIMEOUT="${ITER_TIMEOUT:-1800}"
SLEEP="${SLEEP:-2}"
VERBOSE="${VERBOSE:-1}"
DRY_RUN="${DRY_RUN:-0}"
PHASES_FILE="PHASES.md"

log()  { printf '\033[0;36m[ralph]\033[0m %s\n' "$*"; }
warn() { printf '\033[0;33m[ralph]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[0;31m[ralph] %s\033[0m\n' "$*" >&2; exit 1; }

# count of actionable (not started) tasks; `|| true` so a 0 count doesn't trip `set -e`
count_todo()    { grep -c '^- \[ \] '  "$PHASES_FILE" 2>/dev/null || true; }
count_done()    { grep -c '^- \[x\] '  "$PHASES_FILE" 2>/dev/null || true; }
count_blocked() { grep -c '^- \[~\] '  "$PHASES_FILE" 2>/dev/null || true; }

# --- preflight --------------------------------------------------------------------------
command -v claude >/dev/null 2>&1 || die "claude CLI not found on PATH."
[ -f "$PROMPT" ]      || die "Prompt file not found: $PROMPT"
[ -f "$PHASES_FILE" ] || die "PHASES.md not found in $ROOT"

# hard per-iteration timeout: prefer GNU timeout / gtimeout; degrade gracefully if absent.
# -k 30 sends SIGKILL 30s after SIGTERM so a stuck child (e.g. npm) can't linger.
TIMEOUT_CMD=()
if command -v timeout  >/dev/null 2>&1; then TIMEOUT_CMD=(timeout  -k 30 "$ITER_TIMEOUT")
elif command -v gtimeout >/dev/null 2>&1; then TIMEOUT_CMD=(gtimeout -k 30 "$ITER_TIMEOUT")
else warn "No 'timeout'/'gtimeout' found — running without a per-iteration timeout (brew install coreutils)."; fi

# Clean teardown on Ctrl-C: kill the whole process group so no orphaned claude/npm lingers
# (this is why the first run needed a full terminal close — an interactive child held the TTY).
trap 'echo; warn "interrupted — terminating agent + children."; kill 0 2>/dev/null; exit 130' INT TERM

# Live, fault-tolerant pretty-printer for Claude Code stream-json (so a long task is visibly
# working, not a blank screen). `-R + fromjson?` never errors out on a stray line.
fmt_stream() {
  if command -v jq >/dev/null 2>&1; then
    jq -Rr --unbuffered '
      (fromjson? // {}) as $e
      | if $e.type=="assistant" then
          ($e.message.content[]?
           | if .type=="text" then (.text // empty)
             elif .type=="tool_use" then "  → "+(.name//"tool")+"  "+(((.input.command//.input.file_path//.input.url//.input.description)//"")|tostring|gsub("\n";" ")|.[0:110])
             else empty end)
        elif $e.type=="result" then "  ■ "+((.subtype//"done"))+(if (.is_error//false) then " (ERROR)" else "" end)
        elif ($e.type=="system" and (.subtype//"")=="init") then "  ● agent session started"
        else empty end' 2>/dev/null
  else
    cat
  fi
}

# --- bootstrap git + branch + ignore + baseline commit ----------------------------------
bootstrap() {
  if [ ! -d .git ]; then
    log "Initializing git repository."
    [ "$DRY_RUN" = "1" ] || git init -q
  fi

  if [ ! -f .gitignore ]; then
    log "Writing .gitignore."
    if [ "$DRY_RUN" != "1" ]; then
      cat > .gitignore <<'EOF'
node_modules/
.next/
out/
.env
.env.*
!.env.example
ralph/logs/
.DS_Store
supabase/.branches/
supabase/.temp/
EOF
    fi
  fi

  if [ "$DRY_RUN" = "1" ]; then return; fi

  # ensure we're on the working branch
  if git rev-parse --verify --quiet "$BRANCH" >/dev/null; then
    git checkout -q "$BRANCH"
  else
    git checkout -q -b "$BRANCH" 2>/dev/null || git checkout -q -B "$BRANCH"
  fi

  # baseline commit so HEAD exists and the no-progress guard has a reference
  if [ -n "$(git status --porcelain)" ] || ! git rev-parse HEAD >/dev/null 2>&1; then
    git add -A
    git commit -q -m "ralph: baseline (docs + ralph harness)" || true
  fi
}

# --- run one iteration ------------------------------------------------------------------
mkdir -p "$LOG_DIR"
bootstrap

if [ "$DRY_RUN" = "1" ]; then
  log "DRY RUN — no changes will be made."
  log "root=$ROOT  branch=$BRANCH  model=$MODEL  max_iters=$MAX_ITERS"
  log "remaining todo=$(count_todo)  done=$(count_done)  blocked=$(count_blocked)"
  printf '\n[ralph] would run each iteration:\n  '
  printf '%q ' "${TIMEOUT_CMD[@]}" claude -p "\$(cat $PROMPT)" --model "$MODEL" --dangerously-skip-permissions --verbose --output-format stream-json
  printf '%s\n' '< /dev/null 2>&1 | tee LOG | fmt_stream'
  exit 0
fi

stalls=0
last_status=""
for ((i = 1; i <= MAX_ITERS; i++)); do
  remaining="$(count_todo)"
  if [ "$remaining" -eq 0 ]; then
    log "No actionable tasks left in PHASES.md."
    break
  fi

  log "Iteration $i/$MAX_ITERS — $remaining task(s) remaining. Launching agent ($MODEL)…"
  before_head="$(git rev-parse HEAD)"
  iter_log="$LOG_DIR/iter-$(printf '%03d' "$i").log"

  # stdin is closed (< /dev/null): any scaffolder that would prompt (create-next-app, shadcn)
  # gets EOF and fails fast instead of hanging on the TTY. Raw stream-json → log (forensics),
  # piped through fmt_stream → live readable progress.
  set +e
  "${TIMEOUT_CMD[@]}" claude -p "$(cat "$PROMPT")" \
      --model "$MODEL" \
      --dangerously-skip-permissions \
      --verbose --output-format stream-json \
      < /dev/null 2>&1 | tee "$iter_log" | fmt_stream
  rc=${PIPESTATUS[0]}
  set -e
  [ "$rc" -eq 0 ] || warn "Agent exited non-zero (rc=$rc) on iteration $i — see $iter_log."

  # fallback checkpoint: if the agent left changes uncommitted, snapshot them so git advances
  if [ -n "$(git status --porcelain)" ]; then
    warn "Working tree dirty after iteration — committing fallback checkpoint."
    git add -A
    git commit -q -m "ralph: iter $i checkpoint (agent left uncommitted changes)" || true
  fi

  # honor explicit sentinels from the agent
  if grep -q 'RALPH_COMPLETE' "$iter_log"; then
    log "Agent signaled RALPH_COMPLETE."; last_status="complete"; break
  fi
  if grep -q 'RALPH_BLOCKED_ALL' "$iter_log"; then
    log "Agent signaled RALPH_BLOCKED_ALL — only blocked/human-gated tasks remain."
    last_status="blocked"; break
  fi

  # no-progress guard: no new commit AND no fewer todos => stall
  after_head="$(git rev-parse HEAD)"
  after_remaining="$(count_todo)"
  if [ "$after_head" = "$before_head" ] && [ "$after_remaining" -ge "$remaining" ]; then
    stalls=$((stalls + 1))
    warn "No progress this iteration ($stalls/$NO_PROGRESS_LIMIT)."
    if [ "$stalls" -ge "$NO_PROGRESS_LIMIT" ]; then
      die "Aborting: $NO_PROGRESS_LIMIT consecutive iterations made no progress. Inspect $iter_log."
    fi
  else
    stalls=0
  fi

  sleep "$SLEEP"
done

# --- summary ----------------------------------------------------------------------------
echo
log "===== Ralph run summary ====="
log "done=$(count_done)  blocked=$(count_blocked)  remaining=$(count_todo)  (branch: $BRANCH)"
if [ "$(count_blocked)" -gt 0 ]; then
  echo
  log "Blocked / human-gated tasks left for you:"
  grep -nE '^- \[~\] ' "$PHASES_FILE" || true
fi
[ "${last_status:-}" = "complete" ] && log "All actionable work is done. 🎉"
echo
log "Last iteration log: $(ls -1t "$LOG_DIR"/iter-*.log 2>/dev/null | head -1 || echo none)"
