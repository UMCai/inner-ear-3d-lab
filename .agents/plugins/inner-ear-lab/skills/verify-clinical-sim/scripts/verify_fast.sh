#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../../.." && pwd)"
cd "$REPO_ROOT"

DOMAIN="${1:-all}"

echo "[verify_fast] Repo root: $REPO_ROOT (domain=$DOMAIN)"
npm run typecheck

run_suite() {
  local script_path="$1"
  echo "[verify_fast] Running $script_path (SKIP_NESTED_BUILD=1)..."
  SKIP_NESTED_BUILD=1 node "$script_path"
}

case "$DOMAIN" in
  hearing)    run_suite scripts/test_hearing_engine.js ;;
  radiology)  run_suite scripts/test_radiology_engine.js ;;
  vestibular) run_suite scripts/test_vestibular_engine.js ;;
  eye)        SKIP_NESTED_BUILD=1 npm run test:eye-avatar ;;
  workbench)  run_suite scripts/test_vor_workbench.js ;;
  diagnostic) run_suite scripts/test_diagnostic_vestibular.js ;;
  surgical)   run_suite scripts/test_surgical_engine.js ;;
  python)     npm run test:python ;;
  all)
    npm run test:fast
    npm run test:python
    ;;
  *)
    echo "Unknown domain '$DOMAIN'. Choose: all | hearing | radiology | vestibular | eye | workbench | diagnostic | surgical | python" >&2
    exit 2
    ;;
esac

echo "[verify_fast] Complete."
