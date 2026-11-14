#!/usr/bin/env bash
#
# Shared helpers and pinned constants for the documentation portal's authoritative
# commands. Not meant to be run directly.

set -euo pipefail

log() {
  echo "eng: $*"
}

die() {
  echo "eng: $*" >&2
  exit 1
}

# Print the calling script's leading comment block as help text.
usage() {
  awk '
    NR == 1 { next }
    /^#[[:space:]]/ { sub(/^#[[:space:]]?/, ""); print; next }
    /^#[[:space:]]*$/ { print ""; next }
    { exit }
  ' "$0"
}

PORTAL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PORTAL_ROOT"

# ---------------------------------------------------------------------------
# Pinned toolchain and theme. Nothing here may be replaced by an ambient
# system binary or a moving branch.
# ---------------------------------------------------------------------------
DOXYGEN_VERSION="1.18.0"
DOXYGEN_URL="https://www.doxygen.nl/files/doxygen-1.18.0.linux.bin.tar.gz"
DOXYGEN_SHA256="14fa81bdc34171edb5f1f02b1d60e74802f0439b77fa44e592565d517d72df90"

THEME_PACKAGE="@jothepro/doxygen-awesome-css"
THEME_VERSION="2.5.0"
THEME_COMMIT="46483f1e5a70ffb9ecd3b82d0a1cd1b24edf13da"

# GitHub project Pages publication coordinates (no custom domain, no CNAME).
PAGES_ORIGIN="https://heretical-solutions.github.io"
PAGES_BASE="/Heretical-Documentation"

# ---------------------------------------------------------------------------
# Ignored artifact paths. Every generated tree lives under artifacts/.
# ---------------------------------------------------------------------------
ARTIFACTS_DIR="artifacts"
SOURCES_DIR="$ARTIFACTS_DIR/sources"
TOOLS_DIR="$ARTIFACTS_DIR/tools"
DOXYGEN_TARBALL="$TOOLS_DIR/doxygen-${DOXYGEN_VERSION}.linux.bin.tar.gz"
DOXYGEN_DIR="$TOOLS_DIR/doxygen-${DOXYGEN_VERSION}"
DOXYGEN_BIN="$DOXYGEN_DIR/bin/doxygen"
INTERMEDIATES_DIR="$ARTIFACTS_DIR/intermediates"
DOXYGEN_WORK="$ARTIFACTS_DIR/doxygen"
THEME_STAGE_DIR="$DOXYGEN_WORK/theme"
MAIN_OUTPUT="$DOXYGEN_WORK/main"
FIXTURE_OUTPUT="$ARTIFACTS_DIR/fixture"
SITE_DIR="$ARTIFACTS_DIR/site"
MANIFEST="eng/sources.manifest.json"

# Doxygen mis-resolves some relative Markdown links when the working path contains
# whitespace (the workspace path "Heretical Development" does). Both Doxygen passes
# therefore run in a unique, space-free sandbox that mirrors the repository's relative
# layout and is removed after the build. PORTAL_BUILD_TMPDIR selects a whitespace-free
# parent directory; the default is a product-owned path under TMPDIR or /tmp.
BUILD_TMP_ROOT="${PORTAL_BUILD_TMPDIR:-${TMPDIR:-/tmp}/heretical-documentation}"

sha256_of() {
  sha256sum "$1" | cut -d' ' -f1
}

# Query the source manifest with Node (guaranteed present) so shell never parses
# JSON by hand. Reads eng/sources.manifest.json from disk.
manifest_node() {
  node -e "$1" "$MANIFEST"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

# Verify the pinned Doxygen binary is present and reports the exact version.
verify_doxygen() {
  [[ -x "$DOXYGEN_BIN" ]] || die "pinned Doxygen not restored at $DOXYGEN_BIN; run eng/restore.sh"
  local reported
  reported="$("$DOXYGEN_BIN" --version | awk '{print $1}')"
  [[ "$reported" == "$DOXYGEN_VERSION" ]] ||
    die "Doxygen version mismatch: expected $DOXYGEN_VERSION, found $reported at $DOXYGEN_BIN"
}

# Source-override knobs are handled entirely by eng/restore.sh: a documented
# local-preview path (PORTAL_SRC_<ID>_PATH) or an alternate exact dispatch SHA
# (PORTAL_SRC_<ID>_SHA) substitutes the restored checkout and is recorded in
# artifacts/restore-manifest.json, so provenance always reflects what was used.
# Assembly always targets the canonical artifacts/intermediates tree.
RESTORE_MANIFEST="$ARTIFACTS_DIR/restore-manifest.json"
