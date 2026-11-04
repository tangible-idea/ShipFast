import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import sharp from 'sharp';

const run = promisify(execFile);
const script = resolve('.claude/skills/shipfast/scripts/render-play-assets.mjs');

async function fixture(feature) {
  const dir = await mkdtemp(join(tmpdir(), 'shipfast-play-'));
  for (const name of ['a','b']) await sharp({create:{width:1080, height:2340, channels:3, background:'#f2f4f6'}}).png().toFile(join(dir, `${name}.png`));
  const screens = ['a','b'].map((n,i) => ({input:`${n}.png`, output:`phoneScreenshots/0${i+1}-${n}.png`, title:'Real screen', reviewedForPublicUse:true}));
  await writeFile(join(dir, 'config.json'), JSON.stringify({appName:'Any App', brandColor:'#16a34a', outputDir:'./out', screens, feature}));
  return dir;
}

test('renders Play screenshots and feature graphic for any brand', async () => {
  const dir = await fixture({headline:'Grow happier plants'});
  try {
    await run('node', [script, '--config', join(dir, 'config.json')]);
    const shot = await sharp(join(dir, 'out/phoneScreenshots/01-a.png')).metadata();
    const feature = await sharp(join(dir, 'out/featureGraphic.png')).metadata();
    assert.deepEqual([shot.width, shot.height, feature.width, feature.height], [1080, 1920, 1024, 500]);
  } finally { await rm(dir, {recursive:true, force:true}); }
});

test('requires a feature headline instead of falling back to canned copy', async () => {
  const dir = await fixture({});
  try { await assert.rejects(run('node', [script, '--config', join(dir, 'config.json')]), /feature\.headline is required/); }
  finally { await rm(dir, {recursive:true, force:true}); }
});
