#!/usr/bin/env bash
#
# Production build of the documentation portal into the ignored artifacts/site tree.
#
# Usage: eng/build.sh [--skip-restore-check]
#
# Steps: stage the pinned theme files, aggregate the pinned sources into the
# intermediate tree (eng/assemble.mjs), generate an effective Doxyfile under
# artifacts, run the published portal pass and the non-published C# fixture pass,
# derive the authoritative source-to-page coverage map, then assemble the static
# payload (Doxygen HTML + .nojekyll + license texts + notices + provenance page).
#
# Requires a prior eng/restore.sh. Persistent output stays under ignored artifacts;
# a unique temporary space-free Doxygen sandbox is removed when the build exits.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

skip_restore_check=false
while (($#)); do
  case "$1" in
  --skip-restore-check)
    skip_restore_check=true
    shift
    ;;
  -h | --help)
    usage
    exit 0
    ;;
  *)
    die "unknown option: $1"
    ;;
  esac
done

if ! $skip_restore_check; then
  [[ -f "$RESTORE_MANIFEST" ]] || die "eng/restore.sh has not run (no $RESTORE_MANIFEST)"
  verify_doxygen
fi

# ---------------------------------------------------------------------------
# 1. Stage only the theme files the portal references.
# ---------------------------------------------------------------------------
THEME_SRC="node_modules/${THEME_PACKAGE}"
[[ -d "$THEME_SRC" ]] || die "theme not installed; run eng/restore.sh"
rm -rf "$THEME_STAGE_DIR"
mkdir -p "$THEME_STAGE_DIR"
for f in \
  doxygen-awesome.css \
  doxygen-awesome-sidebar-only.css \
  doxygen-awesome-sidebar-only-darkmode-toggle.css \
  doxygen-awesome-darkmode-toggle.js \
  doxygen-awesome-fragment-copy-button.js \
  doxygen-awesome-paragraph-link.js \
  doxygen-awesome-interactive-toc.js \
  doxygen-awesome-tabs.js; do
  [[ -f "$THEME_SRC/$f" ]] || die "theme file missing: $f"
  cp "$THEME_SRC/$f" "$THEME_STAGE_DIR/$f"
done
log "staged $(ls "$THEME_STAGE_DIR" | wc -l) theme files into $THEME_STAGE_DIR"

# ---------------------------------------------------------------------------
# 2. Aggregate pinned sources into the intermediate tree.
# ---------------------------------------------------------------------------
log "assembling intermediates"
node eng/assemble.mjs

# Never let a previous run's coverage map conceal a missing first-pass XML input.
rm -f "$ARTIFACTS_DIR/coverage.json"

# ---------------------------------------------------------------------------
# 3. Run both Doxygen passes in a space-free sandbox that mirrors this
#    repository's relative layout, then copy the results back into artifacts.
#    Doxygen mis-resolves some relative Markdown links from a path containing
#    whitespace (the workspace path does); the sandbox avoids that, exactly as
#    the blog relocates its gem bundle outside a spaced path.
# ---------------------------------------------------------------------------
[[ "$BUILD_TMP_ROOT" != *[[:space:]]* ]] || die "PORTAL_BUILD_TMPDIR must not contain whitespace: $BUILD_TMP_ROOT"
DX_ABS="$PORTAL_ROOT/$DOXYGEN_BIN"   # absolute, quoted; the binary path may contain spaces
[[ -x "$DX_ABS" ]] || die "pinned Doxygen not restored at $DOXYGEN_BIN; run eng/restore.sh"

# mktemp creates a unique directory owned by this invocation. Never remove a
# shared fixed path or an arbitrary caller-provided directory.
mkdir -p "$BUILD_TMP_ROOT"
BUILD_SANDBOX="$(mktemp -d "$BUILD_TMP_ROOT/heretical-doc-build.XXXXXX")"
cleanup() { rm -rf -- "$BUILD_SANDBOX"; }
trap cleanup EXIT
log "preparing space-free Doxygen sandbox at $BUILD_SANDBOX"
mkdir -p "$BUILD_SANDBOX/artifacts/doxygen"
cp -R doxygen assets "$BUILD_SANDBOX/"
cp -R "$THEME_STAGE_DIR" "$BUILD_SANDBOX/artifacts/doxygen/theme"
cp -R "$INTERMEDIATES_DIR" "$BUILD_SANDBOX/artifacts/intermediates"
cp -R tests "$BUILD_SANDBOX/tests"
cp Doxyfile Doxyfile.fixture "$BUILD_SANDBOX/"

log "running the published portal Doxygen pass (sandbox)"
if ! ( cd "$BUILD_SANDBOX" && "$DX_ABS" Doxyfile >main.stdout.log 2>&1 ); then
  cp "$BUILD_SANDBOX/main.stdout.log" "$ARTIFACTS_DIR/main.stdout.log"
  die "Doxygen portal pass failed; see $ARTIFACTS_DIR/main.stdout.log"
fi
# The coverage generator consumes artifacts from the repository, not the
# sandbox. Copy the first-pass XML back before deriving navigation from it.
# Otherwise a clean CI checkout has no artifacts/coverage.json yet and the
# navigation generator fails before the Pages adapter can validate the payload.
log "copying first-pass Doxygen XML back into artifacts"
rm -rf "$MAIN_OUTPUT"
mkdir -p "$DOXYGEN_WORK"
cp -R "$BUILD_SANDBOX/artifacts/doxygen/main" "$MAIN_OUTPUT"
log "building first-pass coverage map for navigation"
node eng/coverage.mjs

# Doxygen's related-page IDs are authoritative; build the hierarchy from them
# before the final published navigation pass. A flat list is deliberately not
# retained in the sidebar.
cp "$BUILD_SANDBOX/Doxyfile" "$BUILD_SANDBOX/Doxyfile.navigation"
printf '\nLAYOUT_FILE = DoxyLayout.xml\n' >>"$BUILD_SANDBOX/Doxyfile.navigation"
node eng/navigation.mjs
cp "$ARTIFACTS_DIR/DoxyLayout.xml" "$BUILD_SANDBOX/DoxyLayout.xml"
log "running the published portal navigation pass with explicit topic hierarchy"
if ! ( cd "$BUILD_SANDBOX" && "$DX_ABS" Doxyfile.navigation >navigation.stdout.log 2>&1 ); then
  cp "$BUILD_SANDBOX/navigation.stdout.log" "$ARTIFACTS_DIR/navigation.stdout.log"
  die "Doxygen navigation pass failed; see $ARTIFACTS_DIR/navigation.stdout.log"
fi

log "running the non-published C# fixture Doxygen pass (sandbox)"
if ! ( cd "$BUILD_SANDBOX" && "$DX_ABS" Doxyfile.fixture >fixture.stdout.log 2>&1 ); then
  cp "$BUILD_SANDBOX/fixture.stdout.log" "$ARTIFACTS_DIR/fixture.stdout.log"
  die "Doxygen fixture pass failed; see $ARTIFACTS_DIR/fixture.stdout.log"
fi

log "copying Doxygen results back into artifacts"
rm -rf "$MAIN_OUTPUT" "$FIXTURE_OUTPUT"
mkdir -p "$DOXYGEN_WORK"
cp -R "$BUILD_SANDBOX/artifacts/doxygen/main" "$MAIN_OUTPUT"
cp -R "$BUILD_SANDBOX/artifacts/fixture" "$FIXTURE_OUTPUT"

# ---------------------------------------------------------------------------
# 4. Derive the authoritative source-to-page coverage map from Doxygen XML.
# ---------------------------------------------------------------------------
log "building coverage map"
node eng/coverage.mjs

# ---------------------------------------------------------------------------
# 5. Assemble the static payload.
# ---------------------------------------------------------------------------
log "assembling payload into $SITE_DIR"
rm -rf "$SITE_DIR"
mkdir -p "$SITE_DIR"
cp -R "$MAIN_OUTPUT/html/." "$SITE_DIR/"

touch "$SITE_DIR/.nojekyll"

mkdir -p "$SITE_DIR/licenses"
cp "$THEME_SRC/LICENSE" "$SITE_DIR/licenses/doxygen-awesome-css-LICENSE.txt"
cp licenses/doxygen-output-exception.txt "$SITE_DIR/licenses/doxygen-output-exception.txt"
cp licenses/doxygen-javascript-MIT.txt "$SITE_DIR/licenses/doxygen-javascript-MIT.txt"
cp licenses/apache-2.0-LICENSE.txt "$SITE_DIR/licenses/apache-2.0-LICENSE.txt"
cp LICENSE "$SITE_DIR/LICENSE"
cp THIRD_PARTY_NOTICES.md "$SITE_DIR/THIRD_PARTY_NOTICES.md"

log "payload assembled"
