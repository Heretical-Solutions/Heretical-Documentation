#!/usr/bin/env node
//
// eng/coverage.mjs — derive the authoritative source-to-page map from the Doxygen
// XML of the published pass. Each Markdown page compound records the intermediate
// source path (<location file=...>) and its generated page id, so coverage is
// measured against what Doxygen actually emitted rather than a reimplemented
// filename rule. Output: artifacts/coverage.json.

import fs from 'node:fs';
import path from 'node:path';

const PORTAL_ROOT = path.resolve(import.meta.dirname, '..');
const XML_DIR = path.join(PORTAL_ROOT, 'artifacts', 'doxygen', 'main', 'xml');
const OUT = path.join(PORTAL_ROOT, 'artifacts', 'coverage.json');

if (!fs.existsSync(XML_DIR)) {
  console.error(`coverage: Doxygen XML not found at ${path.relative(PORTAL_ROOT, XML_DIR)}; run eng/build.sh`);
  process.exit(1);
}

const pages = {};
let pageCount = 0;
for (const name of fs.readdirSync(XML_DIR)) {
  if (!name.endsWith('.xml') || name === 'index.xml') continue;
  const xml = fs.readFileSync(path.join(XML_DIR, name), 'utf8');
  const cd = xml.match(/<compounddef\b([^>]*)>/);
  if (!cd) continue;
  const attrs = cd[1];
  const kind = (attrs.match(/\bkind="([^"]*)"/) || [])[1];
  if (kind !== 'page') continue;
  const id = (attrs.match(/\bid="([^"]*)"/) || [])[1];
  if (!id) continue;
  const loc = xml.match(/<location file="([^"]*)"/);
  const title = (xml.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
  pageCount++;
  // Doxygen emits the main page (USE_MDFILE_AS_MAINPAGE) as index.html even
  // though its compound id is "indexpage"; every other page is <id>.html.
  const pageFile = id === 'indexpage' ? 'index.html' : `${id}.html`;
  if (loc) {
    pages[loc[1]] = { page: pageFile, title: (title || '').trim() };
  }
}

fs.writeFileSync(OUT, JSON.stringify({ schema: 1, generatedAt: new Date().toISOString(), pageCount, pages }, null, 2) + '\n');
console.log(`coverage: mapped ${Object.keys(pages).length} source documents to ${pageCount} generated pages`);
