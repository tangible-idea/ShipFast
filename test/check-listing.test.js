import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import sharp from 'sharp';
import {parseListing, checkPlayListing} from '../.claude/skills/shipfast/scripts/check-listing.mjs';

const run = promisify(execFile);
const script = resolve('.claude/skills/shipfast/scripts/check-listing.mjs');
const png = (path, w, h) => sharp({create: {width: w, height: h, channels: 3, background: '#16a34a'}}).png().toFile(path);

async function shipfast({short = 'Water reminders for every plant you own.', feature = [1024, 500], shots = 2} = {}) {
  const root = join(await mkdtemp(join(tmpdir(), 'shipfast-listing-')), '.shipfast');
  await mkdir(join(root, 'icons/final'), {recursive: true});
  await mkdir(join(root, 'out/phoneScreenshots'), {recursive: true});
  await writeFile(join(root, 'listing.en-US.md'), `## App name\n\nAny App\n\n## Short description\n\n${short}\n\n## Full description\n\nAny App helps you.\n\n- Feature one\n`);
  await writeFile(join(root, 'play-assets.json'), JSON.stringify({outputDir: './out'}));
  await png(join(root, 'icons/final/google-play-icon-512.png'), 512, 512);
  if (feature) await png(join(root, 'out/featureGraphic.png'), ...feature);
  for (let i = 1; i <= shots; i++) await png(join(root, `out/phoneScreenshots/0${i}.png`), 1080, 1920);
  return root;
}

test('parses the three listing sections', () => {
  const text = parseListing('## App name\n\nAny App\n\n## Short description\n\nShort.\n\n## Full description\n\nLine 1\n\n- item\n');
  assert.deepEqual(text, {appName: 'Any App', shortDescription: 'Short.', fullDescription: 'Line 1\n\n- item'});
});

test('passes a complete listing and writes the field-by-field upload plan', async () => {
  const root = await shipfast();
  try {
    await run('node', [script, '--root', root]);
    const plan = JSON.parse(await readFile(join(root, 'listing-upload.json'), 'utf8'));
    assert.equal(plan.text['App name'], 'Any App');
    assert.equal(plan.files['Phone screenshots'].length, 2);
    assert.match(plan.files['Feature graphic'][0], /featureGraphic\.png$/);
  } finally { await rm(join(root, '..'), {recursive: true, force: true}); }
});

test('fails when a required field is missing or out of spec', async () => {
  const cases = [
    [{feature: null}, /featureGraphic: file not found/],
    [{feature: [1024, 512]}, /featureGraphic: 1024×512/],
    [{shots: 1}, /phoneScreenshots: 1 found/],
    [{short: 'x'.repeat(81)}, /shortDescription: 81 characters, limit 80/],
  ];
  for (const [options, pattern] of cases) {
    const root = await shipfast(options);
    try {
      const result = await checkPlayListing({listing: join(root, 'listing.en-US.md'), icon: join(root, 'icons/final/google-play-icon-512.png'),
        featureGraphic: join(root, 'out/featureGraphic.png'), screenshotsDir: join(root, 'out/phoneScreenshots')});
      assert.equal(result.ok, false);
      assert.ok(result.problems.some(p => pattern.test(p)), result.problems.join('\n'));
    } finally { await rm(join(root, '..'), {recursive: true, force: true}); }
  }
});
