#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/data/forge-nightshift"
REPOS="$ROOT/repos"
TASKS="$ROOT/tasks"
LOGS="$ROOT/logs"
REPORTS="$ROOT/reports"
mkdir -p "$REPOS" "$TASKS" "$LOGS" "$REPORTS"

echo "=== Forge Direct Foreman ==="
echo "Time: $(date -Is)"

if ! command -v tmux >/dev/null 2>&1; then
  echo "ERROR: tmux is still unavailable."
  exit 1
fi

ENGINE="hermes"
if command -v codex >/dev/null 2>&1; then
  echo "Codex detected: $(codex --version 2>/dev/null || true)"
  PROBE="$LOGS/codex-probe.log"
  set +e
  timeout 90s codex exec --skip-git-repo-check "Do not modify files. Reply exactly READY." >"$PROBE" 2>&1
  PROBE_RC=$?
  set -e
  if [[ $PROBE_RC -eq 0 ]] && grep -qi "READY" "$PROBE"; then
    ENGINE="codex"
    echo "Codex non-interactive auth: OK"
  else
    echo "Codex CLI exists but non-interactive probe failed. Falling back to Hermes CLI."
    tail -n 20 "$PROBE" || true
  fi
else
  echo "Codex CLI not found. Falling back to Hermes CLI."
fi

echo "Worker engine: $ENGINE"

if command -v gh >/dev/null 2>&1; then
  gh auth setup-git >/dev/null 2>&1 || true
fi

clone_repo() {
  local name="$1"
  local url="https://github.com/boberthegr8/${name}.git"
  local dir="$REPOS/$name"
  if [[ ! -d "$dir/.git" ]]; then
    echo "Cloning $name..."
    git clone "$url" "$dir"
  else
    echo "Refreshing $name..."
    git -C "$dir" fetch --all --prune
  fi
}

default_branch() {
  local dir="$1"
  local ref
  ref="$(git -C "$dir" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || true)"
  if [[ -n "$ref" ]]; then
    echo "${ref##*/}"
  elif git -C "$dir" show-ref --verify --quiet refs/remotes/origin/main; then
    echo main
  else
    echo master
  fi
}

prepare_branch() {
  local repo="$1" branch="$2"
  local dir="$REPOS/$repo"
  local base
  base="$(default_branch "$dir")"
  git -C "$dir" reset --hard
  git -C "$dir" clean -fd
  git -C "$dir" checkout "$base"
  git -C "$dir" reset --hard "origin/$base"
  git -C "$dir" checkout -B "$branch"
}

cat > "$TASKS/crm-p0.md" <<'EOF'
You are the Forge CRM senior engineer for one bounded unattended task.

PRODUCT BOUNDARY:
- Work ONLY in this Forge CRM repository.
- Great White Streams is unrelated and forbidden.
- Do not connect to unrelated Firebase/infrastructure.

MISSION:
Audit and improve Forge CRM reliability/data safety, concentrating on the existing
Forge Scope -> CRM Bridge v1, quote backfill, customer matching, project matching,
and localStorage migration behavior.

REQUIRED:
1. Inspect the real code first. Do not assume prior reports are correct.
2. Preserve every existing customer and imported quote. No destructive localStorage wipe.
3. Find concrete bugs or fragile behavior in repeated Scope sends, customer/company
   normalization, duplicate project names, malformed/old bridge payloads, quote-number
   dedupe, and browser refresh/migration behavior.
4. Implement safe incremental fixes for the highest-value issues you actually find.
5. Add automated tests for shared pure logic where feasible.
6. Run the production build and tests/type checks you add.
7. Keep source PDF links and the six-month quote history intact.
8. Do NOT merge or push to main.
9. Commit your work to the current feature branch with a descriptive commit.

ACCEPTANCE:
- Build passes.
- Quote backfill remains idempotent.
- Repeating the same Scope import cannot create obvious duplicate scope/project records.
- Bad bridge messages fail safely.
- Test coverage exists for customer matching/dedupe or bridge import logic.
- Final response states exact files changed, commands/tests run, and commit SHA.
Never claim success without actually running the commands.
EOF

cat > "$TASKS/scope-p0.md" <<'EOF'
You are the Forge Scope senior frontend/integration engineer for one bounded unattended task.

PRODUCT BOUNDARY:
- Work ONLY in this Forge Scope repository.
- Great White Streams is unrelated and forbidden.

MISSION:
Audit and improve Forge Scope reliability and the current Send to CRM / Bridge v1 workflow.

REQUIRED:
1. Inspect current code first.
2. Find concrete bugs/fragility in save/persist behavior, AI JSON import validation,
   malformed fields/openings, Send to CRM handshake/error states, repeat sends,
   hard-coded URLs/config, and material mobile/layout workflow issues.
3. Implement safe high-value corrections without redesigning the whole app.
4. Introduce a versioned validation layer/data contract for outgoing Scope payloads.
5. Keep compatibility with current CRM Bridge v1 unless a backward-compatible path is safer.
6. Add automated tests for parsing/validation/bridge payload logic where feasible.
7. Run build/tests/static validation appropriate for this repo.
8. Do NOT merge or push to main.
9. Commit changes to current feature branch.

ACCEPTANCE:
- Existing saved scopes are not wiped.
- Invalid AI/bridge data fails usefully instead of corrupting state.
- Send to CRM remains usable.
- Re-sending a Scope is stable/idempotent from the Scope side.
- Exact test/build commands and commit SHA are reported.
EOF

cat > "$TASKS/robquotes-reader.md" <<'EOF'
You are the Forge Reader / Quote workflow engineer.

PRODUCT BOUNDARY:
- Work ONLY in this Robquotes repository.
- Great White Streams is unrelated and forbidden.

MISSION:
Determine what this app actually is today, then make it materially more reliable/useful
as a future Forge Reader / quoting module.

REQUIRED:
1. Inspect all code/config and establish current purpose and build status.
2. Run the current build first and record failures.
3. Find concrete runtime, PDF/file-handling, parsing, AI, UX, state, and security issues.
4. Fix safe high-value issues that can be validated locally.
5. Preserve working functionality; do not perform a cosmetic rewrite.
6. Where practical, create a clean boundary/data structure so extracted document/project
   information can later feed Forge Scope/Core instead of duplicating customer/project data.
7. Do not invent a backend or connect unrelated infrastructure tonight.
8. Add tests for parsing/data transformation logic you touch where feasible.
9. Run build/tests.
10. Commit to current feature branch; do not merge/push main.

DELIVER a concrete improved app, not only an audit document. A short
READER_TECH_NOTES.md may be added. Report exact files/tests/build results and commit SHA.
EOF

cat > "$TASKS/lumber-ai.md" <<'EOF'
You are the Forge AI Quoter / Estimating engineer.

PRODUCT BOUNDARY:
- Work ONLY in this lumber-estimator-ai repository.
- Great White Streams is unrelated and forbidden.

MISSION:
Audit the current estimating/AI application and make safe improvements toward a Forge
AI Quoter module.

REQUIRED:
1. Inspect the app and run build/tests first.
2. Identify AI provider/config, persistence, customer/project duplication, prompt/parsing
   weaknesses, secrets exposure, and failure handling.
3. Fix concrete high-value problems that can be validated locally.
4. Improve structured output/schema validation and error handling if weak.
5. Create a clear adapter/data contract for future Forge Core Customer/Project/Scope/Quote IDs.
6. Do not use Great White Streams Firebase or unrelated backend.
7. Do not migrate production data.
8. Run build/tests and commit to current feature branch.
9. No merge/push to main.

Report exact changes, tests/build results, blockers, and commit SHA.
EOF

cat > "$TASKS/portal-security.md" <<'EOF'
You are the Forge Portal backend/security engineer.

PRODUCT BOUNDARY:
- Work ONLY in forge-portal.
- Great White Streams is unrelated and forbidden.

MISSION:
Harden the old Forge Portal prototype so useful ideas can safely inform a future
Forge customer/dealer portal.

REQUIRED:
1. Inspect code/schema and run build first.
2. Verify and fix repository-level risks: exposed config, unrestricted RLS,
   weak client authorization assumptions, data model gaps.
3. Implement SAFE changes only: corrected migration/schema proposal, organization_id /
   membership boundaries, safer environment handling, validation/build fixes.
4. Do NOT apply migrations to a live Supabase project.
5. Do NOT delete existing data.
6. Preserve working functionality and document what requires authentication before commercial use.
7. Run build/tests and commit current branch.
8. No main merge.

Separate verified fixes from recommendations and include commit SHA.
EOF

cat > "$TASKS/crm-quote-ux.md" <<'EOF'
You are the Forge CRM quote/project workflow engineer, second-pass task.

Improve the actual Customer -> Quote -> Scope/Project workflow without broad redesign.

Priorities:
- quote subtotal terminology
- source PDF/source URL visibility
- quote revision/version clarity
- won/lost/rejected/sent status semantics
- one-customer quote history
- project relationship to Scope and Quote
- empty/error states

Preserve all existing data and quote history. Do not wipe localStorage. Do not touch Great
White Streams. Add tests for pure logic touched. Run build/tests. Commit changes.
EOF

cat > "$TASKS/scope-ux.md" <<'EOF'
You are the Forge Scope second-pass workflow/UX engineer.

Make the estimator workflow faster and clearer without a wholesale redesign.

Priorities:
- navigation and save confidence
- clear project/customer identity
- validation feedback before Send to CRM
- summary usability/printing
- mobile/narrow-window issues
- consistent Forge terminology
- preserve AI/manual workflow and saved local data

Do not touch Great White Streams. Do not remove working features. Run validation/build/tests
available to this repo and commit changes.
EOF

cat > "$TASKS/qa.md" <<'EOF'
You are the independent senior QA/reviewer for changes already made on this feature branch.

Do NOT trust the previous coding agent's claims.
1. Inspect git diff/log versus origin default branch.
2. Check out-of-scope edits, data-loss risks, secrets, broken types, bad assumptions,
   dead code and regressions.
3. Run relevant install/build/test/type/lint commands.
4. Fix concrete problems. Do not broaden scope cosmetically.
5. Preserve production data and do not touch Great White Streams.
6. Commit QA fixes if you changed anything.
7. End with PASS / PASS WITH NOTES / FAIL, exact commands run, and HEAD SHA.
EOF

cat > "$ROOT/foreman-functions.sh" <<EOF
#!/usr/bin/env bash
set -uo pipefail
ROOT="$ROOT"
REPOS="$REPOS"
TASKS="$TASKS"
LOGS="$LOGS"
REPORTS="$REPORTS"
ENGINE="$ENGINE"

default_branch() {
  local dir="\$1"
  local ref
  ref="\$(git -C "\$dir" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || true)"
  if [[ -n "\$ref" ]]; then echo "\${ref##*/}";
  elif git -C "\$dir" show-ref --verify --quiet refs/remotes/origin/main; then echo main;
  else echo master; fi
}
prepare_branch() {
  local repo="\$1" branch="\$2"
  local dir="\$REPOS/\$repo"
  local base
  base="\$(default_branch "\$dir")"
  git -C "\$dir" reset --hard
  git -C "\$dir" clean -fd
  git -C "\$dir" checkout "\$base"
  git -C "\$dir" reset --hard "origin/\$base"
  git -C "\$dir" checkout -B "\$branch"
}
run_agent_foreground() {
  local repo_dir="\$1" prompt_file="\$2" log_file="\$3"
  if [[ "\$ENGINE" == "codex" ]]; then
    ( cd "\$repo_dir"; timeout 9000s codex -a never exec --sandbox workspace-write --skip-git-repo-check - < "\$prompt_file" ) >"\$log_file" 2>&1
  else
    ( cd "\$repo_dir"; PROMPT="\$(cat "\$prompt_file")"; timeout 9000s hermes chat -q "\$PROMPT" ) >"\$log_file" 2>&1
  fi
}
run_task() {
  local repo="\$1" task="\$2" prompt="\$3" branch="nightshift/\$2"
  local dir="\$REPOS/\$repo"
  local log="\$LOGS/\$2-worker.log"
  local qlog="\$LOGS/\$2-qa.log"
  local rcfile="\$LOGS/\$2.rc"
  {
    echo "[\$(date -Is)] START \$task on \$repo branch \$branch engine=\$ENGINE"
    prepare_branch "\$repo" "\$branch"
    set +e
    run_agent_foreground "\$dir" "\$prompt" "\$log"
    local rc=\$?
    set -e
    echo "\$rc" >"\$rcfile"
    git -C "\$dir" status --short >>"\$log" 2>&1 || true
    git -C "\$dir" log -5 --oneline >>"\$log" 2>&1 || true
    set +e
    run_agent_foreground "\$dir" "\$TASKS/qa.md" "\$qlog"
    local qrc=\$?
    set -e
    echo "worker_rc=\$rc qa_rc=\$qrc" >"\$rcfile"
    if [[ -n "\$(git -C "\$dir" status --porcelain 2>/dev/null)" ]]; then
      git -C "\$dir" add -A
      git -C "\$dir" -c user.name="Forge Night Shift" -c user.email="forge-nightshift@local" commit -m "Night shift: preserve reviewed \$task changes" >>"\$qlog" 2>&1 || true
    fi
    set +e
    git -C "\$dir" push -u origin "\$branch" >>"\$qlog" 2>&1
    local prc=\$?
    set -e
    local head
    head="\$(git -C "\$dir" rev-parse HEAD)"
    echo "[\$(date -Is)] END \$task worker=\$rc qa=\$qrc push=\$prc head=\$head"
    printf '%s|%s|%s|%s|%s|%s\\n' "\$repo" "\$task" "\$branch" "\$head" "\$qrc" "\$prc" >>"\$REPORTS/VERIFIED_BRANCHES.tsv"
  } >>"\$REPORTS/FOREMAN_LOG.md" 2>&1
}
EOF
chmod +x "$ROOT/foreman-functions.sh"

for r in ForgeCrm Forge-scope Robquotes lumber-estimator-ai forge-portal; do
  clone_repo "$r"
done

: > "$REPORTS/VERIFIED_BRANCHES.tsv"
touch "$REPORTS/FOREMAN_LOG.md"

for s in forge-crm-p0 forge-scope-p0 forge-reader forge-lumber-ai forge-portal-sec forge-crm-ux forge-scope-ux forge-foreman; do
  tmux kill-session -t "$s" 2>/dev/null || true
done

tmux new-session -d -s forge-crm-p0 \
  "bash -lc 'source \"$ROOT/foreman-functions.sh\"; run_task \"ForgeCrm\" \"crm-p0\" \"$TASKS/crm-p0.md\"'"
tmux new-session -d -s forge-scope-p0 \
  "bash -lc 'source \"$ROOT/foreman-functions.sh\"; run_task \"Forge-scope\" \"scope-p0\" \"$TASKS/scope-p0.md\"'"
tmux new-session -d -s forge-reader \
  "bash -lc 'source \"$ROOT/foreman-functions.sh\"; run_task \"Robquotes\" \"robquotes-reader\" \"$TASKS/robquotes-reader.md\"'"

cat > "$ROOT/monitor.sh" <<'EOF'
#!/usr/bin/env bash
set -uo pipefail
ROOT="/opt/data/forge-nightshift"
LOG="$ROOT/reports/FOREMAN_LOG.md"
alive(){ tmux has-session -t "$1" 2>/dev/null; }
wait_done(){ local s="$1"; while alive "$s"; do sleep 60; done; }

echo "[$(date -Is)] Direct foreman monitor started." >>"$LOG"

wait_done forge-crm-p0
tmux new-session -d -s forge-lumber-ai \
  "bash -lc 'source \"$ROOT/foreman-functions.sh\"; run_task \"lumber-estimator-ai\" \"lumber-ai\" \"$ROOT/tasks/lumber-ai.md\"'"

wait_done forge-scope-p0
tmux new-session -d -s forge-portal-sec \
  "bash -lc 'source \"$ROOT/foreman-functions.sh\"; run_task \"forge-portal\" \"portal-security\" \"$ROOT/tasks/portal-security.md\"'"

wait_done forge-reader
wait_done forge-lumber-ai
tmux new-session -d -s forge-crm-ux \
  "bash -lc 'source \"$ROOT/foreman-functions.sh\"; run_task \"ForgeCrm\" \"crm-quote-ux\" \"$ROOT/tasks/crm-quote-ux.md\"'"

wait_done forge-portal-sec
tmux new-session -d -s forge-scope-ux \
  "bash -lc 'source \"$ROOT/foreman-functions.sh\"; run_task \"Forge-scope\" \"scope-ux\" \"$ROOT/tasks/scope-ux.md\"'"

wait_done forge-crm-ux
wait_done forge-scope-ux

{
  echo "# Forge Direct Night Shift — Verified Work"
  echo
  echo "Generated: $(date -Is)"
  echo
  echo "## Branches"
  if [[ -s "$ROOT/reports/VERIFIED_BRANCHES.tsv" ]]; then
    while IFS='|' read -r repo task branch head qrc prc; do
      echo "- **$repo** — \`$branch\` — HEAD \`$head\` — QA rc=$qrc — push rc=$prc"
    done < "$ROOT/reports/VERIFIED_BRANCHES.tsv"
  else
    echo "No verified branch records were produced."
  fi
  echo
  echo "Worker/QA logs: \`$ROOT/logs/\`"
  echo "Foreman log: \`$ROOT/reports/FOREMAN_LOG.md\`"
  echo
  echo "Review diffs before merging anything to production."
} > "$ROOT/FORGE_DIRECT_REPORT.md"

echo "[$(date -Is)] Direct queue completed; report written." >>"$LOG"
EOF
chmod +x "$ROOT/monitor.sh"
tmux new-session -d -s forge-foreman "bash '$ROOT/monitor.sh'"

python3 - "$ROOT/FORGE_SPRINT_STATE.json" "$ENGINE" <<'PY'
import json,sys,datetime
p=sys.argv[1]; engine=sys.argv[2]
try: d=json.load(open(p))
except Exception: d={}
d["status"]="IN_PROGRESS"
d["directForeman"]=True
d["workerEngine"]=engine
d["verifiedWorkers"]=["forge-crm-p0","forge-scope-p0","forge-reader","forge-foreman"]
d["lastDirectLaunchAt"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
d.setdefault("notes",[]).append("Direct shell foreman launches workers; Hermes cron is oversight only.")
open(p,"w").write(json.dumps(d,indent=2))
PY

echo
echo "========== ACTUAL TMUX SESSIONS =========="
tmux ls || true
echo
echo "========== WORKER ENGINE =========="
echo "$ENGINE"
echo
echo "========== PROCESS CHECK =========="
ps aux | grep -E 'codex|hermes chat|monitor.sh' | grep -v grep || true
echo
echo "========== SPRINT STATE =========="
cat "$ROOT/FORGE_SPRINT_STATE.json"
echo
echo "Direct workers launched. tmux keeps them running after you close this terminal."
