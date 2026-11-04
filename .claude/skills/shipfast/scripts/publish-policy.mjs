import {readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {dirname, resolve, join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Builds the public legal pages (privacy policy, support, account deletion) as a
// static site and deploys it to a dedicated Firebase Hosting site, then checks
// the live URLs. Never touches the app's own Firebase Hosting sites.

const run = promisify(execFile);
const PAGES = {privacy: 'Privacy Policy', support: 'Support', deleteAccount: 'Delete your account'};
const PATHS = {privacy: 'privacy', support: 'support', deleteAccount: 'delete-account'};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Small Markdown subset (headings, lists, paragraphs, bold, italic, code, links); input is escaped first.
export function markdown(md) {
  const inline = s => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(((?:https?:|mailto:)[^)\s]+)\)/g, '<a href="$2">$1</a>');
  const out = [];
  let list = null, para = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`), para = [];
    if (list) out.push(`<${list.tag}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`), list = null;
  };
  for (const raw of String(md).split(/\r?\n/)) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flush(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flush(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if ((m = line.match(/^\s*(?:[-*]|(\d+)\.)\s+(.*)$/))) {
      if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`), para = [];
      const tag = m[1] ? 'ol' : 'ul';
      if (!list || list.tag !== tag) { if (list) flush(); list = {tag, items: []}; }
      list.items.push(m[2]);
      continue;
    }
    if (list) flush();
    para.push(line.trim());
  }
  flush();
  return out.join('\n');
}

function page({title, body, config, nav}) {
  return `<!doctype html>
<html lang="${esc(config.locale ?? 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${esc(config.appName)}</title>
<meta name="robots" content="index,follow">
<style>
:root{--paper:#f5f5f5;--ink:#2d3142;--muted:#4f5d75;--rule:rgba(45,49,66,.12);--accent:#bf4520}
@media (prefers-color-scheme:dark){:root{--paper:#2d3142;--ink:#f5f5f5;--muted:#bfc0c0;--rule:rgba(245,245,245,.12);--accent:#f08a59}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:720px;margin:0 auto;padding:48px 20px 64px}header{border-bottom:1px solid var(--rule);margin-bottom:32px;padding-bottom:16px}
.app{font:500 12px/1.4 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
h1{font-size:32px;line-height:1.2;margin:8px 0}h2{font-size:20px;margin-top:32px}a{color:var(--accent)}
nav{display:flex;gap:16px;flex-wrap:wrap;font-size:14px}footer{margin-top:48px;padding-top:16px;border-top:1px solid var(--rule);color:var(--muted);font-size:14px}
</style>
</head>
<body><main>
<header><div class="app">${esc(config.appName)}</div><h1>${esc(title)}</h1><nav>${nav}</nav></header>
${body}
<footer>${esc(config.operator)} · <a href="mailto:${esc(config.email)}">${esc(config.email)}</a> · Effective ${esc(config.effectiveDate)}</footer>
</main></body>
</html>
`;
}

export async function loadConfig(path) {
  const config = JSON.parse(await readFile(path, 'utf8'));
  const base = dirname(path);
  for (const key of ['appName', 'operator', 'email', 'effectiveDate', 'projectId', 'siteId']) {
    if (typeof config[key] !== 'string' || !config[key].trim()) throw Error(`${key} is required.`);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(config.email) || /noreply/i.test(config.email)) throw Error('email must be a real, reachable address (no noreply addresses).');
  if (!/^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]$/.test(config.siteId)) throw Error('siteId must be 6–30 lowercase letters, digits or hyphens (it becomes <siteId>.web.app).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.effectiveDate)) throw Error('effectiveDate must be YYYY-MM-DD.');
  if (!config.pages?.privacy) throw Error('pages.privacy (a Markdown file) is required.');
  for (const key of Object.keys(config.pages)) if (!PAGES[key]) throw Error(`Unknown page "${key}". Use ${Object.keys(PAGES).join(', ')}.`);
  return {...config, base, outDir: resolve(base, config.outDir ?? 'policy-site')};
}

export async function build(config) {
  const keys = Object.keys(PAGES).filter(k => config.pages[k]);
  const nav = keys.map(k => `<a href="/${PATHS[k]}/">${esc(PAGES[k])}</a>`).join('');
  await rm(join(config.outDir, 'public'), {recursive:true, force:true});
  const urls = {};
  for (const key of keys) {
    const md = await readFile(resolve(config.base, config.pages[key]), 'utf8');
    const html = page({title: PAGES[key], body: markdown(md), config, nav});
    await mkdir(join(config.outDir, 'public', PATHS[key]), {recursive:true});
    await writeFile(join(config.outDir, 'public', PATHS[key], 'index.html'), html);
    urls[key] = `https://${config.siteId}.web.app/${PATHS[key]}/`;
  }
  const index = page({title: config.appName, body: `<ul>${keys.map(k => `<li><a href="/${PATHS[k]}/">${esc(PAGES[k])}</a></li>`).join('')}</ul>`, config, nav});
  await writeFile(join(config.outDir, 'public', 'index.html'), index);
  // A site-scoped firebase.json in its own folder: deploys this site only, never the app's hosting.
  await writeFile(join(config.outDir, 'firebase.json'), JSON.stringify({hosting: {site: config.siteId, public: 'public', cleanUrls: true, trailingSlash: true,
    headers: [{source: '**', headers: [{key: 'X-Content-Type-Options', value: 'nosniff'}, {key: 'Cache-Control', value: 'max-age=300'}]}]}}, null, 2) + '\n');
  await writeFile(join(config.outDir, '.firebaserc'), JSON.stringify({projects: {default: config.projectId}}, null, 2) + '\n');
  return urls;
}

// Only the signed-in email; tokens in the CLI output are never printed or stored.
export async function firebaseIdentity() {
  try {
    const {stdout} = await run('firebase', ['login:list', '--json']);
    const email = JSON.parse(stdout)?.result?.[0]?.user?.email;
    return email ? {email} : null;
  } catch { return null; }
}

async function firebase(args, cwd) {
  try { return (await run('firebase', [...args, '--non-interactive'], {cwd, maxBuffer: 10_000_000})).stdout; }
  catch (error) { throw Error(`firebase ${args.join(' ')} failed:\n${(error.stderr || error.stdout || error.message).trim().split('\n').slice(-6).join('\n')}`); }
}

export async function deploy(config, urls) {
  const sites = JSON.parse(await firebase(['hosting:sites:list', '--project', config.projectId, '--json'], config.outDir));
  const exists = (sites.result?.sites ?? sites.result ?? []).some(s => String(s.name ?? '').endsWith(`/sites/${config.siteId}`));
  if (!exists) await firebase(['hosting:sites:create', config.siteId, '--project', config.projectId], config.outDir);
  await firebase(['deploy', '--only', 'hosting', '--project', config.projectId, '--message', `shipfast: ${config.appName} legal pages ${config.effectiveDate}`], config.outDir);
  const checks = [];
  for (const [key, url] of Object.entries(urls)) {
    const response = await fetch(url, {redirect: 'follow', headers: {'Cache-Control': 'no-cache'}});
    const text = await response.text();
    const ok = response.ok && text.includes(esc(config.appName)) && text.includes(config.effectiveDate) && text.includes(esc(config.email));
    checks.push({page: key, url, status: response.status, ok});
  }
  return {created: !exists, checks};
}

async function main(args) {
  if (args.includes('--whoami')) {
    const id = await firebaseIdentity();
    if (!id) throw Error('Not signed in to Firebase. Run: firebase login');
    console.log(id.email);
    return;
  }
  const at = args.indexOf('--config');
  if (at < 0 || !args[at + 1]) throw Error('Usage: publish-policy.mjs --whoami | --config <policy-site.json> [--deploy]');
  const config = await loadConfig(resolve(args[at + 1]));
  const urls = await build(config);
  console.log(`Built ${Object.keys(urls).length} page(s) in ${join(config.outDir, 'public')}`);
  if (!args.includes('--deploy')) {
    for (const url of Object.values(urls)) console.log(`will publish: ${url}`);
    return;
  }
  if (!await firebaseIdentity()) throw Error('Not signed in to Firebase. Run: firebase login');
  const result = await deploy(config, urls);
  for (const c of result.checks) console.log(`${c.ok ? 'live' : 'FAILED'} ${c.status} ${c.url}`);
  await writeFile(join(config.outDir, 'deploy-result.json'), JSON.stringify({deployedAt: new Date().toISOString(), projectId: config.projectId, siteId: config.siteId, ...result}, null, 2) + '\n');
  if (!result.checks.every(c => c.ok)) throw Error('Deployed, but a live page did not show the expected content. Check the URLs above.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
