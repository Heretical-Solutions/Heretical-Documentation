#!/usr/bin/env node
//
// eng/checks.mjs — authoritative payload inspection for the documentation portal.
//
// Verifies, over artifacts/site:
//   * every internal link resolves to a real file (no broken links)
//   * every internal #anchor resolves to a real id/name on the target page
//   * no site-root-absolute references (which would break under the project base path)
//   * navigation assets referenced by the treeview exist
//   * coverage: every published source/portal document produced a page (no silent drop)
//   * required payload files (.nojekyll, LICENSE, theme license, notices, landing)
//   * hygiene: no portal machine root, no restored checkout / node_modules / tool
//     binary / fixture output / logs / caches, and no credential material
//
// External (http/https/mailto/…) links are counted but NOT contacted; their liveness
// is a pending manual check, reported separately. Browser rendering is not exercised.

import fs from 'node:fs';
import path from 'node:path';

const PORTAL_ROOT = path.resolve(import.meta.dirname, '..');
const SITE = path.join(PORTAL_ROOT, 'artifacts', 'site');
const COVERAGE_INPUT = path.join(PORTAL_ROOT, 'artifacts', 'coverage-input.json');
const COVERAGE = path.join(PORTAL_ROOT, 'artifacts', 'coverage.json');
const MANIFEST = path.join(PORTAL_ROOT, 'eng', 'sources.manifest.json');
const REPORT = path.join(PORTAL_ROOT, 'artifacts', 'checks.json');

const EXTERNAL_RE = /^(?:https?:|mailto:|tel:|javascript:|data:|\/\/)/i;

function walk(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}

const cache = new Map();
function readSite(rel) {
  if (!cache.has(rel)) cache.set(rel, fs.readFileSync(path.join(SITE, rel), 'utf8'));
  return cache.get(rel);
}

function hasAnchor(html, frag) {
  const esc = frag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b(?:id|name)\\s*=\\s*["']${esc}["']`, 'i').test(html);
}

const findings = {
  brokenLinks: [],
  brokenAnchors: [],
  absoluteRefs: [],
  navMissing: [],
  coverageMissing: [],
  missingRequired: [],
  hygienePaths: [],
  hygieneContent: [],
  misdirectedGitlinks: [],
  elfFiles: [],
};
const counts = { files: 0, html: 0, internalRefs: 0, externalRefs: 0, fragmentRefs: 0, pages: 0 };

const REF_ATTR_RE = /(?:href|src|action|poster)\s*=\s*["']([^"']*)["']/gi;

function checkRefs(rel, html) {
  const dir = path.posix.dirname(rel);
  for (const m of html.matchAll(REF_ATTR_RE)) {
    const raw = m[1].trim();
    if (raw === '') continue;
    if (EXTERNAL_RE.test(raw)) {
      counts.externalRefs++;
      if (/^https:\/\/github\.com\/Heretical-Solutions\/Heretical-Development\/(?:blob|raw)\/[0-9a-f]{40}\/sites\/documentation(?:[/?#]|$)/.test(raw)) {
        findings.misdirectedGitlinks.push({ file: rel, ref: raw });
      }
      continue;
    }
    if (raw.startsWith('#')) {
      counts.fragmentRefs++;
      const frag = raw.slice(1);
      if (frag && !hasAnchor(html, frag)) findings.brokenAnchors.push({ file: rel, anchor: raw });
      continue;
    }
    if (raw.startsWith('/')) { findings.absoluteRefs.push({ file: rel, ref: raw }); continue; }
    counts.internalRefs++;
    let ref = raw;
    const q = ref.indexOf('?');
    if (q !== -1) ref = ref.slice(0, q);
    const hash = ref.indexOf('#');
    const refPath = hash === -1 ? ref : ref.slice(0, hash);
    const frag = hash === -1 ? '' : ref.slice(hash + 1);
    let decoded;
    try { decoded = decodeURIComponent(refPath); } catch { decoded = refPath; }
    let target = path.posix.normalize(path.posix.join(dir === '.' ? '' : dir, decoded));
    let exists = files.has(target);
    if (!exists && !target.endsWith('.html')) {
      const asIndex = path.posix.join(target, 'index.html');
      if (files.has(asIndex)) { target = asIndex; exists = true; }
    }
    if (!exists) { findings.brokenLinks.push({ file: rel, ref: raw, target }); continue; }
    if (frag) {
      counts.fragmentRefs++;
      if (!hasAnchor(readSite(target), frag)) findings.brokenAnchors.push({ file: rel, ref: raw, target });
    }
  }
}

// ---- Navigation references in treeview JS -------------------------------------
function checkNav() {
  const navFiles = [...files].filter((f) => /(^|\/)nav(tree|treedata|index\d*)\.js$/.test(f) || f === 'navtree.js');
  const needed = ['navtree.js'];
  for (const n of needed) if (!files.has(n)) findings.navMissing.push(n);
  const searchDir = [...files].some((f) => f.startsWith('search/'));
  if (!searchDir) findings.navMissing.push('search/');
  for (const nf of navFiles) {
    const js = readSite(nf);
    for (const m of js.matchAll(/([A-Za-z0-9_./-]+\.html)/g)) {
      const t = path.posix.normalize(m[1]);
      if (t.endsWith('.html') && !files.has(t)) findings.navMissing.push(`${nf}->${t}`);
    }
  }
}

// ---- Coverage -----------------------------------------------------------------
function checkCoverage() {
  const input = JSON.parse(fs.readFileSync(COVERAGE_INPUT, 'utf8'));
  const cov = JSON.parse(fs.readFileSync(COVERAGE, 'utf8'));
  for (const e of input.entries) {
    const page = cov.pages[e.intermediatePath];
    if (!page) { findings.coverageMissing.push(`${e.intermediatePath}: no Doxygen page`); continue; }
    if (!files.has(page.page)) findings.coverageMissing.push(`${e.intermediatePath}: page file ${page.page} absent from payload`);
    counts.pages++;
  }
  // Required logical coverage items (plan §444). Map by intermediate path.
  const required = [
    'index.md',
    'provenance.md',
    'source-availability.md',
    'workspace/docs/architecture/overview.md',
    'workspace/CONTRIBUTING.md',
    'workspace/docs/compatibility.md',
    'workspace/docs/releases.md',
    'workspace/docs/repositories.md',
    'products/blog/overview.md',
    'products/blog/docs/build.md',
  ];
  for (const r of required) {
    if (!cov.pages[r]) findings.coverageMissing.push(`required coverage missing: ${r}`);
    else if (!files.has(cov.pages[r].page)) findings.coverageMissing.push(`required page file missing: ${r} -> ${cov.pages[r].page}`);
  }
}

// ---- Required payload files ---------------------------------------------------
function checkRequired() {
  for (const f of [
    '.nojekyll',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'licenses/doxygen-awesome-css-LICENSE.txt',
    'licenses/doxygen-output-exception.txt',
    'licenses/doxygen-javascript-MIT.txt',
    'licenses/apache-2.0-LICENSE.txt',
    'index.html',
  ]) {
    if (!files.has(f)) findings.missingRequired.push(f);
  }
}

// ---- Hygiene ------------------------------------------------------------------
const FORBIDDEN_PATH = [
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)\.git(\/|$)/,
  /(^|\/)\.npm(\/|$)/,
  /(^|\/)__pycache__(\/|$)/,
  /fixture/i,
  /SampleWidget/,
  /^class[A-Za-z0-9_]+\.html$/,
  /warn\.log$/,
  /restore-manifest/,
  /doxygen-1\.18\.0/,
  /\.tar\.gz$/,
  /(^|\/)artifacts\/(tools|sources|intermediates|doxygen)(\/|$)/,
  /\.ts$/,
];
const CREDENTIAL = [
  /\bghp_[A-Za-z0-9]{20,}/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /Authorization\s*:\s*Bearer\s+/i,
  /\bxox[bap/P]-[A-Za-z0-9-]{10,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
];
const PRIVATE_SOURCE_URL = /https?:\/\/github\.com\/Heretical-Solutions\/Heretical-Development(?:[/?#]|$)/i;
const PRIVATE_REVISIONS = new Set(JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).sources.filter((s) => s.public === false).map((s) => s.commit));
const MACHINE_PATH = /(?:\/SSD1\/|\/home\/[A-Za-z0-9._-]+\/|\/Users\/[A-Za-z0-9._-]+\/|\/tmp\/kilo(?:\/|\b)|[A-Za-z]:\\Users\\)/;
const TEXT_EXT = new Set(['.html', '.css', '.js', '.json', '.xml', '.svg', '.txt', '.md', '.map', '']);

function isText(rel) {
  const ext = path.extname(rel).toLowerCase();
  return TEXT_EXT.has(ext);
}

function checkHygiene() {
  const portalAbs = PORTAL_ROOT;                 // machine root
  const portalArtifacts = path.join(PORTAL_ROOT, 'artifacts');
  for (const rel of files) {
    for (const re of FORBIDDEN_PATH) {
      if (re.test(rel)) findings.hygienePaths.push({ file: rel, pattern: re.source });
    }
    const abs = path.join(SITE, rel);
    const buf = Buffer.alloc(4);
    const fd = fs.openSync(abs, 'r');
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) findings.elfFiles.push(rel);
    if (!isText(rel)) continue;
    const content = readSite(rel);
    if (content.includes(portalAbs) || content.includes(portalArtifacts)) {
      findings.hygieneContent.push({ file: rel, reason: 'portal machine path' });
      continue;
    }
    for (const re of CREDENTIAL) {
      if (re.test(content)) findings.hygieneContent.push({ file: rel, reason: `credential pattern ${re.source}` });
    }
    if (PRIVATE_SOURCE_URL.test(content)) findings.hygieneContent.push({ file: rel, reason: 'private source repository URL' });
    for (const revision of PRIVATE_REVISIONS) {
      if (content.includes(revision)) findings.hygieneContent.push({ file: rel, reason: 'private source revision' });
    }
    if (MACHINE_PATH.test(content)) findings.hygieneContent.push({ file: rel, reason: 'developer-specific machine path' });
  }
}

// ---- Main ---------------------------------------------------------------------
if (!fs.existsSync(SITE)) {
  console.error(`checks: no payload at ${path.relative(PORTAL_ROOT, SITE)}; run eng/build.sh`);
  process.exit(1);
}

const all = walk(SITE);
const files = new Set(all);
counts.files = all.length;

for (const rel of all) {
  if (rel.endsWith('.html')) {
    counts.html++;
    checkRefs(rel, readSite(rel));
  }
}
checkNav();
checkCoverage();
checkRequired();
checkHygiene();

const failures =
  findings.brokenLinks.length +
  findings.brokenAnchors.length +
  findings.absoluteRefs.length +
  findings.navMissing.length +
  findings.coverageMissing.length +
  findings.missingRequired.length +
  findings.hygienePaths.length +
  findings.hygieneContent.length +
  findings.elfFiles.length;

const summary = {
  ok: failures === 0,
  counts,
  failures,
  findings,
  externalLinksPendingManual: counts.externalRefs,
};
fs.writeFileSync(REPORT, JSON.stringify(summary, null, 2) + '\n');

console.log(`checks: ${counts.files} files, ${counts.html} HTML, ${counts.internalRefs} internal refs, ${counts.fragmentRefs} fragment refs, ${counts.externalRefs} external refs (not contacted), ${counts.pages} covered pages`);
for (const [k, v] of Object.entries(findings)) {
  if (Array.isArray(v) && v.length) console.log(`checks: ${k}: ${v.length} -> ${JSON.stringify(v.slice(0, 5))}`);
}
if (failures === 0) {
  console.log('checks: PASS');
} else {
  console.log(`checks: FAIL (${failures} issue(s); see ${path.relative(PORTAL_ROOT, REPORT)})`);
}
process.exit(failures === 0 ? 0 : 1);
