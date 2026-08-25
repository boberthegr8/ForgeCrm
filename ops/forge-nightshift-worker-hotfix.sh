#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/data/forge-nightshift"

echo "=== Forge Night Shift worker hotfix ==="

install_tmux() {
  if command -v tmux >/dev/null 2>&1; then
    echo "tmux already installed: $(tmux -V)"
    return 0
  fi

  echo "tmux is missing. Installing it now..."
  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y tmux
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache tmux
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y tmux
  elif command -v yum >/dev/null 2>&1; then
    yum install -y tmux
  else
    echo "ERROR: No supported package manager found to install tmux."
    return 1
  fi

  echo "Installed: $(tmux -V)"
}

install_codex_if_possible() {
  if command -v codex >/dev/null 2>&1; then
    echo "Codex CLI already installed: $(codex --version 2>/dev/null || echo present)"
    return 0
  fi

  echo "Codex CLI is not currently installed."
  if command -v npm >/dev/null 2>&1; then
    echo "npm found. Installing OpenAI Codex CLI..."
    npm install -g @openai/codex
    echo "Codex CLI: $(codex --version 2>/dev/null || echo installed)"
  else
    echo "npm is not installed. That is NOT fatal."
    echo "The supervisor will use isolated Hermes coding workers as a fallback."
  fi
}

install_tmux
install_codex_if_possible

# Strengthen fallback instructions now that tmux is available.
if [[ -f "$ROOT/SUPERVISOR.md" ]] && ! grep -q "FALLBACK WORKERS MUST ALSO BE DETACHED" "$ROOT/SUPERVISOR.md"; then
  cat >> "$ROOT/SUPERVISOR.md" <<'EOF'

FALLBACK WORKERS MUST ALSO BE DETACHED:
If Codex CLI is unavailable, do NOT run a long Hermes coding worker inline inside
this cron supervisor turn. Launch the Hermes fallback worker in its own tmux
session so this supervisor can return and the worker can continue independently.
Example, adapting names/paths:

  tmux new-session -d -s <unique-session> \
    "cd '<worktree>' && hermes -w -z \"$(cat '<task-file>')\" \
    > '<log-file>' 2>&1; echo \$? > '<rc-file>'"

A supervisor iteration that creates no workers when fewer than 3 are active MUST
record the concrete blocker in FORGE_SPRINT_STATE.json and SUPERVISOR_LOG.md.
It is not acceptable to silently finish a supervisor pass with zero workers.
EOF
  echo "Updated supervisor fallback rules."
fi

echo
echo "=== Tool verification ==="
printf "tmux:   "; command -v tmux || true
printf "codex:  "; command -v codex || echo "not installed (Hermes fallback allowed)"
printf "hermes: "; command -v hermes || true
printf "git:    "; command -v git || true
printf "gh:     "; command -v gh || echo "not installed"

if command -v gh >/dev/null 2>&1; then
  echo
echo "=== GitHub authentication ==="
  gh auth status || true
fi

echo
echo "=== Triggering supervisor immediately ==="
hermes cron run "Forge Night Shift Supervisor" || true

echo "Waiting 20 seconds for the supervisor to launch workers..."
sleep 20

echo
echo "========== TMUX WORKERS =========="
tmux ls 2>&1 || true

echo
echo "========== CODEX / HERMES WORKER PROCESSES =========="
ps aux | grep -E 'codex|hermes .* -w|hermes .* -z' | grep -v grep || true

echo
echo "========== TASK FILES =========="
find "$ROOT/tasks" -maxdepth 1 -type f -printf '%f\n' 2>/dev/null | sort || true

echo
echo "========== WORKTREES =========="
find "$ROOT/worktrees" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null | sort || true

echo
echo "========== SPRINT STATE =========="
cat "$ROOT/FORGE_SPRINT_STATE.json" 2>/dev/null || true

echo
echo "========== SUPERVISOR LOG (LAST 80 LINES) =========="
tail -n 80 "$ROOT/reports/SUPERVISOR_LOG.md" 2>/dev/null || echo "No supervisor log yet"

echo
echo "=== Hotfix complete ==="
echo "If tmux lists Forge worker sessions, the night shift is actually programming now."
