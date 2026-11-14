#!/usr/bin/env node
//
// eng/verify-pins.mjs — confirm the restored state matches the tracked pins.
//
// Re-hashes the Doxygen tarball, checks the recorded Doxygen/theme versions and
// the theme git commit in package-lock.json, and verifies each source checkout
// sits on its manifest commit. A local-preview path is reported as non-production;
// a dispatched exact SHA is an explicitly selected production input. Both are recorded.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const PORTAL_ROOT = path.resolve(import.meta.dirname, '..');
const restore = JSON.parse(fs.readFileSync(path.join(PORTAL_ROOT, 'artifacts', 'restore-manifest.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(PORTAL_ROOT, 'eng', 'sources.manifest.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(PORTAL_ROOT, 'package-lock.json'), 'utf8'));

const EXPECT = {
  doxygenVersion: process.env.DOXYGEN_VERSION,
  doxygenSha: process.env.DOXYGEN_SHA256,
  themeVersion: process.env.THEME_VERSION,
  themeCommit: process.env.THEME_COMMIT,
};

const problems = [];
const notes = [];

if (restore.doxygen.version !== EXPECT.doxygenVersion)
  problems.push(`Doxygen version ${restore.doxygen.version} != pinned ${EXPECT.doxygenVersion}`);

const tarball = path.join(PORTAL_ROOT, 'artifacts', 'tools', `doxygen-${EXPECT.doxygenVersion}.linux.bin.tar.gz`);
if (!fs.existsSync(tarball)) problems.push('Doxygen tarball missing under artifacts/tools');
else {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex');
  if (hash !== EXPECT.doxygenSha) problems.push(`Doxygen tarball SHA-256 ${hash} != pinned ${EXPECT.doxygenSha}`);
}

if (restore.theme.version !== EXPECT.themeVersion)
  problems.push(`theme version ${restore.theme.version} != pinned ${EXPECT.themeVersion}`);
if (restore.theme.commit !== EXPECT.themeCommit)
  problems.push(`theme commit ${restore.theme.commit} != pinned ${EXPECT.themeCommit}`);
const lk = Object.keys(lock.packages || {}).find((k) => k.includes('doxygen-awesome'));
const lockCommit = lk ? (lock.packages[lk].resolved || '').split('#').pop() : null;
if (lockCommit !== EXPECT.themeCommit)
  problems.push(`package-lock theme commit ${lockCommit} != pinned ${EXPECT.themeCommit}`);

const byId = new Map(manifest.sources.map((s) => [s.id, s]));
for (const s of restore.sources) {
  const m = byId.get(s.id);
  if (!m) { problems.push(`restore has unknown source ${s.id}`); continue; }
  if (s.mode === 'pinned' && s.actualCommit !== m.commit) {
    problems.push(`${s.id} recorded checkout ${s.actualCommit} != manifest commit ${m.commit}`);
  } else if (s.mode !== 'pinned') {
    notes.push(`${s.id}: ${s.mode === 'local-override' ? 'NON-PRODUCTION ' : 'PRODUCTION '}${s.mode} (commit ${s.actualCommit})`);
  }
  // Verify the checkout itself, not merely the restore report. Local overrides
  // may intentionally contain uncommitted documentation for preview.
  if (s.mode === 'pinned' || s.mode === 'dispatch-sha') {
    const sourceRoot = path.resolve(PORTAL_ROOT, s.sourcePath);
    try {
      const actual = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      if (actual !== s.actualCommit) problems.push(`${s.id} actual checkout ${actual} != restore record ${s.actualCommit}`);
      execFileSync('git', ['-C', sourceRoot, 'diff', '--quiet'], { stdio: 'ignore' });
      execFileSync('git', ['-C', sourceRoot, 'diff', '--cached', '--quiet'], { stdio: 'ignore' });
    } catch (error) {
      if (error.status === 1) problems.push(`${s.id} restored source contains uncommitted changes`);
      else problems.push(`${s.id} restored source revision cannot be verified: ${error.message}`);
    }
  }
}

for (const n of notes) console.log(`verify-pins: NOTE ${n}`);
for (const p of problems) console.log(`verify-pins: FAIL ${p}`);
if (problems.length) { console.log('verify-pins: FAIL'); process.exit(1); }
console.log(`verify-pins: PASS (${restore.sources.length} sources, Doxygen ${restore.doxygen.version}, theme ${restore.theme.version}@${restore.theme.commit.slice(0, 8)})`);
