#!/usr/bin/env node
//
// eng/assemble.mjs — aggregate pinned source revisions into the ignored
// intermediate tree that Doxygen consumes, preserving each repository's relative
// layout so ordinary relative links and media resolve, and rewriting only the
// links that fall outside the published set (excluded same-repo files and
// cross-repository mounts) to canonical exact-revision source URLs.
//
// It also emits the portal landing page's companion provenance document and the
// machine-readable coverage input and link-rewrite log that eng/validate.sh
// consumes. It never modifies canonical sources or the tracked manifest.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, execSync } from 'node:child_process';

const PORTAL_ROOT = path.resolve(import.meta.dirname, '..');
const MANIFEST_PATH = path.join(PORTAL_ROOT, 'eng', 'sources.manifest.json');
const RESTORE_PATH = path.join(PORTAL_ROOT, 'artifacts', 'restore-manifest.json');
const ASSEMBLED = path.join(PORTAL_ROOT, 'artifacts', 'intermediates');
const CONTENT_DIR = path.join(PORTAL_ROOT, 'content');

const IS_SHA = /^[0-9a-f]{40}$/;

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function fail(msg) {
  console.error(`assemble: ${msg}`);
  process.exit(1);
}

function posixNormalize(rel) {
  const out = [];
  for (const seg of rel.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop();
      else out.push('..');
      continue;
    }
    out.push(seg);
  }
  return out.join('/');
}

function isExternal(target) {
  return (
    target.startsWith('#') ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target) || // scheme: (http, https, mailto, tel, ...)
    target.startsWith('//')
  );
}

function splitTarget(raw) {
  let target = raw.trim();
  let angled = false;
  if (target.startsWith('<') && target.includes('>')) {
    const end = target.indexOf('>');
    angled = true;
    const inner = target.slice(1, end);
    return { target: inner, rest: target.slice(end + 1).trim(), angled };
  }
  const ws = target.search(/\s/);
  if (ws === -1) return { target, rest: '', angled };
  return { target: target.slice(0, ws), rest: target.slice(ws + 1).trim(), angled };
}

function splitFragment(target) {
  const i = target.indexOf('#');
  if (i === -1) return { pathPart: target, frag: '' };
  return { pathPart: target.slice(0, i), frag: target.slice(i) };
}

// ---- Markdown code protection -------------------------------------------------
// Links inside fenced code blocks and inline code spans must never be rewritten.
function maskCode(md) {
  const masks = [];
  let text = md.replace(/(^|\n)(```|~~~)[^\n]*\n[\s\S]*?\n\2(?=\n|$)/g, (m) => {
    masks.push(m);
    return `\u0000M${masks.length - 1}\u0000`;
  });
  text = text.replace(/(`+)(?:(?!\1)[^\n])*\1/g, (m) => {
    masks.push(m);
    return `\u0000M${masks.length - 1}\u0000`;
  });
  return { text, masks };
}

function unmaskCode(text, masks) {
  return text.replace(/\u0000M(\d+)\u0000/g, (_, i) => masks[Number(i)]);
}

// ---- Link rewriting -----------------------------------------------------------

function rewriteOne(rawInner, ctx, rewrites) {
  const { target, rest, angled } = splitTarget(rawInner);
  if (target === '' || isExternal(target)) return null; // leave untouched

  const { pathPart, frag } = splitFragment(target);
  const isImage = ctx.image;
  const kindSeg = isImage ? 'raw' : 'blob';

  let base;
  if (pathPart.startsWith('/')) {
    base = ''; // repository-root-relative
    var rootRel = posixNormalize(pathPart.slice(1));
  } else {
    base = path.posix.dirname(ctx.relCoords);
    var rootRel = posixNormalize(path.posix.join(base, pathPart));
  }

  let newTarget;
  let reason;

  if (ctx.kind === 'portal') {
    if (!ctx.intermediateSet.has(rootRel)) {
      fail(`portal content link resolves to a missing published page: ${rawInner} (in ${ctx.intermRel})`);
    }
    newTarget = path.posix.relative(path.posix.dirname(ctx.intermRel), rootRel) + frag;
    if (newTarget === '') newTarget = '.';
    reason = 'portal-in-set';
  } else {
    const key = `${ctx.sourceId}:${rootRel}`;
    if (ctx.publishedIndex.has(key)) {
      const interm = ctx.publishedIndex.get(key);
      newTarget = path.posix.relative(path.posix.dirname(ctx.intermRel), interm) + frag;
      reason = 'in-set';
    } else {
      if (ctx.publicSource === false) {
        // The public portal must not advertise a private repository or turn an
        // unmapped path into a guessed source URL. In-set links were already
        // preserved. Link to the local availability note for everything else.
        newTarget = path.posix.relative(path.posix.dirname(ctx.intermRel), 'source-availability.md') + frag;
        reason = 'private-source';
        rewrites.push({ file: ctx.intermRel, from: rawInner, to: newTarget, reason });
        return rest ? `${newTarget} ${rest}` : newTarget;
      }
      const mount = ctx.mounts.find(
        (m) => rootRel === m.sourcePath || rootRel.startsWith(m.sourcePath + '/'),
      );
      const ref = ctx.canonicalRef;
      const urlBase = `${ctx.web}/${kindSeg}/${ref}`;
      if (ctx.portalGitlink && (rootRel === 'sites/documentation' || rootRel.startsWith('sites/documentation/'))) {
        const mRel = rootRel === 'sites/documentation' ? '' : rootRel.slice('sites/documentation/'.length);
        newTarget = `https://github.com/Heretical-Solutions/Heretical-Documentation/${kindSeg}/${ctx.portalGitlink}${mRel ? '/' + mRel : ''}${frag}`;
        reason = 'cross-repo-gitlink';
      } else if (mount) {
        const mSrc = ctx.byId.get(mount.sourceId);
        const mRef = ctx.canonicalRefsById.get(mount.sourceId);
        const mRel = rootRel === mount.sourcePath ? '' : rootRel.slice(mount.sourcePath.length + 1);
        newTarget = `${mSrc.web}/${kindSeg}/${mRef}${mRel ? '/' + mRel : ''}${frag}`;
        reason = 'cross-repo';
      } else if (ctx.fileExists(rootRel)) {
        newTarget = `${urlBase}/${rootRel}${frag}`;
        reason = 'out-of-set';
      } else {
        newTarget = `${urlBase}/${rootRel}${frag}`;
        reason = 'unresolved';
      }
    }
  }

  rewrites.push({
    file: ctx.intermRel,
    from: rawInner,
    to: newTarget,
    reason,
  });

  // Re-emit the link, preserving any title and angle-wrapping when the target
  // became an absolute URL that could contain spaces (it does not here, but be
  // conservative for cross-repo/raw URLs).
  const needsAngle = /[()\s]/.test(newTarget) && !newTarget.startsWith('#');
  const wrapped = angled || needsAngle ? `<${newTarget}>` : newTarget;
  return rest ? `${wrapped} ${rest}` : wrapped;
}

function rewriteMarkdown(md, ctx, rewrites) {
  const { text, masks } = maskCode(md);

  // Inline links and images: ![alt](...) or [text](...)
  let out = text.replace(
    /(!?)\[((?:[^\[\]]|\[[^\]]*\])*)\]\(([^)]*)\)/g,
    (whole, bang, label, inner) => {
      const ctx2 = { ...ctx, image: bang === '!' };
      const replaced = rewriteOne(inner, ctx2, rewrites);
      return replaced === null ? whole : `${bang}[${label}](${replaced})`;
    },
  );

  // Reference definitions: [label]: target  "optional title"
  out = out.replace(
    /^([ \t]*)\[([^\]]+)\]:[ \t]*(\S+)([ \t]+.*)?$/gm,
    (whole, indent, label, target, title) => {
      const replaced = rewriteOne(target + (title || ''), ctx, rewrites);
      if (replaced === null) return whole;
      const t = title ? ` ${title.trim()}` : '';
      return `${indent}[${label}]: ${replaced}${t}`;
    },
  );

  return unmaskCode(out, masks);
}

// ---- Provenance ---------------------------------------------------------------

function gitInfo() {
  const run = (args) => {
    try {
      return execSync(`git ${args}`, { cwd: PORTAL_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return null;
    }
  };
  const head = run('rev-parse HEAD');
  const branch = run('rev-parse --abbrev-ref HEAD');
  const porcelain = run('status --porcelain');
  return {
    revision: head ?? 'unborn (pre-first-commit)',
    branch: branch ?? 'unknown',
    dirty: porcelain === null ? null : porcelain.length > 0,
  };
}

function buildProvenance(manifest, restore, coverageEntries, rewriteStats, portal) {
  const now = new Date().toISOString();
  const production = restore.sources.every((s) => s.mode !== 'local-override');
  const lines = [];
  lines.push('# Source Provenance');
  lines.push('');
  lines.push(`This page is generated by \`eng/assemble.mjs\` from the actual inputs of this build. It is portal output, not a canonical source document.`);
  lines.push('');
  lines.push(`- **Build mode:** ${production ? 'production (explicit pinned or dispatched revisions)' : 'local preview (one or more sources overridden)'}`);
  lines.push(`- **Generated (UTC):** ${now}`);
  lines.push(`- **Host:** ${os.platform()} ${os.release()} (${os.arch()})`);
  lines.push(`- **Node / npm:** ${restore.node} / ${restore.npm}`);
  lines.push('');
  lines.push('## Portal source');
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|---|---|');
  lines.push(`| Repository | <https://github.com/Heretical-Solutions/Heretical-Documentation> |`);
  lines.push(`| Branch | \`${portal.branch}\` |`);
  lines.push(`| Revision | \`${portal.revision}\` |`);
  lines.push(`| Working tree | ${portal.dirty === null ? 'unknown' : portal.dirty ? 'dirty (uncommitted changes present)' : 'clean'} |`);
  lines.push('');
  lines.push('> A local-preview build reflects an uncommitted or overridden working tree and is **not** a reproducible publication. Production publications build from the exact revisions below.');
  lines.push('');
  lines.push('## Toolchain');
  lines.push('');
  lines.push('| Component | Version | Revision / hash | Role |');
  lines.push('|---|---|---|---|');
  lines.push(`| Doxygen | ${restore.doxygen.version} | \`${restore.doxygen.commit}\` | Build-only generator (GPL-2.0 with the upstream output exception; binary not distributed) |`);
  lines.push(`| Doxygen Awesome CSS | ${restore.theme.version} | \`${restore.theme.commit}\` | Distributed theme (MIT); CSS/JS shipped in the payload |`);
  lines.push('');
  lines.push('## Aggregated sources');
  lines.push('');
  lines.push('| Source | Name | Ref | Mode | Commit used | Documents |');
  lines.push('|---|---|---|---|---|---|');
  for (const s of restore.sources) {
    const sourceDefinition = manifest.sources.find((item) => item.id === s.id);
    const isPrivate = sourceDefinition && sourceDefinition.public === false;
    const count = coverageEntries.filter((c) => c.sourceId === s.id).length;
    lines.push(`| \`${s.id}\` | ${s.name} | \`${s.ref}\` | ${s.mode} | ${isPrivate ? 'private revision withheld' : `\`${s.actualCommit}\``} | ${count} |`);
  }
  lines.push('');
  lines.push('## Coverage');
  lines.push('');
  lines.push(`- Published source documents: **${coverageEntries.filter((c) => c.kind === 'source').length}**`);
  lines.push(`- Portal-owned pages: landing index, source availability and this provenance page`);
  lines.push(`- Private-source revisions are withheld from public provenance. Exact private inputs remain in internal build/compatibility records.`);
  lines.push(`- Link rewrites applied in intermediates: **${rewriteStats.total}** (${rewriteStats.inSet} in-set preserved, ${rewriteStats.outOfSet} out-of-set, ${rewriteStats.crossRepo} cross-repo, ${rewriteStats.unresolved} unresolved)`);
  lines.push('');
  lines.push('The explicit coverage mapping is tracked in `eng/sources.manifest.json`. No document is published unless it is listed there; arbitrary repository files are never crawled.');
  lines.push('');
  lines.push('## Extraction disclaimer');
  lines.push('');
  lines.push('Doxygen extraction proves that documented types and members were read from source. It does **not** prove compilation, runtime behaviour, or engine/Unity compatibility. The C# extraction fixture is non-published and demonstrates extraction only.');
  lines.push('');
  return lines.join('\n');
}

// ---- Main ---------------------------------------------------------------------

function main() {
  const manifest = readJson(MANIFEST_PATH);
  if (!fs.existsSync(RESTORE_PATH)) {
    fail('artifacts/restore-manifest.json is missing; run eng/restore.sh first');
  }
  const restore = readJson(RESTORE_PATH);
  const restoreById = new Map(restore.sources.map((s) => [s.id, s]));

  const byId = new Map(manifest.sources.map((s) => [s.id, s]));
  const mounts = manifest.mounts || [];

  // canonicalRef: which revision out-of-set/cross-repo links point at.
  const canonicalRefsById = new Map();
  for (const s of manifest.sources) {
    const r = restoreById.get(s.id);
    if (!r) fail(`restore-manifest has no entry for source '${s.id}'`);
    canonicalRefsById.set(s.id, r.mode === 'dispatch-sha' && IS_SHA.test(r.actualCommit) ? r.actualCommit : s.commit);
  }

  // A workspace catalog link into this portal must use the registered portal
  // gitlink, not a superproject blob URL for a directory that Git stores as a
  // submodule. Read only the source checkout's index; never an ambient sibling.
  const portalGitlinksById = new Map();
  for (const s of restore.sources) {
    const root = path.resolve(PORTAL_ROOT, s.sourcePath);
    try {
      const index = execFileSync('git', ['-C', root, 'ls-files', '--stage', '--', 'sites/documentation'], { encoding: 'utf8' });
      const match = index.match(/^160000 ([0-9a-f]{40}) \d+\tsites\/documentation$/m);
      if (match) portalGitlinksById.set(s.id, match[1]);
    } catch {
      // An ordinary source directory or an older revision has no portal gitlink.
    }
  }

  // Reset the assembled tree.
  fs.rmSync(ASSEMBLED, { recursive: true, force: true });
  fs.mkdirSync(ASSEMBLED, { recursive: true });

  const publishedIndex = new Map(); // "sourceId:srcRel" -> intermediateRel
  const intermediateSet = new Set();
  const coverageEntries = [];

  // Copy published source files, preserving relative layout under destPrefix.
  for (const src of manifest.sources) {
    const r = restoreById.get(src.id);
    const sourceRoot = path.join(PORTAL_ROOT, r.sourcePath);
    if (!fs.existsSync(sourceRoot)) fail(`restored source not found at ${r.sourcePath} for '${src.id}'`);
    for (const entry of src.files) {
      const destRel = entry.dest || entry.src;
      const intermRel = posixNormalize(`${src.destPrefix}/${destRel}`);
      const absSrc = path.join(sourceRoot, entry.src);
      if (!fs.existsSync(absSrc) || !fs.statSync(absSrc).isFile()) {
        fail(`manifest lists a missing source file: ${src.id}:${entry.src}`);
      }
      const absDest = path.join(ASSEMBLED, intermRel);
      fs.mkdirSync(path.dirname(absDest), { recursive: true });
      if (src.public === false) {
        const privateRevisionPattern = /\b[0-9a-f]{40}\b/g;
        const privateRevisions = new Set([src.commit, ...restore.sources.filter((s) => s.id === src.id).map((s) => s.actualCommit)]);
        // Compatibility records may cite earlier private source-lock revisions
        // that are not this build's input. Collect those exact internal SHAs for
        // redaction without hiding public upstream/deployment provenance.
        const compatibilityText = fs.readFileSync(absSrc, 'utf8');
        for (const match of compatibilityText.matchAll(privateRevisionPattern)) privateRevisions.add(match[0]);
        // Private source stays exact in restore/compatibility records. Public
        // output redacts private revisions, private source links and known
        // developer checkout paths in the ignored intermediate only.
        let publicText = fs.readFileSync(absSrc, 'utf8');
        for (const revision of privateRevisions) {
          publicText = publicText.split(revision).join('[private source revision withheld]');
        }
        publicText = publicText.replace(/https?:\/\/github\.com\/Heretical-Solutions\/Heretical-Development[^\s)\]>"]*/g, '[private source link withheld]');
        publicText = publicText.replace(/(?:\/SSD1\/|\/home\/[A-Za-z0-9._-]+\/|\/Users\/[A-Za-z0-9._-]+\/|\/tmp\/kilo(?:\/|\b)|[A-Za-z]:\\Users\\)[^\s)`"']*/g, '[machine-local path]');
        fs.writeFileSync(absDest, publicText);
      } else {
        fs.copyFileSync(absSrc, absDest);
      }
      if (src.public !== false) {
        // Older pinned public documentation may mention a previous tool-specific
        // cache default. Public output must not depend on a developer checkout.
        const publicText = fs.readFileSync(absDest, 'utf8')
          .replace(/\$\{BLOG_TMPDIR:-\/tmp\/kilo\}/g, '${BLOG_TMPDIR:-${TMPDIR:-/tmp}/heretical-blog}')
          .replace(/\/SSD1\/Ruby gems/g, '/path with spaces/gems')
          .replace(/\/tmp\/kilo\//g, '${TMPDIR:-/tmp}/heretical-blog/')
          .replace(/\/tmp\/kilo(?=[\s)`"'])/g, '${TMPDIR:-/tmp}/heretical-blog');
        fs.writeFileSync(absDest, publicText);
      }
      publishedIndex.set(`${src.id}:${posixNormalize(entry.src)}`, intermRel);
      intermediateSet.add(intermRel);
      coverageEntries.push({
        kind: 'source',
        sourceId: src.id,
        src: entry.src,
        intermediatePath: intermRel,
        canonicalUrl: src.public === false ? null : `${src.web}/blob/${canonicalRefsById.get(src.id)}/${entry.src}`,
      });
    }
  }

  // Portal landing page.
  const availability = `# Source Availability\n\nSome aggregated source documents originate from a private workspace repository.\nPublic portal pages preserve their reviewed content and internal navigation, but\ndo not link to private repository paths or expose private source revisions.\n\nExact private source inputs remain in the internal build and compatibility\nrecords. Public upstream sources retain their normal source provenance.\n\n`;
  fs.writeFileSync(path.join(ASSEMBLED, 'source-availability.md'), availability);
  intermediateSet.add('source-availability.md');
  coverageEntries.push({ kind: 'portal', sourceId: 'portal', src: 'source-availability.md', intermediatePath: 'source-availability.md' });

  const landingSrc = path.join(CONTENT_DIR, 'index.md');
  if (!fs.existsSync(landingSrc)) fail('content/index.md is missing');
  for (const entry of fs.readdirSync(CONTENT_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    if (entry.name === 'provenance.md' || entry.name === 'source-availability.md') {
      fail(`content/${entry.name} is generated by the portal and cannot be a tracked navigation page`);
    }
    const intermRel = entry.name;
    fs.copyFileSync(path.join(CONTENT_DIR, entry.name), path.join(ASSEMBLED, intermRel));
    intermediateSet.add(intermRel);
    coverageEntries.push({ kind: 'portal', sourceId: 'portal', src: `content/${entry.name}`, intermediatePath: intermRel });
  }

  // Provenance page (generated).
  const portal = gitInfo();
  const rewrites = [];
  const provMd = buildProvenance(manifest, restore, coverageEntries, { total: 0, inSet: 0, outOfSet: 0, crossRepo: 0, unresolved: 0 }, portal);
  fs.writeFileSync(path.join(ASSEMBLED, 'provenance.md'), provMd);
  intermediateSet.add('provenance.md');
  coverageEntries.push({ kind: 'portal', sourceId: 'portal', src: 'provenance.md', intermediatePath: 'provenance.md' });

  // Rewrite links in published source files (source coordinates).
  for (const entry of coverageEntries.filter((c) => c.kind === 'source')) {
    const srcDef = byId.get(entry.sourceId);
    const r = restoreById.get(entry.sourceId);
    const abs = path.join(ASSEMBLED, entry.intermediatePath);
    const md = fs.readFileSync(abs, 'utf8');
    const ctx = {
      kind: 'source',
      sourceId: entry.sourceId,
      relCoords: entry.src,        // source-relative for resolution
      intermRel: entry.intermediatePath,
      web: srcDef.web,
      canonicalRef: canonicalRefsById.get(entry.sourceId),
      publicSource: srcDef.public !== false,
      publishedIndex,
      intermediateSet,
      mounts,
      byId,
      canonicalRefsById,
      portalGitlink: portalGitlinksById.get(entry.sourceId) || null,
      fileExists: (rel) => {
        const p = path.join(PORTAL_ROOT, r.sourcePath, rel);
        return fs.existsSync(p) && fs.statSync(p).isFile();
      },
    };
    fs.writeFileSync(abs, rewriteMarkdown(md, ctx, rewrites));
  }

  // Rewrite links in portal pages (intermediate coordinates).
  for (const rel of ['index.md', 'provenance.md', 'source-availability.md']) {
    const abs = path.join(ASSEMBLED, rel);
    const md = fs.readFileSync(abs, 'utf8');
    const ctx = { kind: 'portal', relCoords: rel, intermRel: rel, publishedIndex, intermediateSet, mounts, byId, canonicalRefsById };
    fs.writeFileSync(abs, rewriteMarkdown(md, ctx, rewrites));
  }

  const rewriteStats = {
    total: rewrites.length,
    inSet: rewrites.filter((r) => r.reason === 'in-set' || r.reason === 'portal-in-set').length,
    outOfSet: rewrites.filter((r) => r.reason === 'out-of-set').length,
    crossRepo: rewrites.filter((r) => r.reason.startsWith('cross-repo')).length,
    unresolved: rewrites.filter((r) => r.reason === 'unresolved').length,
  };

  // Regenerate provenance now that rewrite stats are known, then rewrite its links.
  const provFinal = buildProvenance(manifest, restore, coverageEntries, rewriteStats, portal);
  fs.writeFileSync(path.join(ASSEMBLED, 'provenance.md'), provFinal);
  {
    const ctx = { kind: 'portal', relCoords: 'provenance.md', intermRel: 'provenance.md', publishedIndex, intermediateSet, mounts, byId, canonicalRefsById };
    fs.writeFileSync(path.join(ASSEMBLED, 'provenance.md'), rewriteMarkdown(provFinal, ctx, rewrites));
  }
  rewriteStats.total = rewrites.length;
  rewriteStats.inSet = rewrites.filter((r) => r.reason === 'in-set' || r.reason === 'portal-in-set').length;

  fs.writeFileSync(
    path.join(PORTAL_ROOT, 'artifacts', 'coverage-input.json'),
    JSON.stringify({ schema: 1, assembled: 'artifacts/intermediates', entries: coverageEntries }, null, 2) + '\n',
  );
  fs.writeFileSync(
    path.join(PORTAL_ROOT, 'artifacts', 'link-rewrites.json'),
    JSON.stringify({ schema: 1, stats: rewriteStats, rewrites }, null, 2) + '\n',
  );

  if (rewriteStats.unresolved > 0) {
    console.warn(`assemble: WARNING ${rewriteStats.unresolved} link(s) could not be classified (see artifacts/link-rewrites.json)`);
  }
  console.log(`assemble: published ${coverageEntries.filter((c) => c.kind === 'source').length} source documents; ${rewriteStats.total} link rewrites (in-set ${rewriteStats.inSet}, out-of-set ${rewriteStats.outOfSet}, cross-repo ${rewriteStats.crossRepo}, unresolved ${rewriteStats.unresolved})`);
}

main();
