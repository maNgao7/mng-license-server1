'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const sharp=require('sharp');
const {avatarUrl,imageExtension,downloadAvatar,MAX_BYTES}=require('./avatars.cjs');
const valid=name=>typeof name==='string'&&/^[a-z0-9_.]{1,64}$/.test(name);
function defaultFolders(){
 const appData=process.env.APPDATA||path.join(os.homedir(),'AppData/Roaming');
 return [path.join(appData,'mng-tiktok-game/games/tiktok-vs/.avatar-cache'),
  path.join(appData,'TikMnG-Test-6.5.17/games/tiktok-vs/.avatar-cache'),
  path.join(os.homedir(),'Desktop/MNG-TikTok-Game/apps/tiktok-vs/.avatar-cache'),
  'D:/TikMnG-tiktok-vs-Widgets-7.0.2-preview.6/.avatar-cache'];
}
async function original(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length>MAX_BYTES||!imageExtension(bytes))return null;
 try{const m=await sharp(bytes,{limitInputPixels:16*1024*1024}).metadata();
  return Math.min(m.width||0,m.height||0)>=256?{bytes,extension:imageExtension(bytes)}:null;
 }catch{return null;}
}
async function cachedOriginal(username,folders=defaultFolders()){
 if(!valid(username))return null;
 for(const folder of folders)try{
  const stem=path.join(folder,'user_'+username),metaFile=stem+'.json',file=stem+'.bin';
  if(fs.lstatSync(metaFile).isSymbolicLink()||fs.statSync(metaFile).size>16384)continue;
  if(!avatarUrl(JSON.parse(fs.readFileSync(metaFile,'utf8')).url))continue;
  const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_BYTES)continue;
  const photo=await original(fs.readFileSync(file));if(photo)return photo;
 }catch{}
 return null;
}
async function boundedBody(response,limit,signal){
 if(Number(response.headers.get('content-length'))>limit){await response.body?.cancel();return null;}
 const chunks=[];let size=0;
 for await(const chunk of response.body){if(signal.aborted)return null;size+=chunk.length;if(size>limit){await response.body?.cancel();return null;}chunks.push(Buffer.from(chunk));}
 return Buffer.concat(chunks);
}
async function profileUrls(html,username){
 const {parse}=await import('parse5'),scripts=[];
 function visit(node){
  if(node.tagName==='script'){
   const id=node.attrs?.find(a=>a.name==='id')?.value;
   if(['__UNIVERSAL_DATA_FOR_REHYDRATION__','SIGI_STATE'].includes(id))scripts.push({id,text:(node.childNodes||[]).map(n=>n.value||'').join('')});
  }
  for(const child of node.childNodes||[])visit(child);
 }
 visit(parse(html));const urls=[];
 for(const script of scripts)try{
  const state=JSON.parse(script.text),user=script.id==='SIGI_STATE'?state.UserModule?.users?.[username]:state.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo?.user;
  if(String(user?.uniqueId||'').toLowerCase()!==username)continue;
  for(const value of [user.avatarLarger,user.avatar_larger,user.avatarLarge,user.avatar_large]){
   const list=typeof value==='string'?[value]:value?.urlList||value?.url_list||[];
   for(const url of list)if(avatarUrl(url))urls.push(url);
  }
 }catch{}
 return [...new Set(urls)].slice(0,4);
}
function createOriginalPortraitResolver({folders=defaultFolders(),fetch:request=globalThis.fetch,download=downloadAvatar,now=Date.now}={}){
 const cache=new Map();let vsUntil=0,vsAvailable=false;
 return async(profile,{signal}={})=>{
  const username=profile.username;if(!valid(username))return null;
  const recent=cache.get(username);if(recent&&recent.until>now())return recent.photo;
  const local=await cachedOriginal(username,folders);if(local)return local;
  const combined=signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000);
  let photo=null;
  try{
   if(now()>=vsUntil){vsUntil=now()+10000;vsAvailable=false;
    try{const response=await request('http://127.0.0.1:3000/api/health',{redirect:'error',signal:AbortSignal.any([combined,AbortSignal.timeout(1000)])});
     const body=response.ok&&response.headers.get('content-type')?.includes('application/json')?await boundedBody(response,4096,combined):null;
     const identity=body?JSON.parse(body):null;vsAvailable=identity?.app==='tiktok-vs'&&identity.ok===true;
    }catch{}
   }
   const url=profile.avatarUrls.map(avatarUrl).find(Boolean);
   if(vsAvailable&&url){
    const target=new URL('http://127.0.0.1:3000/api/image');target.searchParams.set('highres','1');target.searchParams.set('user',username);target.searchParams.set('url',url.href);
    const response=await request(target,{redirect:'error',signal:combined});
    if(response.ok&&/^image\//.test(response.headers.get('content-type')||''))photo=await original(await boundedBody(response,MAX_BYTES,combined));
   }
   if(!photo){
    const response=await request('https://www.tiktok.com/@'+encodeURIComponent(username),{redirect:'error',signal:AbortSignal.any([combined,AbortSignal.timeout(6500)]),headers:{Accept:'text/html','User-Agent':'TikMnG-ProfileContest/0.2'}});
    const body=response.ok&&response.headers.get('content-type')?.includes('text/html')?await boundedBody(response,1500000,combined):null;
    if(body)for(const url of await profileUrls(body.toString('utf8'),username)){
     photo=await original((await download(url,{signal:combined})).bytes);if(photo)break;
    }
   }
  }catch{}
  if(cache.size>=64)cache.delete(cache.keys().next().value);
  cache.set(username,{photo,until:now()+(photo?600000:60000)});return photo;
 };
}
module.exports={createOriginalPortraitResolver,cachedOriginal,profileUrls};
