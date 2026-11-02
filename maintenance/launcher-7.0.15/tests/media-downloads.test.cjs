'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {createMediaStudio}=require('../lib/media-studio.cjs');
const {createMediaDownloads}=require('../lib/media-downloads.cjs');

function setup(t,{failWrite=false,slow=false}={}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-media-queue-'));
  const values=new Map(),store={get:(key,fallback)=>values.get(key)??fallback,set:(key,value)=>{if(failWrite&&key==='media_studio_v1')throw new Error('Disk full');values.set(key,structuredClone(value));}};
  const studio=createMediaStudio({store,root,accessKey:'isolated-queue-test',getChannel:()=> 'alice'});
  const bytes=Buffer.from('media-fixture-data'),hash=crypto.createHash('sha256').update(bytes).digest('hex');
  const item={id:'test-clip',title:'Komik test sesi',category:'Türkiye Viral',url:`https://example.com/${hash}.mp3`,sha256:hash,bytes:bytes.length};
  let transfers=0;
  const queue=createMediaDownloads({store,getRoot:()=>root,getStudio:()=>studio,transfer:async(url,destination,{signal,onProgress})=>{
    transfers++;
    if(slow)await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,100);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('Aborted'));},{once:true});});
    if(signal?.aborted)throw new Error('Aborted');
    fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);onProgress?.({percent:100});
  }});
  t.after(async()=>{queue.close();await queue.idle();studio.close();assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});});
  return {root,store,studio,queue,item,bytes,transfers:()=>transfers};
}
test('background media creates reusable library assets without gift assignments',async t=>{
  const f=setup(t);f.queue.start([f.item]);await f.queue.idle();
  assert.equal(f.studio.list().length,0);assert.equal(f.studio.listAssets().length,1);assert.equal(f.studio.listSounds().length,1);
  assert.equal(f.studio.listSounds()[0].title,f.item.title);assert.equal(f.queue.snapshot().completed,1);
  assert.equal(fs.existsSync(path.join(f.root,'Katalog',f.item.sha256+'.mp3')),false);
  const again=await f.queue.ensure(f.item);assert.equal(again.id,f.studio.listSounds()[0].id);assert.equal(f.transfers(),1);
  f.studio.addAsset(again.id,{gameId:'caahr'});assert.equal(f.studio.list()[0].gameId,'caahr');
});
test('same file requested concurrently transfers once and user mappings are preserved',async t=>{
  const f=setup(t,{slow:true});const first=f.queue.ensure(f.item),second=f.queue.ensure(f.item);
  const a=await first,b=await second;assert.equal(a.id,b.id);assert.equal(f.transfers(),1);
  f.studio.addAsset(a.id);await f.studio.save({...f.studio.list()[0],giftId:'5655'});
  await f.queue.ensure(f.item);assert.equal(f.studio.list()[0].giftId,'5655');assert.equal(f.studio.list().length,1);
});
test('changed local bytes are redownloaded, not trusted from metadata alone',async t=>{
  const f=setup(t);const asset=await f.queue.ensure(f.item);fs.writeFileSync(path.join(f.root,asset.id+'.mp3'),'wrong');
  await f.queue.ensure(f.item);assert.equal(f.transfers(),2);
});
test('pause aborts current background transfer and resume completes it',async t=>{
  const f=setup(t,{slow:true});f.queue.start([f.item]);await f.queue.setEnabled(false);await f.queue.idle();
  assert.equal(f.studio.listAssets().length,0);assert.equal(f.queue.snapshot().failed,0);
  await f.queue.setEnabled(true);await f.queue.idle();assert.equal(f.queue.snapshot().completed,1);
});

test('priority game or app download suspends media without changing the saved preference',async t=>{
  const f=setup(t,{slow:true});f.queue.start([f.item]);
  const release=await f.queue.suspend();
  assert.equal(f.queue.snapshot().enabled,true);assert.equal(f.queue.snapshot().failed,0);
  assert.equal(f.studio.listAssets().length,0);
  const second=await f.queue.suspend();release();release();
  await new Promise(r=>setTimeout(r,120));assert.equal(f.studio.listAssets().length,0);
  second();await f.queue.idle();assert.equal(f.queue.snapshot().completed,1);
  assert.equal(f.queue.snapshot().failed,0);assert.equal(f.queue.snapshot().enabled,true);
});
test('unsafe URLs, extensions and absent integrity metadata are rejected',async t=>{
  const f=setup(t);
  for(const patch of [{url:'http://example.com/x.mp3'},{url:'https://user:pass@example.com/x.mp3'},{url:'https://example.com/x.exe'},{sha256:null},{bytes:0}])await assert.rejects(f.queue.ensure({...f.item,...patch}));
  assert.equal(f.transfers(),0);
});
test('failed asset persistence leaves no library entry or assigned action',async t=>{
  const f=setup(t,{failWrite:true});await assert.rejects(f.queue.ensure(f.item),/Disk full/);
  assert.equal(f.studio.listAssets().length,0);assert.equal(f.studio.list().length,0);
});
