import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, resolve, relative, basename} from 'node:path';
import {createHash} from 'node:crypto';
import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

// Explicitly selected and reviewed real iPhone captures only. Renders App Store
// screenshots plus Product Page Header / Search Results creative. Never signs in
// or uploads anything to App Store Connect.

// Apple accepts these portrait iPhone screenshot sizes (6.9" first, then 6.5").
export const IPHONE_SIZES = [[1320,2868],[1290,2796],[1260,2736],[1284,2778],[1242,2688]];
// App Store Connect > Creative assets specifications. Images must not contain alpha.
export const CREATIVE = {
  header: {size:[3840,1646], ratio:'21:9'},
  search: {min:[1920,1280], max:[3840,2560], ratio:'3:2'},
  universal: {size:[5244,2950], ratio:'16:9'}
};
// The universal 16:9 image is cropped to 21:9 (full width) for the header and to
// 3:2 (full height) for search; keep key content inside both crops.
export function universalSafe([w,h]=CREATIVE.universal.size) {
  const headerH = Math.floor(w*9/21), searchW = Math.floor(h*3/2);
  return {x:Math.ceil((w-searchW)/2), y:Math.ceil((h-headerH)/2), w:searchW, h:headerH, headerH, searchW};
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const svg = (w, h, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><style>text{font-family:'Helvetica Neue','Noto Sans','Apple SD Gothic Neo','Hiragino Sans','Noto Sans CJK KR','Noto Sans CJK JP',sans-serif}</style>${body}</svg>`);
const text = (x, y, size, value, fill, weight=600, anchor='start') => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(value)}</text>`;
const rounded = (w, h, r) => svg(w, h, `<rect width="${w}" height="${h}" rx="${r}" fill="white"/>`);
const hex = c => [1,3,5].map(i => parseInt(c.slice(i,i+2),16));
const mix = (a, b, t) => '#'+hex(a).map((v,i)=>Math.round(v+(hex(b)[i]-v)*t).toString(16).padStart(2,'0')).join('');
// Conservative width estimate so long captions fail instead of silently overflowing.
const textWidth = (value, size) => [...String(value)].reduce((sum, ch) => sum + size*(/[ᄀ-￿]/.test(ch) ? 0.98 : /[A-Z0-9]/.test(ch) ? 0.68 : ch === ' ' ? 0.3 : 0.58), 0);
function fits(value, size, max, label) {
  if (textWidth(value, size) > max) throw Error(`${label} is too long for the layout: "${value}". Shorten it or add a line break.`);
}

// sharp cannot composite an overlay that leaves the canvas, so crop to the visible part.
async function place(input, left, top, W, H) {
  const meta = await sharp(input).metadata();
  const x0 = Math.max(0, -left), y0 = Math.max(0, -top);
  const w = Math.min(meta.width, W-left) - x0, h = Math.min(meta.height, H-top) - y0;
  if (w < 1 || h < 1) return null;
  const visible = await sharp(input).extract({left:x0, top:y0, width:w, height:h}).png().toBuffer();
  return {input:visible, left:left+x0, top:top+y0};
}

async function phone(content, aspect, height) {
  const bezel = Math.round(height*0.016), screenH = height-2*bezel, screenW = Math.round(screenH*aspect), width = screenW+2*bezel;
  const outerR = Math.round(width*0.13), innerR = Math.max(outerR-bezel, 1);
  const screen = await sharp(content).resize(screenW, screenH, {fit:'contain', background:'#ffffff'}).png().toBuffer();
  const clipped = await sharp(screen).composite([{input:rounded(screenW, screenH, innerR), blend:'dest-in'}]).png().toBuffer();
  const body = svg(width, height, `<rect width="${width}" height="${height}" rx="${outerR}" fill="#0d0f14"/><rect x="1.5" y="1.5" width="${width-3}" height="${height-3}" rx="${outerR-1}" fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-width="3"/>`);
  const buffer = await sharp(body).composite([{input:clipped, left:bezel, top:bezel}]).png().toBuffer();
  return {buffer, width, height};
}

// Center-weighted hero: caption on top, real captures in phone frames rising from the bottom.
async function hero(W, H, safe, {color, eyebrow, headline, subtitle, screens}) {
  const v = safe.h/1000, cx = Math.round(safe.x+safe.w/2), lines = headline.split('\n');
  const maxText = safe.w*0.86;
  fits(eyebrow, 30*v, maxText, 'eyebrow');
  lines.forEach(line => fits(line, 80*v, maxText, 'creative.headline'));
  if (subtitle) fits(subtitle, 38*v, maxText, 'creative.subtitle');
  const dark = mix(color, '#05070d', 0.72), deep = mix(color, '#05070d', 0.35);
  const headY = safe.y+195*v, subY = headY+(lines.length-1)*92*v+70*v;
  const phoneTop = Math.round((subtitle ? subY : headY+(lines.length-1)*92*v)+85*v);
  let body = `<defs><linearGradient id="bg" x2="0" y2="1"><stop stop-color="${dark}"/><stop offset="1" stop-color="${deep}"/></linearGradient><radialGradient id="glow"><stop stop-color="${color}" stop-opacity=".55"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient><filter id="blur"><feGaussianBlur stdDeviation="${Math.round(28*v)}"/></filter></defs>`;
  body += `<rect width="${W}" height="${H}" fill="url(#bg)"/><ellipse cx="${cx}" cy="${Math.round(phoneTop+420*v)}" rx="${Math.round(Math.max(W*0.42, 600*v))}" ry="${Math.round(520*v)}" fill="url(#glow)"/>`;
  body += text(cx, Math.round(safe.y+100*v), Math.round(30*v), eyebrow, mix(color, '#ffffff', 0.65), 700, 'middle');
  body += lines.map((line,i) => text(cx, Math.round(headY+i*92*v), Math.round(80*v), line, '#ffffff', 700, 'middle')).join('');
  if (subtitle) body += text(cx, Math.round(subY), Math.round(38*v), subtitle, mix(color, '#ffffff', 0.78), 400, 'middle');

  const ph = Math.round(900*v), n = screens.length;
  const frames = [];
  for (const [i, screen] of screens.entries()) {
    const side = n === 3 && i !== 1, scale = side ? 0.86 : 1;
    frames.push({...await phone(screen.content, screen.aspect, Math.round(ph*scale)), side, i});
  }
  const gap = Math.round(60*v), pos = [];
  if (n === 1) pos.push(cx-frames[0].width/2);
  if (n === 2) pos.push(cx-gap/2-frames[0].width, cx+gap/2);
  if (n === 3) pos.push(cx-frames[1].width/2-gap-frames[0].width, cx-frames[1].width/2, cx+frames[1].width/2+gap);
  const order = n === 3 ? [0,2,1] : frames.map((_,i)=>i);
  const overlays = [];
  for (const i of order) {
    const f = frames[i], left = Math.round(pos[i]), top = f.side ? Math.round(phoneTop+ph*0.09) : phoneTop;
    body += `<rect x="${left}" y="${top+Math.round(30*v)}" width="${f.width}" height="${f.height}" rx="${Math.round(f.width*0.13)}" fill="#000" opacity=".45" filter="url(#blur)"/>`;
    const overlay = await place(f.buffer, left, top, W, H);
    if (overlay) overlays.push(overlay);
  }
  return sharp(svg(W, H, body)).composite(overlays).flatten({background:dark}).removeAlpha().png().toBuffer();
}

async function iphoneShot(W, H, screen, {color, eyebrow}) {
  const u = W/1080, lines = screen.title.split('\n');
  fits(eyebrow, 27*u, W-140*u, 'eyebrow');
  lines.forEach(line => fits(line, 60*u, W-140*u, `title of ${screen.output}`));
  if (screen.subtitle) fits(screen.subtitle, 32*u, W-140*u, `subtitle of ${screen.output}`);
  const top = Math.round((260+lines.length*76+(screen.subtitle?60:0))*u), x = Math.round(70*u), fw = W-2*x, fh = H-top-x, pad = Math.round(18*u);
  const bg = svg(W, H, `<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${mix(color,'#ffffff',0.9)}"/><stop offset="1" stop-color="${mix(color,'#ffffff',0.97)}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#bg)"/><circle cx="${W-40*u}" cy="${90*u}" r="${230*u}" fill="${color}" opacity=".07"/>${text(x, Math.round(110*u), Math.round(27*u), eyebrow, color, 700)}${lines.map((line,i)=>text(x, Math.round((200+i*76)*u), Math.round(60*u), line, '#191f28')).join('')}${screen.subtitle ? text(x, Math.round((200+lines.length*76+16)*u), Math.round(32*u), screen.subtitle, '#6b7684', 400) : ''}<rect x="${x-8*u}" y="${top+8*u}" width="${fw+16*u}" height="${fh}" rx="${40*u}" fill="${color}" opacity=".08"/><rect x="${x}" y="${top}" width="${fw}" height="${fh}" rx="${38*u}" fill="white" stroke="${mix(color,'#ffffff',0.82)}" stroke-width="${2*u}"/>`);
  const iw = fw-2*pad, ih = fh-2*pad;
  const image = await sharp(screen.content).resize(iw, ih, {fit:'contain', background:'#ffffff'}).png().toBuffer();
  const clipped = await sharp(image).composite([{input:rounded(iw, ih, Math.round(26*u)), blend:'dest-in'}]).toBuffer();
  return sharp(bg).composite([{input:clipped, left:x+pad, top:top+pad}]).flatten({background:'#fff'}).removeAlpha().png().toBuffer();
}

async function guides(buffer, W, H) {
  const s = universalSafe([W,H]), k = 1600/W;
  const lines = svg(W, H, `<rect x="0" y="${s.y}" width="${W}" height="${s.headerH}" fill="none" stroke="#ff3b30" stroke-width="12" stroke-dasharray="60 30"/><rect x="${s.x}" y="0" width="${s.searchW}" height="${H}" fill="none" stroke="#34c759" stroke-width="12" stroke-dasharray="60 30"/>${text(30, s.y+90, 70, 'Header 21:9', '#ff3b30', 700)}${text(s.x+30, H-40, 70, 'Search 3:2', '#34c759', 700)}`);
  const marked = await sharp(buffer).composite([{input:lines}]).png().toBuffer();
  return sharp(marked).resize(Math.round(W*k), Math.round(H*k)).png().toBuffer();
}

async function verify(path, [w,h]) {
  const meta = await sharp(path).metadata();
  if (meta.width !== w || meta.height !== h || meta.hasAlpha) throw Error(`${path} failed verification: ${meta.width}×${meta.height}, alpha=${meta.hasAlpha}.`);
}

export async function render(configPath, {withGuides=false}={}) {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const base = dirname(configPath), out = resolve(base, config.outputDir ?? '');
  const color = config.brandColor ?? '#3182f6';
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw Error('brandColor must be a six-digit hex color.');
  if (!config.appName || typeof config.outputDir !== 'string' || !config.outputDir || !Array.isArray(config.screens) || config.screens.length < 1 || config.screens.length > 10) throw Error('Provide appName, outputDir and 1–10 reviewed screens.');
  const size = config.iphone?.size ?? IPHONE_SIZES[0];
  if (!IPHONE_SIZES.some(([w,h]) => w === size[0] && h === size[1])) throw Error(`iphone.size must be one of ${IPHONE_SIZES.map(s=>s.join('×')).join(', ')}.`);
  const eyebrow = config.eyebrow ?? config.appName;
  const names = new Set(), screens = [];
  // Validate every input before writing output; do not trust dimensions in config.
  for (const item of config.screens) {
    if (!item.reviewedForPublicUse) throw Error('Each capture must be reviewedForPublicUse before rendering.');
    if (typeof item.input !== 'string' || typeof item.title !== 'string' || item.title.split('\n').length > 2) throw Error('Each screen needs an input and a title of at most two lines.');
    if (!/^iphoneScreenshots\/[a-z0-9-]+\.png$/i.test(item.output) || names.has(item.output)) throw Error('Use unique iphoneScreenshots/<name>.png outputs.');
    names.add(item.output);
    const raw = await readFile(resolve(base, item.input));
    const meta = await sharp(raw).metadata();
    if (!meta.width || !meta.height) throw Error('Unreadable capture dimensions.');
    const crop = item.crop ?? {left:0, top:0, width:meta.width, height:meta.height};
    if (!['left','top','width','height'].every(k => Number.isInteger(crop[k])) || crop.left < 0 || crop.top < 0 || crop.width < 1 || crop.height < 1 || crop.left + crop.width > meta.width || crop.top + crop.height > meta.height) throw Error(`Invalid crop for ${basename(item.input)}.`);
    if (crop.height <= crop.width) throw Error(`${basename(item.input)} is not a portrait iPhone capture. Do not substitute iPad or Android screens.`);
    const content = await sharp(raw).extract(crop).png().toBuffer();
    screens.push({...item, content, crop, aspect:crop.width/crop.height, sourceSha256:createHash('sha256').update(raw).digest('hex'), sourceSize:[meta.width, meta.height]});
  }
  const creative = config.creative;
  const placements = creative ? creative.placements ?? ['universal','header','search'] : [];
  if (creative) {
    if (typeof creative.headline !== 'string' || !creative.headline || creative.headline.split('\n').length > 2) throw Error('creative.headline is required and may have at most two lines.');
    if (!placements.length || !placements.every(p => p in CREATIVE)) throw Error('creative.placements may contain universal, header and search.');
  }
  const indices = creative?.screenIndices ?? screens.slice(0,3).map((_,i)=>i);
  if (creative && (indices.length < 1 || indices.length > 3 || !indices.every(i => Number.isInteger(i) && screens[i]) || new Set(indices).size !== indices.length)) throw Error('creative.screenIndices must list 1–3 distinct screen indices.');
  const searchSize = creative?.searchSize ?? CREATIVE.search.max;
  if (creative && placements.includes('search') && (searchSize[0]*2 !== searchSize[1]*3 || searchSize[0] < 1920 || searchSize[0] > 3840)) throw Error('creative.searchSize must be 3:2 between 1920×1280 and 3840×2560.');

  const provenance = Object.fromEntries(['deviceType','deviceModel','bundleId','version','build','captureSize','capturedOn'].filter(key=>config.provenance?.[key]!==undefined).map(key=>[key,config.provenance[key]]));
  const manifest = {schemaVersion:1, createdAt:new Date().toISOString(), appName:config.appName, provenance, assets:[]};
  await mkdir(resolve(out, 'iphoneScreenshots'), {recursive:true});
  for (const screen of screens) {
    const path = resolve(out, screen.output);
    await writeFile(path, await iphoneShot(size[0], size[1], screen, {color, eyebrow}));
    await verify(path, size);
    manifest.assets.push({path:screen.output, size, sourceFile:basename(screen.input), sourceSha256:screen.sourceSha256, sourceSize:screen.sourceSize, crop:screen.crop, transformation:'Crop system UI; scale uniformly; add brand caption and neutral frame. App UI unchanged.'});
  }
  if (creative) {
    await mkdir(resolve(out, 'creative'), {recursive:true});
    const options = {color, eyebrow, headline:creative.headline, subtitle:creative.subtitle, screens:indices.map(i=>screens[i])};
    const targets = {
      universal: {size:CREATIVE.universal.size, safe:universalSafe(), file:'creative/universal-5244x2950.png'},
      header: {size:CREATIVE.header.size, file:'creative/header-3840x1646.png'},
      search: {size:searchSize, file:`creative/search-${searchSize.join('x')}.png`}
    };
    for (const name of placements) {
      const {size:[W,H], safe={x:0, y:0, w:W, h:H}, file} = targets[name];
      const buffer = await hero(W, H, safe, options);
      await writeFile(resolve(out, file), buffer);
      await verify(resolve(out, file), [W,H]);
      if (withGuides) {
        await mkdir(resolve(out, 'previews'), {recursive:true});
        await writeFile(resolve(out, `previews/${name}.png`), name === 'universal' ? await guides(buffer, W, H) : await sharp(buffer).resize(1600).png().toBuffer());
      }
      manifest.assets.push({path:file, placement:name, size:[W,H], ratio:CREATIVE[name].ratio, sourceScreens:indices.map(i=>screens[i].output), transformation:'Brand layout composed with unaltered captured app content in neutral phone frames. No alpha channel.'});
    }
  }
  await writeFile(resolve(out, 'assets-manifest.json'), JSON.stringify(manifest, null, 2)+'\n');
  return {out, manifest};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  const configIndex = process.argv.indexOf('--config');
  if (configIndex < 0 || !process.argv[configIndex+1]) {
    console.error('Usage: node <skill>/scripts/render-app-store-assets.mjs --config <reviewed-captures.json> [--guides]');
    process.exitCode = 1;
  } else {
    render(resolve(process.argv[configIndex+1]), {withGuides:process.argv.includes('--guides')}).then(({out, manifest}) => {
      for (const asset of manifest.assets) console.log(`${asset.path}: ${asset.size.join('×')}`);
      console.log(`Manifest: ${relative(process.cwd(), resolve(out, 'assets-manifest.json'))}`);
    }).catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}
