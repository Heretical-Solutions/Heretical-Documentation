#!/usr/bin/env bash
# Source-independent structural checks. This command needs no source credentials,
# Doxygen download, theme restore, or network access, and is safe for untrusted PRs
# running without repository secrets. It is not a substitute for full validation.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

for script in eng/*.sh eng/lib/*.sh; do
  bash -n "$script" || die "shell syntax failed: $script"
done
for script in eng/*.mjs; do
  node --check "$script" || die "JavaScript syntax failed: $script"
done

MANIFEST="$MANIFEST" THEME_COMMIT="$THEME_COMMIT" THEME_VERSION="$THEME_VERSION" node - <<'NODE'
const fs = require('node:fs');
const manifest = JSON.parse(fs.readFileSync(process.env.MANIFEST, 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const fail = (message) => { throw new Error(message); };
const dependency = pkg.dependencies?.['@jothepro/doxygen-awesome-css'];
if (!dependency?.startsWith('git+https://')) fail('theme dependency must use credential-free HTTPS');
if (!dependency?.endsWith(`#${process.env.THEME_COMMIT}`)) fail('package.json theme commit mismatch');
const locked = lock.packages?.['node_modules/@jothepro/doxygen-awesome-css'];
if (locked?.version !== process.env.THEME_VERSION) fail('locked theme version mismatch');
if (locked?.resolved !== dependency) fail('package and lock theme resolution differ');
const ids = new Set();
const destinations = new Set(['content/index.md', 'content/provenance.md', 'content/infrastructure.md']);
for (const source of manifest.sources || []) {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(source.id || '') || ids.has(source.id)) fail(`invalid or duplicate source id: ${source.id}`);
  ids.add(source.id);
  if (!/^[0-9a-f]{40}$/.test(source.commit || '')) fail(`${source.id}: source revision must be a full SHA`);
  for (const field of ['repository', 'web']) {
    const url = new URL(source[field]);
    if (url.protocol !== 'https:' || url.username || url.password) fail(`${source.id}: unsafe ${field} URL`);
  }
  if (!source.destPrefix || source.destPrefix.startsWith('/') || source.destPrefix.includes('\\')) fail(`${source.id}: invalid destination prefix`);
  if (!Array.isArray(source.files) || !source.files.length) fail(`${source.id}: no documents declared`);
  for (const doc of source.files) {
    const dest = `${source.destPrefix}/${doc.dest || doc.src}`;
    const invalidSegment = dest.split('/').some((segment) => !segment || segment === '.' || segment === '..');
    if (!doc.src || dest.includes('\\') || invalidSegment || destinations.has(dest)) {
      fail(`${source.id}: invalid or duplicate destination ${dest}`);
    }
    destinations.add(dest);
  }
}
if (!ids.size) fail('source manifest is empty');
console.log(`structure: ${ids.size} source mappings and ${destinations.size - 3} declared documents; HTTPS theme pin verified`);
NODE

log "source-independent structural checks passed; full validation still requires restored sources"
