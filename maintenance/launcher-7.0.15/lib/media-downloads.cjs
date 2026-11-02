'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {download, hashFile} = require('./download.cjs');
const CACHE = 'media_catalog_assets_v1';
const ENABLED = 'media_background_enabled_v1';
const TYPES = new Set(['.mp4','.webm','.mp3','.wav','.ogg','.gif','.png','.jpg','.jpeg','.webp']);

function createMediaDownloads({store,getRoot,getStudio,onChange = () => {},onAsset = () => {},transfer = download}) {
  let cache = store.get(CACHE,{}), enabled = store.get(ENABLED,true), closed = false, running = null, active = null, holds = 0;
  let items = [], completed = new Set(), failures = new Map(), progress = null, lastReport = 0;
  const inFlight = new Map();
  function snapshot() { return {enabled,running:Boolean(running),total:items.length,completed:completed.size,failed:failures.size,current:active?.title || '',progress}; }
  function report(force = false) { if(force || Date.now()-lastReport >= 300) {lastReport=Date.now();onChange(snapshot());} }
  async function ensure(item,{signal} = {}) {
    if(closed)throw new Error('Medya kütüphanesi kapalı.');
    const url = new URL(item.url), extension = path.extname(url.pathname).toLowerCase();
    if(url.protocol !== 'https:' || url.username || url.password || !TYPES.has(extension) || !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.bytes) || item.bytes < 1)throw new Error('Medya dosyası doğrulanamadı.');
    if(inFlight.has(item.sha256))return inFlight.get(item.sha256);
    const operation = (async () => {
      const studio = getStudio(), root = path.resolve(getRoot());
      const known = studio.listAssets().find(asset=>asset.id === cache[item.sha256]);
      if(known) {
        const file = path.join(root,path.basename(known.id)+extension);
        try {if((await fs.promises.stat(file)).size === item.bytes && await hashFile(file) === item.sha256)return known;}catch{}
      }
      if(signal?.aborted)throw new Error('Medya indirmesi durduruldu.');
      const destination = path.join(root,'Katalog',item.sha256+extension);
      await transfer(url.href,destination,{sha256:item.sha256,bytes:item.bytes,signal,onProgress:value=>{progress=value;report();}});
      if(closed || signal?.aborted || studio !== getStudio())throw new Error('Medya indirmesi durduruldu.');
      const [asset] = await studio.importFiles([destination],[{title:item.title,category:item.category}],{assetsOnly:true});
      const next = {...cache,[item.sha256]:asset.id};
      store.set(CACHE,next);cache=next;
      // The studio owns the verified copy; remove only this queue's redundant cache file.
      await fs.promises.unlink(destination).catch(()=>{});
      onAsset(asset);return asset;
    })();
    inFlight.set(item.sha256,operation);
    try{return await operation;}finally{inFlight.delete(item.sha256);}
  }
  async function pump() {
    if(running || closed || !enabled || holds)return;
    running = (async () => {
      for(const item of items) {
        if(!enabled || closed || holds)break;
        if(completed.has(item.sha256) || failures.has(item.sha256))continue;
        active={title:item.title,controller:new AbortController()};progress=null;report(true);
        try{await ensure(item,{signal:active.controller.signal});completed.add(item.sha256);}
        catch(error){if(enabled && !closed && !holds)failures.set(item.sha256,error.message);}
        finally{active=null;progress=null;report(true);}
      }
    })();
    try{await running;}finally{running=null;report(true);if(!holds&&enabled&&!closed&&items.some(i=>!completed.has(i.sha256)&&!failures.has(i.sha256)))queueMicrotask(()=>void pump());}
  }
  return {
    snapshot,ensure,
    async suspend() {holds++;active?.controller.abort();await running;let released=false;return ()=>{if(released)return;released=true;holds--;if(!holds)void pump();};},
    start(next) {items=next.filter(item=>item.sha256&&item.bytes);completed=new Set([...completed].filter(hash=>items.some(item=>item.sha256===hash)));void pump();},
    async setEnabled(value) {enabled=Boolean(value);store.set(ENABLED,enabled);if(!enabled)active?.controller.abort();else {failures.clear();completed.clear();}report(true);if(enabled)void pump();return snapshot();},
    close() {closed=true;active?.controller.abort();},
    idle: async () => {await running;}
  };
}
module.exports={createMediaDownloads};
