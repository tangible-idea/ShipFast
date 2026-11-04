import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {render, universalSafe} from '../.claude/skills/store-launch/scripts/render-app-store-assets.mjs';

async function fixture(overrides={}) {
  const dir = await mkdtemp(join(tmpdir(), 'shipframe-asc-'));
  for (const [name, w, h] of [['a',1320,2868],['b',1320,2868],['land',2868,1320]]) {
    await sharp({create:{width:w, height:h, channels:4, background:'#f2f4f6'}}).png().toFile(join(dir, `${name}.png`));
  }
  const config = {appName:'Example', outputDir:'./out', screens:[
    {input:'a.png', output:'iphoneScreenshots/01-a.png', title:'오늘 할 일을\n한눈에', subtitle:'실제 화면', reviewedForPublicUse:true},
    {input:'b.png', output:'iphoneScreenshots/02-b.png', title:'Calendar', reviewedForPublicUse:true}
  ], creative:{headline:'수업 운영을 한곳에서', searchSize:[1920,1280]}, ...overrides};
  await writeFile(join(dir, 'config.json'), JSON.stringify(config));
  return dir;
}

test('iPhone 스크린샷과 Header/Search/Universal 이미지를 규격대로 만든다', async () => {
  const dir = await fixture();
  try {
    const {manifest} = await render(join(dir, 'config.json'));
    const sizes = Object.fromEntries(manifest.assets.map(a => [a.path, a.size.join('x')]));
    assert.equal(sizes['iphoneScreenshots/01-a.png'], '1320x2868');
    assert.equal(sizes['creative/header-3840x1646.png'], '3840x1646');
    assert.equal(sizes['creative/search-1920x1280.png'], '1920x1280');
    assert.equal(sizes['creative/universal-5244x2950.png'], '5244x2950');
    for (const asset of manifest.assets) {
      const meta = await sharp(join(dir, 'out', asset.path)).metadata();
      assert.equal(meta.hasAlpha, false, `${asset.path} must not have alpha`);
    }
  } finally { await rm(dir, {recursive:true, force:true}); }
});

test('공용 이미지의 안전 영역은 21:9 헤더와 3:2 검색 crop의 교집합이다', () => {
  const s = universalSafe();
  assert.deepEqual([s.w, s.h], [4425, 2247]);
  assert.ok(s.x > 0 && s.y > 0 && s.x+s.w <= 5244 && s.y+s.h <= 2950);
});

test('검토하지 않았거나 가로·긴 문구 입력은 출력 전에 거부한다', async () => {
  const cases = [
    [{screens:[{input:'a.png', output:'iphoneScreenshots/01-a.png', title:'A', reviewedForPublicUse:false}]}, /reviewedForPublicUse/],
    [{screens:[{input:'land.png', output:'iphoneScreenshots/01-a.png', title:'A', reviewedForPublicUse:true}]}, /portrait/],
    [{creative:{headline:'아주 길고 긴 헤드라인 문구가 레이아웃을 넘어서는 경우를 확인합니다 계속 계속 이어집니다'}}, /too long/],
    [{iphone:{size:[1080,1920]}}, /iphone.size/]
  ];
  for (const [override, pattern] of cases) {
    const dir = await fixture(override);
    try { await assert.rejects(render(join(dir, 'config.json')), pattern); }
    finally { await rm(dir, {recursive:true, force:true}); }
  }
});
