#!/usr/bin/env bash
set -euo pipefail

# Forge Night Shift bootstrap
# Safe defaults:
# - Does NOT touch Great White Streams.
# - Does NOT merge major work to main.
# - Uses feature branches/worktrees.
# - Supervisor runs every 30 minutes.
# - Final review runs after 12 hours.

ROOT="/opt/data/forge-nightshift"

# If this is launched on the Docker host rather than inside Hermes, re-run inside
# the first running container whose name contains "hermes".
if [[ "${1:-}" != "--inside" ]] && ! command -v hermes >/dev/null 2>&1; then
  if command -v docker >/dev/null 2>&1; then
    CTR="$(docker ps --format '{{.Names}}' | grep -Ei 'hermes' | head -n1 || true)"
    if [[ -n "$CTR" ]]; then
      echo "Hermes CLI not found on host; running bootstrap inside container: $CTR"
      docker exec -i "$CTR" bash -s -- --inside < "$0"
      exit $?
    fi
  fi

  echo "ERROR: Could not find the Hermes CLI or a running Hermes Docker container."
  echo "Enter the Hermes container/shell you normally use, then run this script again."
  exit 1
fi

for cmd in hermes git; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: Required command not found: $cmd"
    exit 1
  fi
done

mkdir -p "$ROOT"/{logs,tasks,reports,repos,worktrees}

cat > "$ROOT/AGENTS.md" <<'EOF'
# Forge Night Shift Workspace

This directory is the persistent control room for the Forge engineering sprint.

## Product boundary
Forge is a construction/LBM software suite.

Great White Streams is completely unrelated. Never inspect, modify, integrate,
migrate, borrow infrastructure from, or reference Great White Streams.

## Active Forge products
Prioritize these repositories/products:
- boberthegr8/ForgeCrm
- boberthegr8/Forge-scope
- boberthegr8/Robquotes
- boberthegr8/lumber-estimator-ai
- boberthegr8/forge-portal
- other repositories with "Forge" in the name only when they contain clearly
  reusable Forge functionality.

## Safety
- Preserve production customer and quote history.
- No destructive production data migration.
- No major architecture merges directly to main.
- Use branches and isolated worktrees.
- Verify facts with git/build/test output before recording them.
- Never claim a branch, commit, file, test, deployment, or fix exists unless verified.

## Target architecture
Forge Core is a shared platform/data layer serving modular apps:
CRM, Scope, Reader, AI Quoter, Estimating, Purchasing, Delivery/Operations,
Manufacturing, and Customer/Dealer Portal.

Canonical records should be designed for multi-tenancy:
organization, user/membership, customer/contact, project, scope, quote/revision,
document, activity, takeoff, delivery.

Do not create one giant coupled frontend.
EOF

cat > "$ROOT/FORGE_BACKLOG.md" <<'EOF'
# Forge Engineering Backlog

Status values: TODO | ACTIVE | REVIEW | BLOCKED | DONE

## P0 — Reliability / data safety
- TODO Audit ForgeCrm production build/runtime risks and current localStorage migration behavior.
- TODO Audit Forge Scope -> CRM Bridge v1 for duplicate customers/projects, repeat sends, popup/handshake failures, malformed payloads, and refresh behavior.
- TODO Add/verify tests for customer matching and quote-number deduplication.
- TODO Verify the six-month imported quote history remains preserved across all CRM changes.
- TODO Identify hard-coded secrets/credentials and dangerously permissive data policies in active Forge repos.
- TODO Find current build/type/lint failures in active Forge apps and fix safe issues.

## P1 — Forge Core foundation
- TODO Produce canonical TypeScript domain types for Organization, Membership, Customer, Contact, Project, Scope, Quote, QuoteRevision, Document, Activity.
- TODO Produce a reviewed multi-tenant Postgres/Supabase schema proposal with organization_id boundaries and RLS design.
- TODO Define a versioned Forge Core API/data contract usable by CRM, Scope, Reader and Quoter.
- TODO Create migration/adaptor plan from localStorage without destroying existing browser data.
- TODO Remove hard-coded cross-app URLs where practical and centralize environment/config handling.

## P1 — CRM
- TODO Review Customer CRM UX and data model for duplicate/contact/history issues.
- TODO Review Quote Nexus: source PDF links, quote revisions, subtotal terminology, statuses, won/lost flow.
- TODO Review Project Nexus relationship between customer/project/scope/quote.
- TODO Identify dead seed/demo behavior and distinguish it from real user data safely.

## P1 — Scope
- TODO Review the full Barn/Shed/Deck intake workflow for broken fields, mobile/layout issues and save/import behavior.
- TODO Improve Send to CRM UX and error states without coupling Scope to CRM implementation details.
- TODO Create validation for Forge Scope payloads and version the schema.
- TODO Review AI import for invalid JSON, wrong project type, partial fields and duplicate openings.

## P2 — Reader / AI Quoter
- TODO Inventory Robquotes and lumber-estimator-ai and identify which is the current Reader/Quoter foundation.
- TODO Find functionality worth preserving versus obsolete experiments.
- TODO Design drawing -> Reader -> Scope -> Estimating/Quoter -> Quote -> CRM flow.
- TODO Identify unsafe AI assumptions, parsing failures and file-handling weaknesses.
- TODO Create concrete refresh plan and implement safe high-value fixes.

## P2 — Portal
- TODO Audit forge-portal's Supabase usage.
- TODO Replace/plan replacement of any unrestricted anonymous RLS policy.
- TODO Determine which portal functionality belongs in future Forge customer/dealer portal.

## P3 — Suite consistency
- TODO Standardize terminology for Customer, Project/Job, Scope, Quote, Revision and Status.
- TODO Identify shared navigation/header/error/loading/empty-state patterns.
- TODO Recommend a common Forge design system without rewriting functioning apps for appearance alone.

## Required QA scenarios
- TODO Same Scope sent to CRM twice.
- TODO Same customer with multiple quote numbers.
- TODO Same customer spelling/case/company suffix variants.
- TODO Empty customer.
- TODO Duplicate project name for same customer.
- TODO Duplicate project name for different customers.
- TODO Browser refresh after import.
- TODO Existing localStorage data plus new migration code.
- TODO Malformed Scope message.
- TODO Wrong Bridge protocol/version.
EOF

cat > "$ROOT/FORGE_SPRINT_STATE.json" <<EOF
{
  "sprint": "Forge Night Shift",
  "status": "IN_PROGRESS",
  "startedAt": "$(date -Is)",
  "deadlinePolicy": "12 hours after bootstrap",
  "supervisorCadence": "30 minutes",
  "maxConcurrentWorkers": 3,
  "verifiedWorkers": [],
  "completedTasks": [],
  "blockedTasks": [],
  "notes": [
    "Never involve Great White Streams.",
    "Never declare sprint complete before finalizer run.",
    "Only verified facts belong in this file."
  ]
}
EOF

cat > "$ROOT/SUPERVISOR.md" <<'EOF'
You are ONE SUPERVISOR ITERATION of the Forge Night Shift.

THE OVERALL SPRINT IS NOT COMPLETE. Do not write an end-of-sprint report and do
not claim that 12 hours have elapsed. Your run is intentionally short.

Your job is to coordinate real coding workers and leave persistent verified
state for the next supervisor run.

FIRST:
1. cd /opt/data/forge-nightshift
2. Read AGENTS.md, FORGE_BACKLOG.md and FORGE_SPRINT_STATE.json.
3. Inspect the actual filesystem, git repositories, tmux sessions, worker logs,
   branches and commits. Never trust a previous narrative without verification.
4. Run `date -Is` and record the real current time when updating state.

STRICT PRODUCT BOUNDARY:
Great White Streams is unrelated. Do not inspect it. Do not use its Firebase,
credentials, infrastructure, code, names or data for Forge.

WORKER MODEL:
You are engineering lead / QA / coordinator.
Prefer OpenAI Codex CLI for application coding when `codex` is installed.
If Codex CLI is unavailable, you may use isolated Hermes worktree coding
sessions as a fallback, but record that explicitly.

Maximum 3 concurrent coding workers.

Workers must operate in isolated git worktrees / feature branches. Never give
two workers the same checkout.

Before spawning a worker:
- choose ONE bounded task from the highest priority backlog section;
- define repo, objective, acceptance criteria, forbidden changes, and exact tests;
- create a task file under /opt/data/forge-nightshift/tasks/;
- create or reuse a local clone under /opt/data/forge-nightshift/repos/ if the
  repository is not already available elsewhere;
- fetch before branching;
- branch naming: nightshift/<short-task-name>;
- worktree path: /opt/data/forge-nightshift/worktrees/<short-task-name>.

When possible use authenticated `gh`/git so completed feature branches can be
pushed. If authentication is unavailable, keep the worktree/commit locally and
record the blocker. Do not invent a pushed branch.

For Codex workers, use a detached tmux session and non-interactive Codex.
Preferred shape, adapting paths/session names as needed:

  tmux new-session -d -s <unique-session> \
    "cd '<worktree>' && codex exec --sandbox workspace-write \
    --ask-for-approval never - < '<task-file>' \
    > '<log-file>' 2>&1; echo \$? > '<rc-file>'"

If dependencies are missing, you may start dependency installation in the
worker shell before Codex or create a separate QA command. Do not give Codex
danger-full-access merely for convenience.

If Codex is unavailable, fallback shape:
  cd <repo> && hermes -w -z "<bounded coding task>"

SUPERVISOR RESPONSIBILITIES EACH RUN:
A. Review all existing worker sessions.
   - tmux ls
   - capture relevant output/log tails
   - inspect git status/diff/log in completed worktrees
   - never equate "agent said done" with done

B. For completed workers:
   - inspect the diff
   - run the relevant build/type/test/lint checks
   - if a fix is weak or broken, create a correction task and send it back to a
     worker rather than marking DONE
   - commit good uncommitted work with a descriptive commit if appropriate
   - push feature branch when authenticated and safe
   - update backlog status only after verification

C. If fewer than 3 workers are active:
   - spawn the next independent high-value task(s)
   - avoid duplicating work already ACTIVE/REVIEW

D. Architecture:
   Keep a canonical suite direction, but do not spend the night only writing
   architecture documents. Code and tests should dominate after the initial audit.

E. Production:
   - preserve existing CRM customer/quote data
   - no destructive localStorage wipe
   - no destructive DB migration
   - do not merge major architectural changes to main
   - small obvious fixes may be prepared, but default to reviewable branches

F. State:
   Update FORGE_BACKLOG.md and FORGE_SPRINT_STATE.json using only verified facts.
   Add concise notes to reports/SUPERVISOR_LOG.md with timestamp, workers checked,
   work started, work verified, tests run, and blockers.

IMPORTANT:
Cron supervisor runs are short. Do not try to personally implement the whole
task during this run. Start/review workers, test completed output, persist state,
then end this iteration.

Your final response for this iteration should be brief and factual. If nothing
requires Rob's attention, end with [SILENT].
EOF

cat > "$ROOT/FINALIZER.md" <<'EOF'
This is the FINAL REVIEW for the Forge Night Shift.

Do not assume previous reports are true.

1. cd /opt/data/forge-nightshift
2. Read AGENTS.md, FORGE_BACKLOG.md, FORGE_SPRINT_STATE.json and all supervisor logs.
3. Inspect every Forge worker tmux session, worktree, branch, git status, git log
   and relevant worker log.
4. For each claimed change, verify it from the actual diff/commit.
5. Run builds/tests for completed branches where practical.
6. Do NOT merge major work to production main during this final review.
7. Great White Streams remains completely out of scope.
8. Mark unfinished items honestly as REVIEW, BLOCKED or TODO.

Create /opt/data/forge-nightshift/FORGE_SPRINT_REPORT.md containing:

# Forge Night Shift Report
## Executive Summary
## Verified Work Completed
For each item: repository, branch, commit SHA(s), files changed, user-visible result.

## Tests / Builds Actually Run
Command + pass/fail.

## Preview / Review Links
Only links that were actually created and verified.

## Work Ready for Review
Branches/PRs that should be inspected before merge.

## Work Rejected or Reworked
Bad agent output found during QA and what happened to it.

## Remaining P0 / P1 / P2 / P3 Backlog
Ranked.

## Security / Data-Safety Findings
Especially tenancy, auth, RLS, localStorage and secrets.

## Forge Core Recommendation
The best next concrete platform step based on what was actually learned.

## Decisions Needed From Rob
Only genuine product-owner decisions.

## Appendix — Worker Audit
Every worker/session, task, outcome and verification status.

Then update FORGE_SPRINT_STATE.json:
- status = "REVIEW_READY"
- completedAt = real `date -Is`
- include verified branch/commit references

If any coding worker is still running, capture its state and leave it alone
unless it is clearly hung or dangerous. Do not fabricate completion.

Deliver a concise Telegram summary telling Rob the report is ready and where it
is located.
EOF

cat > "$ROOT/README.txt" <<'EOF'
Forge Night Shift control room:
/opt/data/forge-nightshift

Important files:
- AGENTS.md
- FORGE_BACKLOG.md
- FORGE_SPRINT_STATE.json
- SUPERVISOR.md
- FINALIZER.md
- FORGE_SPRINT_REPORT.md (created at final review)

Useful commands:
  hermes cron list
  hermes cron status
  hermes cron runs
  tmux ls
EOF

echo
echo "=== Environment check ==="
echo "Hermes: $(command -v hermes)"
echo "Git:    $(command -v git)"
if command -v gh >/dev/null 2>&1; then
  echo "GitHub: $(command -v gh)"
  gh auth status || true
else
  echo "GitHub CLI: NOT FOUND (workers can still use git; pushes may be blocked)"
fi
if command -v codex >/dev/null 2>&1; then
  echo "Codex:  $(command -v codex)"
  codex --version || true
else
  echo "Codex CLI: NOT FOUND — supervisor will use isolated Hermes workers as fallback."
fi
if command -v tmux >/dev/null 2>&1; then
  echo "tmux:   $(command -v tmux)"
else
  echo "WARNING: tmux not found. Long-running parallel workers will be limited."
fi

echo
echo "=== Hermes scheduler check ==="
hermes cron status || true

# Avoid duplicate night shifts if bootstrap is run twice.
echo
echo "=== Existing night-shift jobs ==="
hermes cron list --all || true

if hermes cron list --all 2>/dev/null | grep -qi "Forge Night Shift Supervisor"; then
  echo
  echo "A Forge Night Shift Supervisor job already exists."
  echo "Not creating a duplicate. Remove/pause the old one first if this is intentional."
else
  echo
  echo "=== Creating 30-minute supervisor ==="
  hermes cron create "every 30m" "$(cat "$ROOT/SUPERVISOR.md")" \
    --name "Forge Night Shift Supervisor" \
    --deliver local \
    --repeat 24 \
    --workdir "$ROOT"
fi

if hermes cron list --all 2>/dev/null | grep -qi "Forge Night Shift Final Review"; then
  echo
  echo "A Forge Night Shift Final Review job already exists."
  echo "Not creating a duplicate."
else
  echo
  echo "=== Creating 12-hour final review ==="
  hermes cron create "12h" "$(cat "$ROOT/FINALIZER.md")" \
    --name "Forge Night Shift Final Review" \
    --deliver telegram \
    --repeat 1 \
    --workdir "$ROOT"
fi

echo
echo "=== Kick first supervisor pass now ==="
hermes cron run "Forge Night Shift Supervisor" || true

echo
echo "=== Final job list ==="
hermes cron list --all

echo
echo "Forge Night Shift is configured."
echo "Supervisor: every 30 minutes"
echo "Final review: about 12 hours from now"
echo "Control room: $ROOT"
echo
echo "The first supervisor run should fire on the gateway's next scheduler tick (normally within 60 seconds)."
