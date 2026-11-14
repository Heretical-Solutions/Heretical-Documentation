#!/usr/bin/env bash
#
# Local preview server for the built portal.
#
# Usage: eng/serve.sh [--host HOST] [--port PORT]
#
# Serves artifacts/site under the exact GitHub project Pages base path
# (/Heretical-Documentation) so relative URLs behave as they will in production.
# Loopback only; it contacts no external network. Requires a prior eng/build.sh.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

host="127.0.0.1"
port="4000"
while (($#)); do
  case "$1" in
  --host) host="$2"; shift 2 ;;
  --port) port="$2"; shift 2 ;;
  -h | --help) usage; exit 0 ;;
  *) die "unknown option: $1" ;;
  esac
done

[[ -d "$SITE_DIR" ]] || die "no payload at $SITE_DIR; run eng/build.sh first"
[[ -f "$SITE_DIR/index.html" ]] || die "payload has no index.html; run eng/build.sh first"

log "preview at http://$host:$port$PAGES_BASE/"
PORTAL_HOST="$host" PORTAL_PORT="$port" PORTAL_BASE="$PAGES_BASE" node eng/serve.mjs
