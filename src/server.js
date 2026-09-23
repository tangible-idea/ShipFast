import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import express from 'express';
import session from 'express-session';
import {ZipArchive} from 'archiver';
import sharp from 'sharp';
import {generateSamples,storeIcons} from './poe-icons.js';
import {analyze, iconBrand, screenshotPaths, classify, platformOf, privacyMarkdown, launchReadme, shotSummary, normalizeLang, logoSvg, renderShot, devices, safeText} from './core.js';

const app=express();
const port=Number(process.env.PORT||4321);
const baseUrl=(process.env.BASE_URL||`http://localhost:${port}`).replace(/\/$/,'');
const configured=Boolean(process.env.GITHUB_CLIENT_ID&&process.env.GITHUB_CLIENT_SECRET);
const sessionSecret=process.env.SESSION_SECRET||crypto.randomBytes(32).toString('hex');
app.disable('x-powered-by');
app.use(express.json({limit:'32kb'}));
app.use(session({name:'shipframe.sid',secret:sessionSecret,resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:baseUrl.startsWith('https:'),maxAge:8*60*60*1000}}));
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)),'../public')));
app.use((req,res,next)=>{if(req.method==='POST'&&req.get('origin')&&req.get('origin')!==baseUrl)return res.status(403).json({error:'Invalid origin'});next()});

async function gh(token,url) {
 const response=await fetch(`https://api.github.com${url}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Shipframe'}});
 if(!response.ok) throw Object.assign(new Error(response.status===401?'GitHub 연결이 만료되었습니다. 다시 연결하세요.':`GitHub 요청 실패 (${response.status})`),{status:response.status});
 return response.json();
}
async function blob(token,repo,sha){
 const b=await gh(token,`/repos/${repo}/git/blobs/${sha}`);
 if(b.encoding!=='base64') throw new Error('지원하지 않는 파일 형식입니다.');
 return Buffer.from(b.content.replace(/\s/g,''),'base64');
}
function auth(req,res,next){if(!req.session.token)return res.status(401).json({error:localizedError('GitHub 연결이 필요합니다.',errorLanguage(req))});next()}
function iconAccess(req,res,next){if(req.session.token||['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return next();res.status(401).json({error:'Open Shipframe locally or connect GitHub first.'})}
function validRepo(s){return /^[\w.-]+\/[\w.-]+$/.test(s||'')}
function errorLanguage(req){return normalizeLang(req.body?.lang||req.query?.lang)}
const errors={
 'GitHub 연결이 만료되었습니다. 다시 연결하세요.':['GitHub authorization expired. Reconnect your account.','GitHub の認証が期限切れです。再連携してください。'],
 '지원하지 않는 파일 형식입니다.':['Unsupported file format.','対応していないファイル形式です。'],
 'GitHub 연결이 필요합니다.':['Connect GitHub first.','先に GitHub と連携してください。'],
 'GitHub 인증에 실패했습니다.':['GitHub authorization failed.','GitHub 認証に失敗しました。'],
 '저장소가 너무 커서 전체 파일 목록을 확인할 수 없습니다.':['This repository is too large to inspect completely.','リポジトリが大きすぎるため、すべてのファイルを確認できません。'],
 '저장소 이름이 올바르지 않습니다.':['Invalid repository name.','リポジトリ名が正しくありません。'],
 '먼저 저장소를 분석하세요.':['Analyze a repository first.','先にリポジトリを分析してください。'],
 '서버 오류가 발생했습니다.':['A server error occurred.','サーバーエラーが発生しました。']
};
function localizedError(message,lang){if(lang==='ko')return message;const index=lang==='ja'?1:0;const githubStatus=message.match(/^GitHub 요청 실패 \((\d+)\)$/);if(githubStatus)return lang==='ja'?`GitHub リクエストに失敗しました (${githubStatus[1]})`:`GitHub request failed (${githubStatus[1]})`;return errors[message]?.[index]||message;}


app.get('/api/me',(req,res)=>res.json({configured,poeConfigured:Boolean(process.env.POE_API_KEY),user:req.session.user||null}));
app.get('/auth/github',(req,res)=>{
 if(!configured)return res.status(503).send('GitHub OAuth is not configured. See .env.example.');
 const state=crypto.randomBytes(24).toString('hex'); req.session.oauthState=state;
 const p=new URLSearchParams({client_id:process.env.GITHUB_CLIENT_ID,redirect_uri:`${baseUrl}/auth/github/callback`,scope:'repo read:user',state});
 res.redirect(`https://github.com/login/oauth/authorize?${p}`);
});
app.get('/auth/github/callback',async(req,res,next)=>{
 try {
  if(!req.query.state||req.query.state!==req.session.oauthState) return res.status(403).send('OAuth state mismatch');
  delete req.session.oauthState;
  if(typeof req.query.code!=='string') return res.redirect('/?error=oauth');
  const response=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:process.env.GITHUB_CLIENT_ID,client_secret:process.env.GITHUB_CLIENT_SECRET,code:req.query.code,redirect_uri:`${baseUrl}/auth/github/callback`})});
  const payload=await response.json();
  if(!response.ok||!payload.access_token) throw new Error('GitHub 인증에 실패했습니다.');
  const user=await gh(payload.access_token,'/user');
  req.session.token=payload.access_token;
  req.session.user={login:user.login,avatar:user.avatar_url};
  res.redirect('/');
 }catch(e){next(e)}
});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/repos',auth,async(req,res,next)=>{
 try {const repos=await gh(req.session.token,'/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&sort=updated&per_page=100');res.json(repos.map(r=>({fullName:r.full_name,private:r.private,language:r.language,updatedAt:r.updated_at})));}catch(e){next(e)}
});
async function inspect(req,repo){
 const info=await gh(req.session.token,`/repos/${repo}`);
 const tree=await gh(req.session.token,`/repos/${repo}/git/trees/${encodeURIComponent(info.default_branch)}?recursive=1`);
 if(tree.truncated) throw new Error('저장소가 너무 커서 전체 파일 목록을 확인할 수 없습니다.');
 const wanted=['pubspec.yaml','ios/Runner/Info.plist','android/app/build.gradle.kts','android/app/build.gradle'];
 const files={};
 for(const p of wanted){const entry=tree.tree.find(x=>x.path===p);if(entry&&entry.size<250_000) files[p]=(await blob(req.session.token,repo,entry.sha)).toString('utf8');}
 const brandPaths=tree.tree.filter(x=>x.type==='blob'&&x.size<100_000&&/(?:^|\/)(?:README(?:\.md)?|pubspec\.yaml|package\.json|app\.json|theme\.(?:dart|css|scss|js|ts|tsx)|colors?\.(?:dart|xml|css|scss|js|ts|tsx)|styles?\.css|main\.dart|app\.dart|Info\.plist)$/i.test(x.path)).sort((a,b)=>Number(/theme|color/i.test(b.path))-Number(/theme|color/i.test(a.path))).slice(0,14);
 for(const entry of brandPaths){if(!(entry.path in files))try{files[entry.path]=(await blob(req.session.token,repo,entry.sha)).toString('utf8');}catch{}}
 const candidates=screenshotPaths(tree.tree).slice(0,24);
 const shots=[];
 for(const item of candidates){
  try{const data=await blob(req.session.token,repo,item.sha);const m=await sharp(data).metadata();if(m.width&&m.height)shots.push({path:item.path,sha:item.sha,width:m.width,height:m.height,kind:classify(item.path,m.width,m.height),platform:platformOf(item.path)});}catch{}
 }
 return {...analyze(tree.tree,files,shots),brand:iconBrand(files,info.description||''),repo:info.full_name,description:info.description||'',shots};
}
app.get('/api/analyze',auth,async(req,res,next)=>{
 try{const repo=String(req.query.repo||'');if(!validRepo(repo))return res.status(400).json({error:localizedError('저장소 이름이 올바르지 않습니다.',errorLanguage(req))});const report=await inspect(req,repo);req.session.report=report;delete req.session.iconSamples;delete req.session.iconChoice;res.json(report);}catch(e){next(e)}
});
app.get('/api/icon-preview',iconAccess,(req,res)=>{
 const color=/^#[0-9a-f]{6}$/i.test(req.query.color)?req.query.color:'#6255df';
 res.type('image/svg+xml').send(logoSvg(safeText(req.query.name,80),color,safeText(req.query.theme,80)));
});
app.post('/api/icon-samples',iconAccess,async(req,res,next)=>{
 try{
  const name=safeText(req.body.name,80)||req.session.report?.appName||'My App';
  const theme=safeText(req.body.theme,80);
  const color=/^#[0-9a-f]{6}$/i.test(req.body.color)?req.body.color:null;
  if(!theme||!color)return res.status(400).json({error:'Choose an icon theme and primary color first.'});
  const samples=await generateSamples({name,theme,color},process.env.POE_API_KEY);
  req.session.iconSamples=samples.map(x=>x.toString('base64'));
  req.session.iconInput={name,theme,color};
  delete req.session.iconChoice;
  res.json({samples:[0,1,2].map(i=>`/api/icon-samples/${i}`)});
 }catch(e){next(e)}
});
app.get('/api/icon-samples/:index',iconAccess,(req,res)=>{
 const index=Number(req.params.index),sample=req.session.iconSamples?.[index];
 if(!Number.isInteger(index)||index<0||index>2||!sample)return res.sendStatus(404);
 res.type('png').send(Buffer.from(sample,'base64'));
});
app.post('/api/icon-choice',iconAccess,(req,res)=>{
 const index=Number(req.body.index);
 if(!Number.isInteger(index)||index<0||index>2||!req.session.iconSamples?.[index])return res.status(400).json({error:'Choose one of the three icon samples.'});
 req.session.iconChoice=index;
 res.json({ok:true});
});
app.get('/api/icon-download',iconAccess,async(req,res,next)=>{
 try{
  const sample=req.session.iconSamples?.[req.session.iconChoice];
  if(!sample)return res.status(400).json({error:'Choose one of the three icon samples first.'});
  const icon=await storeIcons(Buffer.from(sample,'base64'));
  const archive=new ZipArchive({zlib:{level:7}});
  res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition','attachment; filename="app-icons.zip"');
  archive.on('error',e=>res.destroy(e));archive.pipe(res);
  archive.append(icon.ios,{name:'ios-app-icon-1024.png'});
  archive.append(icon.play,{name:'google-play-icon-512.png'});
  await archive.finalize();
 }catch(e){next(e)}
});
app.post('/api/export',auth,async(req,res,next)=>{
 try{
  const report=req.session.report;
  if(!report)return res.status(400).json({error:localizedError('먼저 저장소를 분석하세요.',errorLanguage(req))});
  const name=safeText(req.body.appName,80)||report.appName;
  const lang=normalizeLang(req.body.lang);
  const color=/^#[0-9a-f]{6}$/i.test(req.body.color)?req.body.color:null;
  const theme=safeText(req.body.theme,80);
  if(!color||!theme)return res.status(400).json({error:'Choose an icon theme and primary color first.'});
  if(req.session.iconChoice===undefined||!req.session.iconSamples?.[req.session.iconChoice])return res.status(400).json({error:'Generate three icon samples and choose one first.'});
  const approved=req.session.iconInput;
  if(approved.name!==name||approved.theme!==theme||approved.color.toLowerCase()!==color.toLowerCase())return res.status(400).json({error:'Icon inputs changed. Generate new samples first.'});
  const selected=Array.isArray(req.body.devices)?req.body.devices.filter(x=>devices.some(d=>d.id===x)):devices.map(x=>x.id);
  const sources=report.shots;
  const icon=await storeIcons(Buffer.from(req.session.iconSamples[req.session.iconChoice],'base64'));
  const archive=new ZipArchive({zlib:{level:7}});
  res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition','attachment; filename="shipframe-launch-kit.zip"');
  archive.on('error',e=>res.destroy(e));archive.pipe(res);
  archive.append(icon.ios,{name:'brand/ios-app-icon-1024.png'});
  archive.append(icon.play,{name:'brand/google-play-icon-512.png'});
  archive.append(privacyMarkdown({...req.body,appName:name,lang}),{name:`privacy/PRIVACY.${lang}.md`});
  const summary=[];
  for(const id of selected){
   const d=devices.find(x=>x.id===id);const images=sources.filter(x=>x.kind===d.kind&&(x.platform===d.platform||x.platform==='unknown')).slice(0,8);
   if(!images.length){summary.push(shotSummary(d.label,null,lang));continue;}
   let count=0;
   for(const img of images){try{const b=await blob(req.session.token,report.repo,img.sha);const out=await renderShot(b,d);archive.append(out,{name:`screenshots/${id}/${String(++count).padStart(2,'0')}.png`});}catch(e){summary.push(`${d.label} ${img.path}: ${e.message}`);}}
   summary.push(shotSummary(d.label,count,lang));
  }
  archive.append(launchReadme(name,report.repo,summary,lang),{name:'README.md'});
  await archive.finalize();
 }catch(e){next(e)}
});
app.use((err,req,res,next)=>{console.error(err);if(res.headersSent)return next(err);res.status(err.status>=400&&err.status<500?err.status:500).json({error:localizedError(err.message||'서버 오류가 발생했습니다.',errorLanguage(req))})});
app.listen(port,()=>console.log(`Shipframe ready at ${baseUrl}`));
