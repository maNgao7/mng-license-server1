'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sharp=require('../bridge/node_modules/sharp');
const {normalizeProfile}=require('../bridge/normalize.cjs');
const {AvatarCache,convertAvatar}=require('../bridge/avatars.cjs');
const {profileUrls,cachedOriginal,createOriginalPortraitResolver}=require('../bridge/original-portraits.cjs');
const CDN='https://p16.tiktokcdn.com/original.png';
function folder(t){const root=fs.mkdtempSync(path.join(__dirname,'portrait-test-'));t.after(()=>{const real=fs.realpathSync(root);assert.equal(path.dirname(real),fs.realpathSync(__dirname));assert.ok(path.basename(real).startsWith('portrait-test-'));fs.rmSync(real,{recursive:true});});return root;}
async function png(size){return sharp({create:{width:size,height:size,channels:3,background:'#3a8d7b'}}).png().toBuffer();}
async function idle(cache){const end=Date.now()+5000;while(cache.active||cache.queue.length){assert.ok(Date.now()<end,'portrait work completes');await new Promise(r=>setTimeout(r,10));}}
test('live payload prioritises actual large avatar fields over thumbnails',()=>{
 const p=normalizeProfile({user:{uniqueId:'viewer',avatarLarger:{urlList:[CDN]},avatarThumb:'https://p16.tiktokcdn.com/thumb.png'}});
 assert.equal(p.avatarUrls[0],CDN);
});
test('profile HTML uses only matching identity and allowlisted original images',async()=>{
 const html=user=>'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">'+JSON.stringify({__DEFAULT_SCOPE__:{'webapp.user-detail':{userInfo:{user}}}})+'</script>';
 assert.deepEqual(await profileUrls(html({uniqueId:'viewer',avatarLarger:CDN,avatarLarge:'http://localhost/private'}),'viewer'),[CDN]);
 assert.deepEqual(await profileUrls(html({uniqueId:'other',avatarLarger:CDN}),'viewer'),[]);
 assert.deepEqual(await profileUrls('<script id="SIGI_STATE">broken</script>','viewer'),[]);
});
test('existing profile-game cache retains genuine source resolution and rejects tiny originals',async t=>{
 const root=folder(t);fs.writeFileSync(path.join(root,'user_viewer.json'),JSON.stringify({url:CDN}));
 fs.writeFileSync(path.join(root,'user_viewer.bin'),await png(512));assert.ok(await cachedOriginal('viewer',[root]));
 fs.writeFileSync(path.join(root,'user_viewer.bin'),await png(72));assert.equal(await cachedOriginal('viewer',[root]),null);
 assert.equal(await cachedOriginal('../viewer',[root]),null);
});
test('original resolution does not fabricate detail by enlarging a tiny image',async()=>{
 const image=await convertAvatar({bytes:await png(72)},{size:512});const m=await sharp(image.bytes).metadata();assert.equal(m.width,72);
});
test('gift portrait announces fast thumbnail, then real 512px original exactly once',async t=>{
 const root=folder(t),events=[],thumb=await png(72),source=await png(512);
 let release;const gate=new Promise(r=>release=r);
 const cache=new AvatarCache(root,{onReady:e=>events.push(e),download:async()=>({bytes:thumb}),resolveHighResolution:async()=>{await gate;return{bytes:source};}});t.after(()=>cache.close());
 const p={username:'viewer',avatarUrls:[CDN]};cache.request(p,'epoch',true);
 const end=Date.now()+2000;while(!events.length){assert.ok(Date.now()<end);await new Promise(r=>setTimeout(r,10));}
 assert.equal((await sharp(events[0].avatarFile).metadata()).width,72);assert.equal(events[0].highResolution,undefined);
 release();await idle(cache);assert.equal(events.length,2);assert.equal(events[1].highResolution,true);assert.equal((await sharp(events[1].avatarFile).metadata()).width,512);
 cache.request(p,'epoch',true);await idle(cache);assert.equal(events.length,2);
});
test('disconnect cancels late portrait upgrades and never announces stale identity',async t=>{
 const root=folder(t),events=[],thumb=await png(72),source=await png(512);let release;
 const gate=new Promise(r=>release=r);const cache=new AvatarCache(root,{onReady:e=>events.push(e),download:async()=>({bytes:thumb}),resolveHighResolution:async()=>{await gate;return{bytes:source};}});t.after(()=>cache.close());
 cache.request({username:'viewer',avatarUrls:[CDN]},'old',true);
 const end=Date.now()+2000;while(!events.length){assert.ok(Date.now()<end);await new Promise(r=>setTimeout(r,10));}
 cache.reset();release();await idle(cache);assert.equal(events.length,1);
});
test('original resolver uses bounded fallback and caches unavailable profiles',async()=>{
 let calls=0;const resolve=createOriginalPortraitResolver({folders:[],fetch:async()=>{calls++;return new Response('',{status:404});}});
 const p={username:'viewer',avatarUrls:[CDN]};assert.equal(await resolve(p),null);const first=calls;assert.equal(await resolve(p),null);assert.equal(calls,first);
});
