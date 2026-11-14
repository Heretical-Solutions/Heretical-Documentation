#!/usr/bin/env node
//
// eng/warn-gate.mjs — gate Doxygen diagnostics against a reviewed allow list.
//
// Reads the published-pass and fixture warn logs, strips machine-path prefixes,
// and fails on any error or on any warning not matched by a substring in
// eng/warning-allowlist.txt. Zero warnings is the expected current state.

import fs from 'node:fs';
import path from 'node:path';

const PORTAL_ROOT = path.resolve(import.meta.dirname, '..');
const ALLOW = path.join(PORTAL_ROOT, 'eng', 'warning-allowlist.txt');
const LOGS = [
  path.join(PORTAL_ROOT, 'artifacts', 'doxygen', 'main', 'warn.log'),
  path.join(PORTAL_ROOT, 'artifacts', 'fixture', 'warn.log'),
];

function normalize(line) {
  return line
    .split(path.join(PORTAL_ROOT, 'artifacts', 'intermediates') + path.sep).join('')
    .split(PORTAL_ROOT + path.sep).join('')
    .split(PORTAL_ROOT).join('<portal>');
}

const allow = fs.existsSync(ALLOW)
  ? fs.readFileSync(ALLOW, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  : [];

let warnings = 0;
let allowed = 0;
const errors = [];
const unexpected = [];

for (const log of LOGS) {
  if (!fs.existsSync(log)) {
    errors.push(`missing Doxygen diagnostic log: ${path.relative(PORTAL_ROOT, log)}`);
    continue;
  }
  for (const raw of fs.readFileSync(log, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const norm = normalize(line);
    if (/(^|\s)error:/.test(line)) {
      errors.push(norm);
    } else if (/(^|\s)warning:/.test(line)) {
      warnings++;
      if (allow.some((a) => norm.includes(a))) allowed++;
      else unexpected.push(norm);
    }
    // notices / other informational lines are ignored
  }
}

const fail = errors.length > 0 || unexpected.length > 0;
console.log(`warn-gate: ${warnings} warning(s) (${allowed} allowed), ${errors.length} error(s), ${unexpected.length} unexpected warning(s)`);
for (const e of errors) console.log(`warn-gate: ERROR: ${e}`);
for (const u of unexpected) console.log(`warn-gate: UNEXPECTED: ${u}`);
if (fail) {
  console.log('warn-gate: FAIL');
  process.exit(1);
}
console.log('warn-gate: PASS');
