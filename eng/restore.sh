#!/usr/bin/env bash
#
# Clean, deterministic restore of the pinned toolchain, theme, and source revisions
# into ignored artifact directories. Nothing is installed globally or system-wide.
#
# Usage: eng/restore.sh [--clean]
#   --clean   discard the restored Doxygen binary, node_modules, and source
#             checkouts before restoring them again
#
# Pins (see eng/lib/common.sh and eng/sources.manifest.json):
#   * Doxygen 1.18.0 official Linux x86_64 release, verified by SHA-256 and version
#   * Doxygen Awesome CSS 2.5.0 at exact git commit, via package-lock.json (npm ci)
#   * Each documented source at its exact commit, cloned under artifacts/sources
#
# Local-preview overrides (never silently change production provenance):
#   PORTAL_SRC_<ID>_PATH=<dir>   use a local checkout instead of cloning (mode: local-override)
#   PORTAL_SRC_<ID>_SHA=<sha>    clone an alternate exact commit (mode: dispatch-sha)
# The resolved state is recorded in artifacts/restore-manifest.json and reflected
# in the generated provenance page.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

clean=false
while (($#)); do
  case "$1" in
  --clean)
    clean=true
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

require_cmd curl
require_cmd sha256sum
require_cmd tar
require_cmd git
require_cmd node
require_cmd npm

if $clean; then
  log "clean: removing restored Doxygen, node_modules, and source checkouts"
  rm -rf "$TOOLS_DIR" "$SOURCES_DIR" node_modules "$RESTORE_MANIFEST"
fi

# ---------------------------------------------------------------------------
# 1. Doxygen 1.18.0 (pinned binary, verified by hash and version)
# ---------------------------------------------------------------------------
mkdir -p "$TOOLS_DIR"
if [[ -f "$DOXYGEN_TARBALL" ]]; then
  have="$(sha256_of "$DOXYGEN_TARBALL")"
  if [[ "$have" == "$DOXYGEN_SHA256" ]]; then
    log "Doxygen tarball present with matching SHA-256; skipping download"
  else
    die "Doxygen tarball SHA-256 mismatch: have $have, expected $DOXYGEN_SHA256"
  fi
else
  log "downloading pinned Doxygen ${DOXYGEN_VERSION}"
  tmp_dl="${DOXYGEN_TARBALL}.part"
  curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 --max-time 1200 -o "$tmp_dl" "$DOXYGEN_URL" || die "Doxygen download failed"
  mv "$tmp_dl" "$DOXYGEN_TARBALL"
  have="$(sha256_of "$DOXYGEN_TARBALL")"
  [[ "$have" == "$DOXYGEN_SHA256" ]] || { rm -f "$DOXYGEN_TARBALL"; die "Doxygen tarball SHA-256 mismatch after download: have $have, expected $DOXYGEN_SHA256"; }
  log "verified Doxygen tarball SHA-256"
fi

if [[ ! -x "$DOXYGEN_BIN" ]]; then
  log "extracting Doxygen into $TOOLS_DIR"
  rm -rf "$DOXYGEN_DIR"
  tar xzf "$DOXYGEN_TARBALL" -C "$TOOLS_DIR"
fi
verify_doxygen
DOXY_COMMIT="$("$DOXYGEN_BIN" --version | sed -n 's/.*(\([0-9a-fA-F]*\)).*/\1/p')"
[[ -n "$DOXY_COMMIT" ]] || DOXY_COMMIT="unknown"
log "Doxygen ${DOXYGEN_VERSION} ready (revision ${DOXY_COMMIT})"

# ---------------------------------------------------------------------------
# 2. Doxygen Awesome CSS 2.5.0 (frozen npm ci, verified against the git pin)
# ---------------------------------------------------------------------------
[[ -f package-lock.json ]] || die "package-lock.json is missing; the theme pin must be committed"
log "restoring the pinned theme with npm ci"
npm ci --no-audit --no-fund --ignore-scripts >/dev/null

THEME_DIR="node_modules/${THEME_PACKAGE}"
[[ -d "$THEME_DIR" ]] || die "theme not installed at $THEME_DIR"
THEME_INSTALLED_VERSION="$(node -e 'process.stdout.write(require("./'"$THEME_DIR"'/package.json").version)')"
[[ "$THEME_INSTALLED_VERSION" == "$THEME_VERSION" ]] ||
  die "theme version mismatch: installed $THEME_INSTALLED_VERSION, expected $THEME_VERSION"
LOCK_COMMIT="$(node -e 'const l=require("./package-lock.json");const k=Object.keys(l.packages).find(x=>x.includes("doxygen-awesome"));process.stdout.write((l.packages[k].resolved||"").split("#").pop())')"
[[ "$LOCK_COMMIT" == "$THEME_COMMIT" ]] ||
  die "theme commit mismatch: lock resolves ${LOCK_COMMIT}, expected ${THEME_COMMIT}"
log "theme ${THEME_VERSION} ready at commit ${THEME_COMMIT}"

# ---------------------------------------------------------------------------
# 3. Source revisions (exact commits cloned, or documented overrides)
# ---------------------------------------------------------------------------
mkdir -p "$SOURCES_DIR"
STATE_TSV="$ARTIFACTS_DIR/.restore-state.tsv"
: >"$STATE_TSV"

source_git() {
  if [[ -n "${PORTAL_SOURCE_TOKEN:-}" ]]; then
    # Askpass returns the token only to Git's password prompt. Keep it out of
    # remote URLs and command arguments; no token is persisted in the checkout.
    GIT_ASKPASS="$PORTAL_ROOT/eng/source-askpass.sh" GIT_TERMINAL_PROMPT=0 git "$@"
  else
    # A local developer's existing Git credential helper may supply access.
    git "$@"
  fi
}

clone_exact() { # url commit dest
  local url="$1" commit="$2" dest="$3"
  rm -rf "$dest"
  mkdir -p "$dest"
  git -C "$dest" init -q
  git -C "$dest" remote add origin "$url"
  if source_git -C "$dest" fetch --depth 1 --no-tags origin "$commit" >/dev/null 2>&1; then
    git -C "$dest" checkout -q --detach FETCH_HEAD
  else
    log "shallow fetch by SHA unavailable; falling back to a branch fetch"
    source_git -C "$dest" fetch -q --no-tags origin "+refs/heads/*:refs/remotes/origin/*" ||
      die "source fetch failed for $url; private sources require a configured Git credential or PORTAL_SOURCE_TOKEN"
    git -C "$dest" checkout -q --detach "$commit" || die "commit $commit not reachable in $url"
  fi
}

# Emit id<TAB>repository<TAB>web<TAB>commit<TAB>ref<TAB>name for each manifest source.
while IFS=$'\t' read -r id repository web commit ref name; do
  [[ -n "$id" ]] || continue
  upper="$(printf '%s' "$id" | tr '[:lower:]' '[:upper:]' | tr -c 'A-Z0-9' '_')"
  path_var="PORTAL_SRC_${upper}_PATH"
  sha_var="PORTAL_SRC_${upper}_SHA"
  ov_path="${!path_var-}"
  ov_sha="${!sha_var-}"
  dest="$SOURCES_DIR/$id"

  if [[ -n "$ov_path" ]]; then
    [[ -d "$ov_path" ]] || die "override path for $id does not exist: $ov_path"
    actual="$(git -C "$ov_path" rev-parse HEAD 2>/dev/null || echo 'working-tree')"
    mode="local-override"
    src_path="$ov_path"
    log "$id: LOCAL PREVIEW from $ov_path (HEAD ${actual}); not a production restore"
  elif [[ -n "$ov_sha" ]]; then
    [[ "$ov_sha" =~ ^[0-9a-f]{40}$ ]] || die "override SHA for $id must be a full 40-hex commit: $ov_sha"
    clone_exact "$repository" "$ov_sha" "$dest"
    actual="$(git -C "$dest" rev-parse HEAD)"
    [[ "$actual" == "$ov_sha" ]] || die "override SHA checkout mismatch for $id: $actual != $ov_sha"
    mode="dispatch-sha"
    src_path="$dest"
    log "$id: dispatched exact SHA $actual"
  else
    clone_exact "$repository" "$commit" "$dest"
    actual="$(git -C "$dest" rev-parse HEAD)"
    [[ "$actual" == "$commit" ]] || die "$id checkout mismatch: have $actual, expected $commit"
    mode="pinned"
    src_path="$dest"
    log "$id: pinned at $actual"
  fi

  printf '%s\t%s\t%s\t%s\n' "$id" "$actual" "$mode" "$src_path" >>"$STATE_TSV"
done < <(manifest_node '
  const fs=require("fs");const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
  for(const s of m.sources) console.log([s.id,s.repository,s.web,s.commit,s.ref||"",s.name].join("\t"));
')

# ---------------------------------------------------------------------------
# 4. Write artifacts/restore-manifest.json
# ---------------------------------------------------------------------------
NODE_DOXY_VERSION="$DOXYGEN_VERSION" NODE_DOXY_COMMIT="$DOXY_COMMIT" NODE_DOXY_URL="$DOXYGEN_URL" \
NODE_DOXY_SHA="$DOXYGEN_SHA256" NODE_DOXY_PATH="$DOXYGEN_BIN" \
NODE_THEME_PACKAGE="$THEME_PACKAGE" NODE_THEME_VERSION="$THEME_VERSION" NODE_THEME_COMMIT="$THEME_COMMIT" \
NODE_STATE="$STATE_TSV" NODE_OUT="$RESTORE_MANIFEST" NODE_MANIFEST="$MANIFEST" \
node -e '
  const fs=require("fs");const path=require("path");
  const manifest=JSON.parse(fs.readFileSync(process.env.NODE_MANIFEST,"utf8"));
  const byId=new Map(manifest.sources.map(s=>[s.id,s]));
  const state=fs.readFileSync(process.env.NODE_STATE,"utf8").split("\n").filter(l=>l.trim());
  const sources=state.map(line=>{
    const [id,actualCommit,mode,sourcePath]=line.split("\t");
    const m=byId.get(id);
    return {id,name:m.name,repository:m.repository,web:m.web,ref:m.ref||"",
            expectedCommit:m.commit,actualCommit,mode,
            sourcePath:path.relative(process.cwd(),path.resolve(sourcePath))};
  });
  const out={
    schema:1,
    generatedAt:new Date().toISOString(),
    host:{platform:process.platform,arch:process.arch,release:require("os").release()},
    node:process.versions.node?"v"+process.versions.node:process.version,
    npm:require("child_process").execSync("npm --version").toString().trim(),
    doxygen:{version:process.env.NODE_DOXY_VERSION,commit:process.env.NODE_DOXY_COMMIT,
             url:process.env.NODE_DOXY_URL,sha256:process.env.NODE_DOXY_SHA,
             expectedSha256:process.env.NODE_DOXY_SHA,path:process.env.NODE_DOXY_PATH},
    theme:{package:process.env.NODE_THEME_PACKAGE,version:process.env.NODE_THEME_VERSION,
           commit:process.env.NODE_THEME_COMMIT,expectedCommit:process.env.NODE_THEME_COMMIT,
           path:"node_modules/"+process.env.NODE_THEME_PACKAGE},
    sources
  };
  fs.writeFileSync(process.env.NODE_OUT, JSON.stringify(out,null,2)+"\n");
'
rm -f "$STATE_TSV"

log "restore complete; wrote $RESTORE_MANIFEST"
