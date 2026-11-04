import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, basename, dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

// Renders agent-authored SVG icon concepts. No network, no generative model:
// the agent writes the SVG, this script only rasterizes and checks it.

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

export async function loadConcept(path) {
  const source = await readFile(path, 'utf8');
  if (!/<svg[\s>]/i.test(source)) throw Error(`${basename(path)} is not an SVG file.`);
  // Keep rendering self-contained and deterministic.
  if (/(?:href|src)\s*=\s*["'](?!#|data:image\/)/i.test(source) || /@import|url\(\s*["']?(?!#)/i.test(source)) throw Error(`${basename(path)} references external files or URLs. Inline everything.`);
  const png = await sharp(Buffer.from(source), {density:300}).resize(1024, 1024, {fit:'fill'}).png().toBuffer();
  const meta = await sharp(png).metadata();
  const stats = await sharp(png).stats();
  // Store masks need a full-bleed opaque square; iOS rejects alpha.
  if (meta.hasAlpha && stats.channels[3].min < 255) throw Error(`${basename(path)} has transparent pixels. Use a full-bleed opaque background.`);
  return {name:basename(path), source, png, sha256:createHash('sha256').update(source).digest('hex')};
}

export async function storeIcons(png) {
  const ios = await sharp(png).resize(1024, 1024).flatten({background:'#ffffff'}).removeAlpha().png().toBuffer();
  const play = await sharp(png).resize(512, 512).flatten({background:'#ffffff'}).png({compressionLevel:9, effort:10}).toBuffer();
  if (play.length > 1_048_576) throw Error('Google Play icon exceeds 1 MiB. Simplify the SVG.');
  return {ios, play};
}

// One row per concept: full square, iOS-style rounded mask, Android circle mask, and small sizes for legibility.
export async function sheet(concepts) {
  const row = 300, pad = 40, W = 1380, H = pad + concepts.length*(row+70);
  const overlays = [];
  let labels = '';
  for (const [i, concept] of concepts.entries()) {
    const y = pad + i*(row+70);
    labels += `<text x="${pad}" y="${y+row+42}" font-size="26" font-weight="700" fill="#191f28" font-family="Helvetica,Arial,sans-serif">${i+1}. ${esc(concept.name)}</text>`;
    const masks = [
      {size:row, mask:null},
      {size:row, mask:`<rect width="${row}" height="${row}" rx="${row*0.225}" fill="#fff"/>`},
      {size:row, mask:`<circle cx="${row/2}" cy="${row/2}" r="${row/2}" fill="#fff"/>`},
      {size:120, mask:`<rect width="120" height="120" rx="27" fill="#fff"/>`},
      {size:60, mask:`<rect width="60" height="60" rx="13.5" fill="#fff"/>`}
    ];
    let x = pad;
    for (const {size, mask} of masks) {
      let image = await sharp(concept.png).resize(size, size).png().toBuffer();
      if (mask) image = await sharp(image).composite([{input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${mask}</svg>`), blend:'dest-in'}]).png().toBuffer();
      overlays.push({input:image, left:x, top:y + (row-size)/2 | 0});
      x += size + 40;
    }
  }
  const base = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#f2f4f6"/>${labels}</svg>`);
  return sharp(base).composite(overlays).flatten({background:'#f2f4f6'}).png().toBuffer();
}

async function main(args) {
  const out = resolve(args[args.indexOf('--out')+1] ?? '');
  if (!args.includes('--out') || !out) throw Error('Usage:\n  render-app-icons.mjs --sheet <a.svg> [b.svg ...] --out <sheet.png>\n  render-app-icons.mjs --final <chosen.svg> --out <dir>');
  if (args.includes('--sheet')) {
    const files = args.slice(args.indexOf('--sheet')+1).filter((x, i, all) => !x.startsWith('--') && all.slice(0, i).every(y => !y.startsWith('--')));
    if (files.length < 1 || files.length > 6) throw Error('Pass 1–6 SVG concepts to --sheet.');
    const concepts = [];
    for (const file of files) concepts.push(await loadConcept(resolve(file)));
    await mkdir(dirname(out), {recursive:true});
    await writeFile(out, await sheet(concepts));
    console.log(`Comparison sheet: ${out}`);
  } else if (args.includes('--final')) {
    const concept = await loadConcept(resolve(args[args.indexOf('--final')+1]));
    const {ios, play} = await storeIcons(concept.png);
    await mkdir(out, {recursive:true});
    await writeFile(resolve(out, 'ios-app-icon-1024.png'), ios);
    await writeFile(resolve(out, 'google-play-icon-512.png'), play);
    const manifest = {schemaVersion:1, createdAt:new Date().toISOString(), source:concept.name, sourceSha256:concept.sha256, assets:[
      {path:'ios-app-icon-1024.png', size:[1024,1024], alpha:false},
      {path:'google-play-icon-512.png', size:[512,512], bytes:play.length}
    ]};
    await writeFile(resolve(out, 'icons-manifest.json'), JSON.stringify(manifest, null, 2)+'\n');
    for (const asset of manifest.assets) console.log(`${asset.path}: ${asset.size.join('×')}`);
  } else throw Error('Choose --sheet or --final.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
