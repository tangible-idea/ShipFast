import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, resolve, relative, basename} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

// Explicitly selected and reviewed real-device captures only. Never reads a repo,
// executes app code, signs in, or uploads anything to a store.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const svg = (w, h, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><style>text{font-family:'Apple SD Gothic Neo','Noto Sans CJK KR',sans-serif}</style>${body}</svg>`);
const text = (x, y, size, value, fill='#191f28', weight=600) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(value)}</text>`;
const rounded = (w, h, r) => svg(w, h, `<rect width="${w}" height="${h}" rx="${r}" fill="white"/>`);

async function main() {
  const configIndex = process.argv.indexOf('--config');
  if (configIndex < 0 || !process.argv[configIndex + 1]) throw Error('Usage: node <store-launch>/scripts/render-play-assets.mjs --config <reviewed-captures.json>');
  const configPath = resolve(process.argv[configIndex + 1]);
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const base = dirname(configPath);
  const out = resolve(base, config.outputDir);
  const color = config.brandColor ?? '#3182f6';
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw Error('brandColor must be a six-digit hex color.');
  if (!config.appName || typeof config.outputDir !== 'string' || !config.outputDir || !Array.isArray(config.screens) || config.screens.length < 2 || config.screens.length > 8) throw Error('Provide appName, outputDir and 2–8 reviewed screens.');
  const names = new Set();
  const screens = [];
  // Validate all inputs before writing output; do not trust dimensions in config.
  for (const item of config.screens) {
    if (!item.reviewedForPublicUse) throw Error('Each capture must be reviewedForPublicUse before rendering.');
    if (typeof item.input !== 'string' || typeof item.title !== 'string' || item.title.split('\n').length > 2) throw Error('Each screen needs an input and a title of at most two lines.');
    if (!/^phoneScreenshots\/[a-z0-9-]+\.png$/i.test(item.output) || names.has(item.output)) throw Error('Use unique phoneScreenshots/<name>.png outputs.');
    names.add(item.output);
    const raw = await readFile(resolve(base, item.input));
    const meta = await sharp(raw).metadata();
    if (!meta.width || !meta.height) throw Error('Unreadable capture dimensions.');
    const crop = item.crop ?? {left:0, top:0, width:meta.width, height:meta.height};
    if (!['left','top','width','height'].every(k => Number.isInteger(crop[k])) || crop.left < 0 || crop.top < 0 || crop.width < 1 || crop.height < 1 || crop.left + crop.width > meta.width || crop.top + crop.height > meta.height) throw Error(`Invalid crop for ${basename(item.input)}.`);
    const content = await sharp(raw).extract(crop).png().toBuffer();
    screens.push({...item, content, crop, sourceSha256:createHash('sha256').update(raw).digest('hex'), sourceSize:[meta.width, meta.height]});
  }
  const featureIndices = config.feature?.screenIndices ?? [0, 1];
  if (featureIndices.length !== 2 || !featureIndices.every(i => Number.isInteger(i) && screens[i])) throw Error('Feature graphic requires two valid screenIndices.');
  const icon = config.icon ? await sharp(resolve(base, config.icon)).resize(72, 72).flatten({background:'#fff'}).png().toBuffer() : null;
  const provenance = Object.fromEntries(['deviceType','deviceModel','packageId','versionName','versionCode','captureSize','captureDensity','capturedOn'].filter(key=>config.provenance?.[key]!==undefined).map(key=>[key,config.provenance[key]]));
  const manifest = {schemaVersion:1, createdAt:new Date().toISOString(), appName:config.appName, provenance, assets:[]};
  await mkdir(resolve(out, 'phoneScreenshots'), {recursive:true});
  for (const screen of screens) {
    const lines = String(screen.title ?? '').split('\n');
    const bg = svg(1080, 1920, `<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#edf4ff"/><stop offset="1" stop-color="#f8faff"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#bg)"/><circle cx="1040" cy="90" r="230" fill="${color}" opacity=".07"/>${text(72,78,25,config.eyebrow ?? config.appName,color,700)}${lines.map((line,i)=>text(72,151+i*68,54,line)).join('')}${text(72,277,29,screen.subtitle,'#6b7684',400)}<rect x="62" y="337" width="956" height="1524" rx="36" fill="#1957c2" opacity=".08"/><rect x="70" y="329" width="940" height="1524" rx="34" fill="white" stroke="#dce6f5" stroke-width="2"/>`);
    const image = await sharp(screen.content).resize(904, 1488, {fit:'contain',background:'#ffffff'}).png().toBuffer();
    const clipped = await sharp(image).composite([{input:rounded(904,1488,18),blend:'dest-in'}]).toBuffer();
    const output = await sharp(bg).composite([{input:clipped,left:88,top:347}]).flatten({background:'#fff'}).removeAlpha().png().toBuffer();
    await writeFile(resolve(out, screen.output), output);
    manifest.assets.push({path:screen.output, size:[1080,1920], sourceFile:basename(screen.input), sourceSha256:screen.sourceSha256, sourceSize:screen.sourceSize, crop:screen.crop, transformation:'Crop system UI; scale uniformly; add brand caption and neutral frame. App UI unchanged.'});
  }
  const feature = svg(1024,500,`<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#112044"/><stop offset="1" stop-color="#1957c2"/></linearGradient></defs><rect width="1024" height="500" fill="url(#bg)"/><circle cx="930" cy="30" r="230" fill="#fff" opacity=".055"/><circle cx="630" cy="490" r="210" fill="${color}" opacity=".18"/>${text(icon?148:54,112,41,config.appName,'#fff',700)}${text(54,213,35,config.feature?.headline ?? '수업 운영을 한곳에서','#fff',700)}${text(54,263,24,config.feature?.subtitle ?? '고객 · 선생님 · 수업 · 출석 관리','#c7dbff',400)}<rect x="54" y="330" width="360" height="46" rx="23" fill="#ffffff" opacity=".12"/>${text(77,360,20,config.feature?.caption ?? '운영진과 선생님을 위한 업무 앱','#fff',500)}`);
  const overlays = icon ? [{input:icon,left:54,top:58}] : [];
  for (let i=0; i<2; i++) {
    const image = await sharp(screens[featureIndices[i]].content).resize(190,354,{fit:'contain',background:'#fff'}).png().toBuffer();
    const card = await sharp({create:{width:202,height:366,channels:3,background:'#fff'}}).composite([{input:image,left:6,top:6}]).png().toBuffer();
    const clip = await sharp(card).composite([{input:rounded(202,366,18),blend:'dest-in'}]).png().toBuffer();
    overlays.push({input:clip,left:565+i*222,top:i?88:45});
  }
  const featureOutput = await sharp(feature).composite(overlays).flatten({background:'#112044'}).removeAlpha().png().toBuffer();
  await writeFile(resolve(out,'featureGraphic.png'),featureOutput);
  manifest.assets.push({path:'featureGraphic.png',size:[1024,500],sourceScreens:featureIndices.map(i=>screens[i].output),transformation:'Brand layout composed with the same unaltered captured app content.'});
  await writeFile(resolve(out,'assets-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  for (const asset of manifest.assets) console.log(`${asset.path}: ${asset.size.join('×')}`);
  console.log(`Manifest: ${relative(process.cwd(),resolve(out,'assets-manifest.json'))}`);
}

main().catch(error=>{console.error(error.message);process.exitCode=1;});
