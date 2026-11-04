import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {markdown, loadConfig, build} from '../.claude/skills/shipfast/scripts/publish-policy.mjs';

const base = {appName: 'Any App', operator: 'Jane Developer', email: 'jane@example.com', effectiveDate: '2026-11-04',
  projectId: 'any-app-prod', siteId: 'any-app-legal', pages: {privacy: 'PRIVACY.en.md', support: 'SUPPORT.md'}};

async function withConfig(overrides, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'shipfast-policy-'));
  try {
    await writeFile(join(dir, 'PRIVACY.en.md'), '# Privacy\n\n## What we collect\n- **Email**, for your account\n- Crash logs <script>alert(1)</script>\n\nContact [us](mailto:jane@example.com).');
    await writeFile(join(dir, 'SUPPORT.md'), 'Email jane@example.com');
    await writeFile(join(dir, 'policy-site.json'), JSON.stringify({...base, ...overrides}));
    return await fn(join(dir, 'policy-site.json'), dir);
  } finally { await rm(dir, {recursive: true, force: true}); }
}

test('renders Markdown with HTML escaped', () => {
  const html = markdown('## Title\n- **bold** item\n<img src=x onerror=alert(1)>\n[link](https://example.com)');
  assert.match(html, /<h2>Title<\/h2>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /&lt;img src=x/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /<a href="https:\/\/example.com">link<\/a>/);
});

test('builds a site-scoped Firebase Hosting folder with one page per document', () => withConfig({}, async (path, dir) => {
  const urls = await build(await loadConfig(path));
  assert.deepEqual(urls, {privacy: 'https://any-app-legal.web.app/privacy/', support: 'https://any-app-legal.web.app/support/'});
  const firebase = JSON.parse(await readFile(join(dir, 'policy-site', 'firebase.json'), 'utf8'));
  assert.equal(firebase.hosting.site, 'any-app-legal');
  const privacy = await readFile(join(dir, 'policy-site', 'public', 'privacy', 'index.html'), 'utf8');
  assert.match(privacy, /Jane Developer/);
  assert.match(privacy, /Effective 2026-11-04/);
  assert.doesNotMatch(privacy, /<script>/);
}));

test('rejects noreply emails, bad site IDs and missing operator', async () => {
  for (const [override, pattern] of [[{email: '123+me@users.noreply.github.com'}, /noreply/], [{siteId: 'Bad_Site'}, /siteId/], [{operator: ''}, /operator/]]) {
    await withConfig(override, path => assert.rejects(loadConfig(path), pattern));
  }
});
