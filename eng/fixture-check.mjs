#!/usr/bin/env node
//
// eng/fixture-check.mjs — prove the non-published C# fixture extracted a
// documented type and its members from source alone, and stayed out of the
// published payload.
//
// The fixture source derives from a Unity type and imports UnityEngine with no
// SDK, assembly, .asmdef, generated .csproj, or stub present. Doxygen is a source
// scanner, so it still documents the type/members from the XML doc comments. This
// check asserts extraction happened and that the fixture never reached artifacts/site.
// It does NOT assert compilation or Unity compatibility.

import fs from 'node:fs';
import path from 'node:path';

const PORTAL_ROOT = path.resolve(import.meta.dirname, '..');
const FIX_XML = path.join(PORTAL_ROOT, 'artifacts', 'fixture', 'xml');
const FIX_HTML = path.join(PORTAL_ROOT, 'artifacts', 'fixture', 'html');
const FIX_SRC = path.join(PORTAL_ROOT, 'tests', 'fixture', 'SampleWidget.cs');
const SITE = path.join(PORTAL_ROOT, 'artifacts', 'site');

const problems = [];

if (!fs.existsSync(FIX_XML)) problems.push('fixture XML missing; build did not run the fixture pass');
if (!fs.existsSync(FIX_HTML)) problems.push('fixture HTML missing; build did not run the fixture pass');

const xml = fs.existsSync(FIX_XML)
  ? fs.readdirSync(FIX_XML).filter((f) => f.endsWith('.xml')).map((f) => fs.readFileSync(path.join(FIX_XML, f), 'utf8')).join('\n')
  : '';

function expect(cond, msg) { if (!cond) problems.push(msg); }

expect(xml.includes('<compoundname>Heretical::Documentation::Fixture::SampleWidget</compoundname>'), 'documented type SampleWidget not extracted');
expect(/<memberdef[^>]*kind="function"[\s\S]*?<name>Activate<\/name>/.test(xml), 'documented member Activate not extracted');
expect(/<memberdef[^>]*kind="variable"[\s\S]*?<name>charge<\/name>/.test(xml), 'documented member charge not extracted');
expect(xml.includes('Activates the widget'), 'Activate doc-comment brief missing');
expect(xml.includes('accumulated charge level'), 'charge doc-comment brief missing');
expect(xml.includes('documented sample widget'), 'SampleWidget doc-comment brief missing');
// The unresolved Unity base/import proves no stub/SDK was required for extraction.
const src = fs.existsSync(FIX_SRC) ? fs.readFileSync(FIX_SRC, 'utf8') : '';
expect(src.includes('using UnityEngine;') && src.includes(': MonoBehaviour'), 'fixture no longer references Unity types');
expect(/<compoundname>UnityEngine<\/compoundname>/.test(xml), 'UnityEngine import not parsed (fixture precondition changed)');

// Class page exists.
if (fs.existsSync(FIX_HTML)) {
  const classPage = fs.readdirSync(FIX_HTML).some((f) => /^class_.*sample_widget\.html$/.test(f));
  expect(classPage, 'SampleWidget class page missing from fixture output');
}

// No leakage into the published payload.
function walk(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}
if (fs.existsSync(SITE)) {
  const leak = walk(SITE).filter((r) => /fixture|samplewidget|widget/i.test(r) || /^class[a-zA-Z0-9_]*\.html$/i.test(r));
  expect(leak.length === 0, `fixture leaked into payload: ${leak.slice(0, 5).join(', ')}`);
} else {
  problems.push('payload missing; cannot confirm fixture exclusion');
}

if (problems.length) {
  for (const p of problems) console.log(`fixture-check: FAIL ${p}`);
  console.log('fixture-check: FAIL');
  process.exit(1);
}
console.log('fixture-check: PASS (documented type + members extracted from source alone; UnityEngine unresolved without stubs; fixture absent from payload)');
