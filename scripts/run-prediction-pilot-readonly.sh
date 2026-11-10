#!/usr/bin/env bash
set -euo pipefail

REPO=${1:?Repository path required}
COMMIT=${2:?Pinned commit required}
[[ "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo 'INVALID_COMMIT' >&2; exit 1; }
DOCKER=(env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock)

# Discover only the existing production TaxiCRM runtime; no application restart.
mapfile -t APPS < <("${DOCKER[@]}" ps --filter 'name=^/gbwo4xfa46m5n1klnqxr8afl-' --format '{{.ID}}')
[[ ${#APPS[@]} -eq 1 ]] || { echo 'EXPECTED_ONE_TAXICRM_RUNTIME' >&2; exit 1; }
APP=${APPS[0]}
TASK_DIR=$(mktemp -d /tmp/taxicrm-prediction-pilot.XXXXXX)
REMOTE_FILE="/tmp/$(basename "$TASK_DIR").cjs"
cleanup() {
  "${DOCKER[@]}" exec "$APP" rm -f "$REMOTE_FILE" >/dev/null 2>&1 || true
  rm -f "$TASK_DIR/evaluator.cjs" "$TASK_DIR/sample.sql" "$TASK_DIR/checksums.sha256"
  rmdir "$TASK_DIR" 2>/dev/null || true
}
trap cleanup EXIT
umask 077

git -C "$REPO" show "$COMMIT:docs/prediction-validation/release/historical-evaluator.cjs" > "$TASK_DIR/evaluator.cjs"
git -C "$REPO" show "$COMMIT:scripts/prediction-historical-sample.sql" > "$TASK_DIR/sample.sql"
git -C "$REPO" show "$COMMIT:docs/prediction-validation/release/checksums.sha256" > "$TASK_DIR/checksums.sha256"
(cd "$TASK_DIR" && sha256sum -c checksums.sha256 >&2)
# Only reviewed code is copied; the customer stream is never saved to disk.
chmod 644 "$TASK_DIR/evaluator.cjs"
"${DOCKER[@]}" cp "$TASK_DIR/evaluator.cjs" "$APP:$REMOTE_FILE" >&2

# cabby_ro + explicit READ ONLY transaction. The second process is a standalone
# memory-only calculator, NOT the app, a worker, a sender or a database client.
# NODE_OPTIONS is cleared to prevent inherited application preloads.
"${DOCKER[@]}" exec -i q9fahphg3lydu18inysgmerq \
  psql -X -w -qAt -U cabby_ro -d postgres -v ON_ERROR_STOP=1 \
  < "$TASK_DIR/sample.sql" |
"${DOCKER[@]}" exec -i -e NODE_OPTIONS= "$APP" \
  node --max-old-space-size=256 "$REMOTE_FILE"
