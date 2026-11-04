import sharp from 'sharp';

export const devices = [
  {id:'iphone', label:'iPhone', size:'1290 × 2796', width:1290, height:2796, platform:'apple', kind:'phone'},
  {id:'ipad', label:'iPad', size:'2064 × 2752', width:2064, height:2752, platform:'apple', kind:'tablet'},
  {id:'android', label:'Android phone', size:'1080 × 1920', width:1080, height:1920, platform:'google', kind:'phone'},
  {id:'android_tablet', label:'Android tablet', size:'1440 × 2560', width:1440, height:2560, platform:'google', kind:'tablet'}
];

const shotPattern = /(?:^|\/)(?:screenshots?|shots|captures?)(?:\/|_)/i;
const imagePattern = /\.(?:png|jpe?g)$/i;
export function screenshotPaths(tree) {
  return tree.filter(x => x.type === 'blob' && imagePattern.test(x.path) && shotPattern.test(x.path) && x.size <= 12_000_000).slice(0,80);
}
export function platformOf(path) {
  const s=path.toLowerCase();
  if (/app_store|appstore|ios|iphone|ipad/.test(s)) return 'apple';
  if (/play_store|playstore|google_play|android/.test(s)) return 'google';
  return 'unknown';
}
export function classify(path, width, height) {
  const s=path.toLowerCase();
  if (/ipad|tablet|10-inch|7-inch/.test(s)) return 'tablet';
  if (/iphone|android|phone/.test(s)) return 'phone';
  return width / height >= 0.55 ? 'tablet' : 'phone';
}
export function analyze(tree, files, shots) {
  const paths=new Set(tree.map(x=>x.path));
  const pubspec=files['pubspec.yaml']||'';
  const plist=files['ios/Runner/Info.plist']||'';
  const gradle=files['android/app/build.gradle.kts']||files['android/app/build.gradle']||'';
  const appName=(plist.match(/<key>CFBundleDisplayName<\/key>\s*<string>([^<]+)/)?.[1] || pubspec.match(/^name:\s*([\w-]+)/m)?.[1] || 'My App').trim();
  const framework=paths.has('pubspec.yaml') ? 'Flutter' : paths.has('package.json') ? 'JavaScript' : paths.some(x=>x.endsWith('.xcodeproj/project.pbxproj')) ? 'iOS' : 'Unknown';
  const hasPrivacy=tree.some(x=>/(^|\/)(privacy|privacy-policy)(\.|\/|$)/i.test(x.path));
  const hasLogo=tree.some(x=>/(^|\/)(app_icon|ic_launcher|icon\.png|logo\.)/i.test(x.path));
  const flutterTest=paths.has('test/store/store_screenshots_test.dart');
  const grouped={phone:shots.filter(x=>x.kind==='phone'),tablet:shots.filter(x=>x.kind==='tablet')};
  return {appName,framework,packageId:gradle.match(/applicationId\s*=\s*["']([^"']+)/)?.[1]||null,hasPrivacy,hasLogo,flutterTest,shots,devices:devices.map(d=>({...d, count:grouped[d.kind].filter(x=>x.platform===d.platform||x.platform==='unknown').length, status:grouped[d.kind].some(x=>x.platform===d.platform||x.platform==='unknown') ? 'ready':'missing'})), nextSteps:[!flutterTest&&framework==='Flutter'?'Flutter 스토어 스크린샷 테스트를 추가하세요.':null,!grouped.phone.length?'휴대폰 실제 화면 캡처가 필요합니다.':null,!grouped.tablet.length?'태블릿 실제 화면 캡처가 필요합니다.':null,!hasPrivacy?'개인정보처리방침을 검토하고 공개 URL을 준비하세요.':null].filter(Boolean)};
}
export function iconBrand(files, description='') {
 const entries=Object.entries(files);
 const colorPatterns=[
  /(?:primaryColor|primary_color|colorPrimary|seedColor|brandColor|brand_color|--(?:color-)?primary|--brand)(?:\s*[:=]\s*|\s*:\s*)(?:const\s+)?(?:Color\s*\(\s*0xFF|#)([0-9a-f]{6})/i,
  /(?:primary|brand)\s*:\s*["']?#([0-9a-f]{6})/i,
  /<color\s+name=["']colorPrimary["']\s*>#([0-9a-f]{6})/i
 ];
 let color=null,colorSource=null;
 for(const [path,content] of entries){
  for(const pattern of colorPatterns){const match=content.match(pattern);if(match){color=`#${match[1].toLowerCase()}`;colorSource=path;break;}}
  if(color)break;
 }
 const themeEntries=entries.filter(([path])=>/(?:^|\/)(?:README(?:\.md)?|pubspec\.yaml|package\.json|app\.json|Info\.plist)$/i.test(path));
 const words=[description,...themeEntries.map(([,content])=>content.slice(0,2500))].join(' ').toLowerCase();
 const themes=[
  {id:'launch',pattern:/\b(?:launch|release|ship|store|deploy)\b|출시|배포|스토어|公開|リリース/i},
  {id:'finance',pattern:/\b(?:finance|bank|budget|money|payment)\b|금융|은행|가계부|결제/i},
  {id:'health',pattern:/\b(?:health|fitness|wellness|medical)\b|건강|운동|의료/i},
  {id:'education',pattern:/\b(?:learn|study|education|school)\b|학습|공부|교육/i},
  {id:'travel',pattern:/\b(?:travel|trip|journey)\b|여행|관광/i}
 ];
 const found=themes.find(t=>t.pattern.test(words));
 return {theme:found?.id||null,themeSource:found?(description&&found.pattern.test(description)?'repository description':themeEntries.find(([,content])=>found.pattern.test(content))?.[0]||null):null,color,colorSource};
}
export function safeText(s, max=100) {return String(s??'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,max);}
export function normalizeLang(lang) {return ['en','ja','ko'].includes(lang)?lang:'en';}
const policyCopy={
 en:{name:'App name',contact:'[Add contact information]',operator:'[Add operator name]',data:'[Describe the data collected and its purpose]',third:'[Describe third-party sharing and external services]',retention:'[Specify the retention period]',title:'Privacy Policy (Draft for Review)',effective:'Effective date',intro:(o,n)=>`${o} (“we”) processes personal information for ${n} as described below. Check the app’s actual behavior and SDKs, complete every placeholder, and review this draft before publishing.`,heads:['Information we collect and why','Sharing and service providers','Retention and deletion','Your choices and rights','Security and changes','Contact'],retentionNote:'We delete information when its purpose is fulfilled or the stated retention period ends. If a law requires longer retention, describe the legal basis and period.',rights:'You may request access, correction, deletion, or restriction of your personal information by contacting us below. Applicable rights depend on your location.',security:'We use appropriate technical and organizational measures to protect personal information. Material changes to this policy will be announced in the app or on its public page.'},
 ja:{name:'アプリ名',contact:'[連絡先を入力]',operator:'[運営者名を入力]',data:'[収集するデータと利用目的を入力]',third:'[第三者提供・外部サービスを入力]',retention:'[保存期間を入力]',title:'プライバシーポリシー（確認用の下書き）',effective:'施行日',intro:(o,n)=>`${o}（以下「運営者」）は、${n} の利用者の個人情報を以下のとおり取り扱います。実際のアプリの動作と SDK を確認し、未記入の項目を埋めてから公開してください。`,heads:['収集する情報と利用目的','第三者提供・委託先','保存と削除','利用者の権利','安全管理と変更','お問い合わせ'],retentionNote:'利用目的の達成または保存期間の終了後、情報を削除します。法令に基づく保存義務がある場合は、根拠と期間を別途記載してください。',rights:'利用者は、個人情報の開示、訂正、削除、利用停止を請求できます。以下の連絡先にお問い合わせください。適用される権利は地域によって異なります。',security:'運営者は個人情報を守るために適切な技術的・組織的対策を講じます。本ポリシーの重要な変更は、アプリまたは公開ページで案内します。'},
 ko:{name:'앱 이름',contact:'[연락처 입력]',operator:'[운영자 이름 입력]',data:'[수집하는 데이터와 목적을 입력]',third:'[제3자 제공 및 외부 서비스 사용 여부 입력]',retention:'[보관 기간 입력]',title:'개인정보처리방침 (검토용 초안)',effective:'시행일',intro:(o,n)=>`${o}(이하 “운영자”)는 ${n} 이용자의 개인정보를 아래와 같이 처리합니다. 실제 앱의 동작과 사용하는 SDK를 확인해 빈 항목을 채운 뒤 게시하세요.`,heads:['수집 항목과 이용 목적','제3자 제공 및 처리 위탁','보관 및 삭제','이용자의 권리','보안 및 변경 안내','문의'],retentionNote:'보관 기간이 끝나거나 목적이 달성되면 관련 정보를 삭제합니다. 법령에 따른 보관 의무가 있다면 해당 근거와 기간을 별도로 명시합니다.',rights:'이용자는 자신의 정보에 대해 열람, 정정, 삭제 및 처리 정지를 요청할 수 있습니다. 아래 연락처로 요청해 주세요.',security:'운영자는 개인정보를 보호하기 위해 필요한 기술적·관리적 조치를 취합니다. 이 방침이 바뀌면 앱 또는 공개 페이지에 변경 내용을 알립니다.'}
};
export function privacyMarkdown(input) {
 const lang=normalizeLang(input.lang),c=policyCopy[lang];
 const name=safeText(input.appName,80)||c.name;
 const contact=safeText(input.contact,150)||c.contact;
 const operator=safeText(input.operator,100)||c.operator;
 const data=safeText(input.dataCollected,800)||c.data;
 const third=safeText(input.thirdParties,800)||c.third;
 const retention=safeText(input.retention,300)||c.retention;
 const h=c.heads;
 return `# ${name} — ${c.title}\n\n${c.effective}: ${new Date().toISOString().slice(0,10)}\n\n${c.intro(operator,name)}\n\n## 1. ${h[0]}\n\n${data}\n\n## 2. ${h[1]}\n\n${third}\n\n## 3. ${h[2]}\n\n${retention}\n\n${c.retentionNote}\n\n## 4. ${h[3]}\n\n${c.rights}\n\n## 5. ${h[4]}\n\n${c.security}\n\n## 6. ${h[5]}\n\n${contact}\n`;
}
export function launchReadme(name,repo,summary,lang='en') {
 const l=normalizeLang(lang);
 const copy={
  en:{title:'Launch kit',repo:'Repository',review:'This privacy policy is a draft. Verify real data practices and SDKs, then publish it at a public URL. The icon is an automatically generated concept; review possible trademark conflicts.',refs:'Store specifications'},
  ja:{title:'公開準備キット',repo:'リポジトリ',review:'プライバシーポリシーは下書きです。実際のデータ処理と SDK を確認し、公開 URL に掲載してください。アイコンは自動生成した案です。商標との抵触も確認してください。',refs:'ストア規格'},
  ko:{title:'출시 패키지',repo:'저장소',review:'개인정보처리방침은 초안입니다. 실제 데이터 처리와 SDK를 확인한 뒤 공개 URL에 게시하세요. 로고는 자동 생성 시안이며 기존 상표와 충돌하는지 검토하세요.',refs:'규격 참고'}
 }[l];
 return `# ${name} ${copy.title}\n\n${copy.repo}: ${repo}\n\n${summary.map(x=>'- '+x).join('\n')}\n\n${copy.review}\n\n${copy.refs}:\n- Apple: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications\n- Google Play: https://support.google.com/googleplay/android-developer/answer/9866151\n`;
}
export function shotSummary(label,count,lang='en') {
 const l=normalizeLang(lang);
 return l==='ja'?count===null?`${label}: 元画像なし — 該当端末での撮影が必要`:`${label}: ${count} 枚作成。実際の端末 UI と現在のアプリの画面か確認してください`:
 l==='ko'?count===null?`${label}: 원본 화면 없음 — 해당 기기에서 캡처 필요`:`${label}: ${count}장 생성. 실제 기기 UI와 출시 시점의 화면인지 검토 필요`:
 count===null?`${label}: no source screens — capture on this device`:`${label}: ${count} generated. Verify these show the current app on the actual device`;
}
export function logoSvg(name,color='#6255df',theme='') {
 const initials=(safeText(name,80).split(/[\s_-]+/).filter(Boolean).map(s=>s[0]).join('').slice(0,2)||'S').toUpperCase();
 const c=/^#[0-9a-f]{6}$/i.test(color)?color:'#6255df';
 const escaped=initials.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
 const symbols={
  launch:'<path d="M300 666 638 328l58 58-338 338-98 40zM575 325l124-42 42 124-45 45-53-71-71-53z" fill="#fff"/><path d="m330 508-89 8 46 46-8 89 93-93zM491 733l-8 70 70-8 56-56-62-62z" fill="#fff" opacity=".7"/>',
  finance:'<rect x="230" y="280" width="564" height="464" rx="86" fill="none" stroke="#fff" stroke-width="68"/><path d="M316 584h392M396 454h220" stroke="#fff" stroke-width="68" stroke-linecap="round"/>',
  health:'<path d="M512 774 275 537c-134-134 57-325 191-191l46 46 46-46c134-134 325 57 191 191z" fill="#fff"/><path d="M346 531h103l41-84 62 160 40-76h86" fill="none" stroke="'+c+'" stroke-width="38" stroke-linecap="round" stroke-linejoin="round"/>',
  education:'<path d="m512 289 319 144-319 145-319-145z" fill="#fff"/><path d="M309 529v142c126 88 280 88 406 0V529" fill="none" stroke="#fff" stroke-width="56" stroke-linejoin="round"/>',
  travel:'<circle cx="512" cy="512" r="255" fill="none" stroke="#fff" stroke-width="62"/><path d="m639 385-81 173-173 81 81-173z" fill="#fff"/>'
 };
 const mark=symbols[theme]||symbols[iconBrand({},theme).theme]||`<text x="512" y="548" fill="#ffffff" font-family="Arial,Helvetica,sans-serif" font-size="382" font-weight="700" letter-spacing="-30" text-anchor="middle" dominant-baseline="middle">${escaped}</text>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${c}"/>${mark}</svg>`;
}
export async function renderShot(buffer, device) {
 const meta=await sharp(buffer).metadata();
 if (!meta.width||!meta.height) throw new Error('이미지 파일을 읽을 수 없습니다.');
 const ratio=meta.width/meta.height;
 const target=device.width/device.height;
 if ((device.kind==='tablet' && ratio<.55)||(device.kind==='phone' && ratio>.72)) throw new Error('기기 화면 비율이 맞지 않습니다.');
 // Preserve the real UI and use a neutral matte where ratios differ.
 return sharp(buffer).flatten({background:'#ffffff'}).resize(device.width,device.height,{fit:'contain',background:'#ffffff'}).png({compressionLevel:9}).toBuffer();
}

// Store icons from an opaque 1024 source: iOS forbids alpha; Google Play allows up to 1 MiB.
export async function storeIcons(source) {
 const ios=await sharp(source).resize(1024,1024).flatten({background:'#ffffff'}).removeAlpha().png().toBuffer();
 const play=await sharp(source).resize(512,512).flatten({background:'#ffffff'}).ensureAlpha().png({compressionLevel:9,effort:10,palette:false}).toBuffer();
 if(play.length>1_048_576)throw Object.assign(new Error('Google Play icon exceeds 1 MiB.'),{status:422});
 return {ios,play};
}
export const logoIcons=(name,color,theme)=>storeIcons(Buffer.from(logoSvg(name,color,theme)));
