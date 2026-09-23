import sharp from 'sharp';

const bot='Nano-Banana-2-Lite';
const styles=[
 'A bold geometric symbol built from a few clean shapes.',
 'A friendly, softly dimensional symbol with simple lighting.',
 'An elegant minimal emblem using expressive negative space.'
];

export function iconPrompt({name,theme,color},index){
 return `Create ONE professional mobile app icon concept for "${name}". Theme: ${theme}. Primary brand color: ${color}. Art direction: ${styles[index]}. Square 1:1 composition. Full-bleed opaque background, centered single recognizable symbol, high contrast, generous safe margin (keep meaningful artwork inside the central 60%). The artwork must remain clear at 48px. No rounded outer corners, no external drop shadow, no border, no lettering or numbers, no UI mockup, no phone, no store badges, no ranking or price claims. Output only the icon artwork.`;
}

export function poeImageReference(payload){
 const message=payload?.choices?.[0]?.message;
 const candidates=[];
 for(const item of [...(message?.attachments||[]),...(message?.images||[])])candidates.push(item?.url,item?.image_url?.url,item?.data);
 const content=message?.content;
 if(Array.isArray(content))for(const part of content)candidates.push(part?.image_url?.url,part?.url,part?.data,part?.text);
 if(typeof content==='string')candidates.push(content);
 for(const candidate of candidates.filter(x=>typeof x==='string')){
  const data=candidate.match(/data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+/i)?.[0];
  if(data)return data;
  const link=candidate.match(/https:\/\/[^\s)<>"']+/)?.[0];
  if(link)return link;
 }
 throw Object.assign(new Error('Poe did not return an image.'),{status:502});
}

async function imageBytes(reference){
 if(reference.startsWith('data:image/')){
  const bytes=Buffer.from(reference.split(',')[1],'base64');
  if(bytes.length>12_000_000)throw Object.assign(new Error('Poe image is too large.'),{status:502});
  return bytes;
 }
 const url=new URL(reference);
 if(url.protocol!=='https:'||!(url.hostname==='poecdn.net'||url.hostname.endsWith('.poecdn.net')))throw Object.assign(new Error('Unexpected Poe image host.'),{status:502});
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
 if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw Object.assign(new Error('Could not download Poe image.'),{status:502});
 const bytes=Buffer.from(await response.arrayBuffer());
 if(bytes.length>12_000_000)throw Object.assign(new Error('Poe image is too large.'),{status:502});
 return bytes;
}

export async function generateSamples(input,apiKey,request=fetch){
 if(!apiKey)throw Object.assign(new Error('Set POE_API_KEY in the server .env first.'),{status:503});
 return Promise.all(styles.map(async(_,index)=>{
  const response=await request('https://api.poe.com/v1/chat/completions',{
   method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
   body:JSON.stringify({model:bot,stream:false,messages:[{role:'user',content:iconPrompt(input,index)}]}),signal:AbortSignal.timeout(180000)
  });
  if(!response.ok)throw Object.assign(new Error(`Poe generation failed (${response.status}).`),{status:502});
  const bytes=await imageBytes(poeImageReference(await response.json()));
  return sharp(bytes,{limitInputPixels:25_000_000}).rotate().resize(1024,1024,{fit:'cover'}).flatten({background:input.color}).png().toBuffer();
 }));
}

export async function storeIcons(sample){
 const ios=await sharp(sample).resize(1024,1024).flatten({background:'#ffffff'}).png().toBuffer();
 const play=await sharp(sample).resize(512,512).flatten({background:'#ffffff'}).ensureAlpha().png({compressionLevel:9,effort:10,palette:false}).toBuffer();
 if(play.length>1_048_576)throw Object.assign(new Error('Google Play icon exceeds 1 MiB.'),{status:422});
 return {ios,play};
}
