#!/usr/bin/env bash
#
# Authoritative validation for the documentation portal.
#
# Usage: eng/validate.sh [--skip-build]
#
# Runs, in order:
#   1. source-independent structural checks (safe without source credentials)
#   2. pin verification (Doxygen hash/version, theme git commit, source SHAs)
#   3. production build (skipped with --skip-build)
#   4. Doxygen diagnostic gate against the reviewed allow list
#   5. payload inspection: internal links, anchors, base-path safety, navigation,
#      coverage (no silent drops), required files, and hygiene (eng/checks.mjs)
#   6. C# fixture extraction proof (documented type/member extracted; absent from payload)
#   7. loopback HTTP smoke test under the exact project Pages base path
#   8. Git ignore sanity (generated output cannot be tracked)
#
# External (http/https) link liveness is NOT contacted here and is reported as a
# pending manual check. Browser rendering is not automated; see docs/deployment.md.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

skip_build=false
while (($#)); do
  case "$1" in
  --skip-build) skip_build=true; shift ;;
  -h | --help) usage; exit 0 ;;
  *) die "unknown option: $1" ;;
  esac
done

[[ -f "$RESTORE_MANIFEST" ]] || die "eng/restore.sh has not run (no $RESTORE_MANIFEST)"
status=0

log "step 1/8: source-independent structural checks"
"$PORTAL_ROOT/eng/check-structure.sh"

log "step 2/8: pin verification"
DOXYGEN_VERSION="$DOXYGEN_VERSION" DOXYGEN_SHA256="$DOXYGEN_SHA256" \
THEME_VERSION="$THEME_VERSION" THEME_COMMIT="$THEME_COMMIT" \
  node eng/verify-pins.mjs || status=1

if ! $skip_build; then
  log "step 3/8: production build"
  eng/build.sh || status=1
else
  log "step 3/8: skipping build (--skip-build)"
fi
[[ -d "$SITE_DIR" ]] || die "no payload at $SITE_DIR"

log "step 4/8: Doxygen diagnostic gate"
node eng/warn-gate.mjs || status=1

log "step 5/8: payload inspection (links, anchors, base path, coverage, hygiene)"
node eng/checks.mjs || status=1

log "step 6/8: C# fixture extraction proof"
node eng/fixture-check.mjs || status=1

log "step 7/8: loopback HTTP smoke under $PAGES_BASE/"
PORT="${PORTAL_SMOKE_PORT:-4311}"
PORTAL_HOST=127.0.0.1 PORTAL_PORT="$PORT" PORTAL_BASE="$PAGES_BASE" node eng/serve.mjs >"$ARTIFACTS_DIR/serve-smoke.log" 2>&1 &
SRV=$!
cleanup() { kill "$SRV" 2>/dev/null || true; }
trap cleanup EXIT
code() { curl --path-as-is -s -o /dev/null -w '%{http_code}' --retry-connrefused --retry 10 --retry-delay 1 "http://127.0.0.1:$PORT$1"; }

PAGE="$(node -e "process.stdout.write(require('./artifacts/coverage.json').pages['workspace/docs/architecture/overview.md'].page)")"
fail_http() { local want="$1" p="$2"; local got; got="$(code "$p")"; if [[ "$got" != "$want" ]]; then die "smoke: expected HTTP $want for $p, got $got"; fi; log "smoke: $p -> $got"; }

fail_http 200 "$PAGES_BASE/"
fail_http 200 "$PAGES_BASE/index.html"
fail_http 200 "$PAGES_BASE/$PAGE"
fail_http 200 "$PAGES_BASE/doxygen-awesome.css"
fail_http 200 "$PAGES_BASE/tabs.css"
fail_http 200 "$PAGES_BASE/licenses/doxygen-awesome-css-LICENSE.txt"
fail_http 404 "$PAGES_BASE/definitely-not-a-page.html"
fail_http 404 "$PAGES_BASE/%2e%2e%2f%2e%2e%2fLICENSE"
fail_http 404 "$PAGES_BASE/%E0%A4%A"
fail_http 200 "$PAGES_BASE/index.html"

log "step 8/8: Git ignore sanity"
git check-ignore -q artifacts || die "artifacts/ is not ignored in the portal repository"
git check-ignore -q node_modules || die "node_modules/ is not ignored in the portal repository"
if git status --porcelain | grep -qE '(^|/)(artifacts|node_modules)/'; then
  die "generated output appears as trackable in git status"
fi
log "git ignore: artifacts/ and node_modules/ are ignored"

log "validation finished with status $status"
exit $status
