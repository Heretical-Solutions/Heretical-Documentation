#!/usr/bin/env node
//
// Generate a Doxygen usergroup navigation layout from its XML page IDs.
// Canonical documents stay untouched; this is portal navigation metadata only.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const input = path.join(ROOT, 'artifacts', 'coverage.json');
const navigation = JSON.parse(fs.readFileSync(path.join(ROOT, 'eng', 'navigation.json'), 'utf8'));
const coverage = JSON.parse(fs.readFileSync(input, 'utf8'));
const coverageInput = JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts', 'coverage-input.json'), 'utf8'));
const pageByIntermediate = new Map(Object.entries(coverage.pages).map(([key, entry]) => [key.replace(/^artifacts\/intermediates\//, ''), entry]));
if (!Array.isArray(navigation.groups)) throw new Error('navigation.json must contain a groups array');
const escape = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const references = new Set();
const referencedSources = [];

function render(group) {
  if (!group.title || typeof group.title !== 'string') throw new Error('navigation group has no title');
  let url = '[none]';
  if (group.source) {
    if (references.has(group.source)) throw new Error(`navigation source has multiple parents: ${group.source}`);
    references.add(group.source);
    const source = group.source;
    let intermediate;
    if (source.startsWith('portal:')) intermediate = source.slice('portal:'.length);
    else if (source.startsWith('workspace:')) intermediate = `workspace/${source.slice('workspace:'.length)}`;
    else if (source.startsWith('blog:')) intermediate = `products/blog/${source.slice('blog:'.length)}`;
    const inputEntry = coverageInput.entries.find((candidate) => candidate.intermediatePath === intermediate);
    const entry = inputEntry && (pageByIntermediate.get(inputEntry.intermediatePath) ||
      coverage.pages[inputEntry.src] || coverage.pages[`workspace/${inputEntry.src}`] ||
      coverage.pages[`products/${inputEntry.sourceId}/${inputEntry.src}`]);
    if (!entry) throw new Error(`navigation source has no generated page: ${source} (${group.title})`);
    const id = entry.page.replace(/\.html$/, '');
    if (!/^md_[A-Za-z0-9_-]+$/.test(id)) throw new Error(`navigation page ID is not a related-page ID: ${source} (${id})`);
    url = `@ref ${id}`;
    referencedSources.push({ source, page: entry.page, title: group.title });
  }
  const children = group.children || [];
  if (!Array.isArray(children)) throw new Error(`navigation children invalid: ${group.title}`);
  return `<tab type="usergroup" title="${escape(group.title)}" url="${escape(url)}">\n${children.map(render).join('')}</tab>\n`;
}

const layout = `<?xml version="1.0" encoding="UTF-8"?>
<doxygenlayout version="2.0">
  <navindex>
    <tab type="mainpage" visible="yes" title="Home"/>
${navigation.groups.map(render).join('')}    <tab type="topics" visible="yes" title="Topics"/>
    <tab type="files" visible="no" title=""><tab type="filelist" visible="yes" title="" intro=""/></tab>
  </navindex>
</doxygenlayout>
`;
const defaultLayout = fs.readFileSync(path.join(ROOT, 'doxygen', 'DoxyLayout.default.xml'), 'utf8');
if (!defaultLayout.includes('<navindex>') || !defaultLayout.includes('</navindex>')) {
  throw new Error('complete pinned default Doxygen layout has no navindex');
}
const completeLayout = defaultLayout.replace(/<navindex>[\s\S]*?<\/navindex>/, layout.match(/<navindex>[\s\S]*?<\/navindex>/)[0]);
fs.writeFileSync(path.join(ROOT, 'artifacts', 'DoxyLayout.xml'), completeLayout);
fs.writeFileSync(path.join(ROOT, 'artifacts', 'navigation-map.json'), JSON.stringify({ schema: 1, pages: referencedSources }, null, 2) + '\n');
console.log(`navigation: ${navigation.groups.length} top-level topics, ${referencedSources.length} page links`);
