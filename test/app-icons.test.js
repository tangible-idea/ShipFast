import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {loadConcept, storeIcons, sheet} from '../.claude/skills/shipfast/scripts/render-app-icons.mjs';

const opaque = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#2a6fbb"/><circle cx="512" cy="512" r="200" fill="#fff"/></svg>';

async function withSvg(source, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'shipfast-icon-'));
  try { await writeFile(join(dir, 'icon.svg'), source); return await fn(join(dir, 'icon.svg')); }
  finally { await rm(dir, {recursive:true, force:true}); }
}

test('renders agent-authored SVG to iOS 1024px (no alpha) and Play 512px icons', () => withSvg(opaque, async path => {
  const concept = await loadConcept(path);
  const {ios, play} = await storeIcons(concept.png);
  const [a, b] = await Promise.all([sharp(ios).metadata(), sharp(play).metadata()]);
  assert.deepEqual([a.width, a.height, a.hasAlpha], [1024, 1024, false]);
  assert.deepEqual([b.width, b.height], [512, 512]);
  assert.ok((await sharp(await sheet([concept, concept])).metadata()).width > 0);
}));

test('rejects SVGs with transparency or external references', async () => {
  await withSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><circle cx="512" cy="512" r="300"/></svg>', path => assert.rejects(loadConcept(path), /transparent/));
  await withSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><image href="https://example.com/a.png" width="1024" height="1024"/></svg>', path => assert.rejects(loadConcept(path), /external/));
});
