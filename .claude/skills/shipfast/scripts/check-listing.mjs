import {readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {resolve, join, relative, dirname} from 'node:path';
import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

// Pre-flight for the Google Play main store listing: every required field has
// text or a file that meets the spec, before anything is typed or uploaded.
// Writes listing-upload.json mapping each Play Console field to its value/file.

const LIMITS = {appName: 30, shortDescription: 80, fullDescription: 4000};
const HEADINGS = {'app name': 'appName', 'short description': 'shortDescription', 'full description': 'fullDescription'};
const chars = s => [...s].length;

// listing.<locale>.md uses "## App name", "## Short description", "## Full description".
export function parseListing(md) {
  const out = {};
  let key = null, buf = [];
  const flush = () => { if (key) out[key] = buf.join('\n').trim(); };
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) { flush(); key = HEADINGS[m[1].toLowerCase()] ?? null; buf = []; continue; }
    if (key) buf.push(line);
  }
  flush();
  return out;
}

async function image(path) {
  const meta = await sharp(path).metadata();
  return {path, width: meta.width, height: meta.height, format: meta.format, bytes: (await stat(path)).size};
}

export async function checkPlayListing({listing, icon, featureGraphic, screenshotsDir}) {
  const problems = [], fields = {};
  const text = parseListing(await readFile(listing, 'utf8'));
  for (const [key, limit] of Object.entries(LIMITS)) {
    const value = text[key] ?? '';
    if (!value) problems.push(`${key}: missing (add a "## ${Object.keys(HEADINGS).find(h => HEADINGS[h] === key).replace(/^./, c => c.toUpperCase())}" section).`);
    else if (chars(value) > limit) problems.push(`${key}: ${chars(value)} characters, limit ${limit}.`);
    fields[key] = {value, characters: chars(value), limit};
  }
  const okFormat = f => f === 'png' || f === 'jpeg';
  try {
    const i = await image(icon);
    if (i.width !== 512 || i.height !== 512 || !okFormat(i.format) || i.bytes > 1024 * 1024) problems.push(`appIcon: ${i.width}×${i.height} ${i.format} ${i.bytes} B; needs 512×512 PNG/JPEG ≤ 1 MB.`);
    fields.appIcon = i;
  } catch { problems.push(`appIcon: file not found or unreadable (${icon}).`); }
  try {
    const f = await image(featureGraphic);
    if (f.width !== 1024 || f.height !== 500 || !okFormat(f.format) || f.bytes > 15 * 1024 * 1024) problems.push(`featureGraphic: ${f.width}×${f.height} ${f.format}; needs 1024×500 PNG/JPEG ≤ 15 MB.`);
    fields.featureGraphic = f;
  } catch { problems.push(`featureGraphic: file not found or unreadable (${featureGraphic}).`); }
  let shots = [];
  try {
    const names = (await readdir(screenshotsDir)).filter(n => /\.(png|jpe?g)$/i.test(n)).sort();
    shots = await Promise.all(names.map(n => image(join(screenshotsDir, n))));
  } catch { problems.push(`phoneScreenshots: folder not found (${screenshotsDir}).`); }
  if (shots.length < 2 || shots.length > 8) problems.push(`phoneScreenshots: ${shots.length} found; Play needs 2–8.`);
  for (const s of shots) {
    const long = Math.max(s.width, s.height), short = Math.min(s.width, s.height);
    if (short < 320 || long > 3840 || long > 2 * short || s.bytes > 8 * 1024 * 1024 || !okFormat(s.format)) {
      problems.push(`phoneScreenshots: ${s.path} is ${s.width}×${s.height}; sides 320–3840 px, long side at most 2× the short side, PNG/JPEG ≤ 8 MB.`);
    }
  }
  fields.phoneScreenshots = shots;
  return {ok: problems.length === 0, problems, fields};
}

async function main(args) {
  const get = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
  // Defaults follow the .shipfast/ layout: listing.<locale>.md, icons/final/, and play-assets.json's outputDir.
  const root = resolve(get('--root') ?? '.shipfast'), locale = get('--locale') ?? 'en-US';
  let assets = join(root, 'out');
  try {
    const config = JSON.parse(await readFile(join(root, 'play-assets.json'), 'utf8'));
    if (config.outputDir) assets = resolve(root, config.outputDir);
  } catch {}
  const input = {
    listing: resolve(get('--listing') ?? join(root, `listing.${locale}.md`)),
    icon: resolve(get('--icon') ?? join(root, 'icons/final/google-play-icon-512.png')),
    featureGraphic: resolve(get('--feature') ?? join(assets, 'featureGraphic.png')),
    screenshotsDir: resolve(get('--screenshots') ?? join(assets, 'phoneScreenshots')),
  };
  const result = await checkPlayListing(input);
  const rel = p => relative(process.cwd(), p);
  console.log(`App name            ${result.fields.appName.characters}/30`);
  console.log(`Short description   ${result.fields.shortDescription.characters}/80`);
  console.log(`Full description    ${result.fields.fullDescription.characters}/4000`);
  if (result.fields.appIcon) console.log(`App icon            ${rel(result.fields.appIcon.path)} ${result.fields.appIcon.width}×${result.fields.appIcon.height}`);
  if (result.fields.featureGraphic) console.log(`Feature graphic     ${rel(result.fields.featureGraphic.path)} ${result.fields.featureGraphic.width}×${result.fields.featureGraphic.height}`);
  console.log(`Phone screenshots   ${result.fields.phoneScreenshots.length} file(s)`);
  if (!result.ok) { for (const p of result.problems) console.error(`✗ ${p}`); process.exitCode = 1; return; }
  // Field-by-field plan the agent follows in Play Console > Grow users > Store presence > Main store listing.
  const plan = {
    page: 'Main store listing',
    text: {'App name': result.fields.appName.value, 'Short description': result.fields.shortDescription.value, 'Full description': result.fields.fullDescription.value},
    files: {'App icon': [result.fields.appIcon.path], 'Feature graphic': [result.fields.featureGraphic.path], 'Phone screenshots': result.fields.phoneScreenshots.map(s => s.path)},
  };
  const target = join(dirname(input.listing), 'listing-upload.json');
  await writeFile(target, JSON.stringify(plan, null, 2) + '\n');
  console.log(`✓ All required fields ready. Upload plan: ${rel(target)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
