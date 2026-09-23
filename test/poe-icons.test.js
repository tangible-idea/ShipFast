import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {generateSamples,iconPrompt,poeImageReference,storeIcons} from '../src/poe-icons.js';

test('Poe에서 세 가지 시안을 요청하고 선택용 이미지를 정규화한다',async()=>{
 const image=await sharp({create:{width:640,height:640,channels:4,background:'#6633aa'}}).png().toBuffer();
 const data=`data:image/png;base64,${image.toString('base64')}`;
 const calls=[];
 const request=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({choices:[{message:{content:`![icon](${data})`}}]})}};
 const input={name:'Demo',theme:'travel',color:'#6633aa'};
 const samples=await generateSamples(input,'test-key',request);
 assert.equal(calls.length,3);
 assert.equal(new Set(calls.map(x=>x.body.messages[0].content)).size,3);
 assert.ok(calls.every(x=>x.url==='https://api.poe.com/v1/chat/completions'&&x.body.model==='Nano-Banana-2-Lite'&&x.body.stream===false));
 assert.equal((await sharp(samples[0]).metadata()).width,1024);
 const {ios,play}=await storeIcons(samples[0]);
 assert.equal((await sharp(ios).metadata()).height,1024);
 const meta=await sharp(play).metadata();
 assert.equal(meta.width,512);assert.equal(meta.channels,4);assert.ok(play.length<=1_048_576);
 assert.match(iconPrompt(input,0),/No rounded outer corners/);
});

test('Poe 응답에 이미지가 없으면 성공으로 취급하지 않는다',()=>{
 assert.throws(()=>poeImageReference({choices:[{message:{content:'No image'}}]}),/did not return an image/);
});
test('Poe 키가 없으면 이미지 생성 요청을 보내지 않는다',async()=>{
 await assert.rejects(generateSamples({name:'Demo',theme:'travel',color:'#6633aa'},'',()=>{throw Error('request sent')}),/POE_API_KEY/);
});
