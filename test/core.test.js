import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {analyze,iconBrand,screenshotPaths,classify,logoSvg,logoIcons,privacyMarkdown,launchReadme,shotSummary,normalizeLang,renderShot,devices,platformOf} from '../src/core.js';

const tree=[{path:'pubspec.yaml',type:'blob',size:100,sha:'a'},{path:'test/store/store_screenshots_test.dart',type:'blob',size:100,sha:'b'},{path:'store/app_store/screenshots/ko/01_link.png',type:'blob',size:100,sha:'c'}];
test('Flutter 저장소의 화면과 스크린샷 테스트를 감지한다',()=>{
 assert.equal(screenshotPaths(tree).length,1);
 const shots=[{path:tree[2].path,sha:'c',width:1284,height:2778,kind:classify(tree[2].path,1284,2778),platform:platformOf(tree[2].path)}];
 const report=analyze(tree,{'pubspec.yaml':'name: townloader','ios/Runner/Info.plist':'<key>CFBundleDisplayName</key><string>Townloader</string>'},shots);
 assert.equal(report.appName,'Townloader');assert.equal(report.flutterTest,true);
 assert.equal(report.devices.find(x=>x.id==='iphone').count,1);
 assert.equal(report.devices.find(x=>x.id==='ipad').count,0);assert.equal(report.devices.find(x=>x.id==='android').count,0);
});
test('전화 화면은 iPhone 규격으로 만들고 태블릿으로 위장하지 않는다',async()=>{
 const phone=await sharp({create:{width:100,height:220,channels:3,background:'#ff0000'}}).png().toBuffer();
 const output=await renderShot(phone,devices[0]);const m=await sharp(output).metadata();
 assert.equal(m.width,1290);assert.equal(m.height,2796);
 await assert.rejects(renderShot(phone,devices[1]),/비율/);
});
test('아이콘 테마와 대표색은 소스 근거가 있을 때만 추출한다',()=>{
 const found=iconBrand({'lib/theme.dart':'ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: Color(0xFF2A6FBB)))','README.md':'A travel planner for weekend trips.'});
 assert.equal(found.theme,'travel');assert.equal(found.color,'#2a6fbb');
 assert.equal(found.colorSource,'lib/theme.dart');assert.equal(found.themeSource,'README.md');
 assert.deepEqual(iconBrand({'package.json':'{"name":"app"}'}),{theme:null,themeSource:null,color:null,colorSource:null});
 assert.match(logoSvg('Trip','#2a6fbb','travel'),/circle cx="512"/);
});
test('정책 초안은 미입력 항목을 공개 전 확인하도록 표시한다',()=>{
 const text=privacyMarkdown({appName:'Demo',operator:'Maker'});
 assert.match(text,/Privacy Policy \(Draft for Review\)/);assert.match(text,/\[Describe the data collected and its purpose\]/);
 const ja=privacyMarkdown({appName:'Demo',lang:'ja'});assert.match(ja,/プライバシーポリシー/);assert.match(ja,/\[収集するデータと利用目的を入力\]/);
 const ko=privacyMarkdown({appName:'Demo',lang:'ko'});assert.match(ko,/검토용 초안/);
 assert.equal(normalizeLang('fr'),'en');
 assert.match(launchReadme('Demo','owner/repo',[shotSummary('iPhone',null,'ja')],'ja'),/元画像なし/);
 assert.match(logoSvg('My App'),/>MA<\/text>/);
});

test('UI translations cover every English key',async()=>{
 const {translations}=await import('../public/i18n.js');
 for(const locale of ['ja','ko'])assert.deepEqual(Object.keys(translations[locale]).sort(),Object.keys(translations.en).sort());
});
test('all marked page strings have English and Japanese translations',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {translations}=await import('../public/i18n.js');
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 for(const [,key] of html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)){
  assert.ok(translations.en[key],`English: ${key}`);
  assert.ok(translations.ja[key],`Japanese: ${key}`);
 }
});
test('내장 로고로 iOS 1024px과 Google Play 512px 아이콘을 만든다',async()=>{
 const {ios,play}=await logoIcons('Townloader','#2a6fbb','travel');
 const [a,b]=await Promise.all([sharp(ios).metadata(),sharp(play).metadata()]);
 assert.deepEqual([a.width,a.height,a.hasAlpha],[1024,1024,false]);
 assert.deepEqual([b.width,b.height],[512,512]);
 assert.ok(play.length<=1_048_576);
});
