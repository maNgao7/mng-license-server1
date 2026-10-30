import fs from 'node:fs';
import path from 'node:path';
import {imageSize} from 'image-size';
import avatarTools from './vendor/avatars.cjs';
const {avatarUrl,imageExtension}=avatarTools;
const valid=name=>typeof name==='string'&&/^[a-z0-9_.]{1,64}$/.test(name);
const maxBytes=5*1024*1024;

function photo(bytes){
  if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>maxBytes||!['png','jpg','webp'].includes(imageExtension(bytes)))return null;
  try{const size=imageSize(bytes);if(Math.min(size.width,size.height)<512||Math.max(size.width,size.height)>4096)return null;return {bytes,width:size.width,height:size.height};}catch{return null;}
}

export class VsPortraits {
  constructor({folders=[],fetch:request=globalThis.fetch,base='http://127.0.0.1:3000',now=Date.now}={}){
    const url=new URL(base);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.pathname!=='/')throw new Error('VS service must be local');
    this.base=url.origin;this.folders=[...new Set(folders.map(p=>path.resolve(p)))];this.fetch=request;this.now=now;
    this.pending=new Map();this.retry=new Map();this.queue=[];this.active=false;this.closed=false;this.controllers=new Set();
  }
  cached(username){
    let best=null;
    if(!valid(username))return null;
    for(const folder of this.folders)try{
      const stem=path.join(folder,'user_'+username),file=stem+'.bin',meta=JSON.parse(fs.readFileSync(stem+'.json','utf8'));
      if(!avatarUrl(meta.url))continue;
      const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>maxBytes)continue;
      const candidate=photo(fs.readFileSync(file));if(candidate&&(!best||Math.min(candidate.width,candidate.height)>Math.min(best.width,best.height)))best=candidate;
    }catch{}
    return best;
  }
  get(username,urls=[]){
    if(this.closed||!valid(username))return Promise.resolve(null);
    const cached=this.cached(username);if(cached)return Promise.resolve({...cached,source:'vs-cache'});
    if(this.pending.has(username))return this.pending.get(username);
    const original=urls.map(avatarUrl).find(Boolean);if(!original||this.pending.size>=8||(this.retry.get(username)||0)>this.now())return Promise.resolve(null);
    let done;const result=new Promise(resolve=>done=resolve);this.pending.set(username,result);this.queue.push({username,url:original.href,done});void this.pump();return result;
  }
  async pump(){
    if(this.active||this.closed)return;this.active=true;
    while(!this.closed&&this.queue.length){const task=this.queue.shift();let result=null;
      try{result=await this.read(task);}catch{}
      this.retry.set(task.username,this.now()+60000);if(this.retry.size>100)this.retry.delete(this.retry.keys().next().value);
      this.pending.delete(task.username);task.done(result);
    }
    this.active=false;
  }
  async read(task){
    const controller=new AbortController();this.controllers.add(controller);const timer=setTimeout(()=>controller.abort(),28000);
    try{
      const health=await this.fetch(this.base+'/api/health',{redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(1200)])});
      if(!health.ok||!health.headers.get('content-type')?.includes('application/json')||Number(health.headers.get('content-length'))>4096){await health.body?.cancel();return null;}
      const identityChunks=[];let identitySize=0;for await(const chunk of health.body){identitySize+=chunk.length;if(identitySize>4096){controller.abort();return null;}identityChunks.push(Buffer.from(chunk));}
      const identity=JSON.parse(Buffer.concat(identityChunks).toString('utf8'));if(identity.app!=='tiktok-vs'||identity.ok!==true)return null;
      // Reuse the same domain API used by VS and profile scoring, not a separate browser scraper.
      const url=new URL('/api/image',this.base);url.searchParams.set('highres','1');url.searchParams.set('user',task.username);url.searchParams.set('url',task.url);
      const response=await this.fetch(url,{redirect:'error',signal:controller.signal});
      if(!response.ok||!/^image\/(png|jpeg|webp)(?:;|$)/i.test(response.headers.get('content-type')||'')||Number(response.headers.get('content-length'))>maxBytes){await response.body?.cancel();return null;}
      const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>maxBytes){controller.abort();return null;}chunks.push(Buffer.from(chunk));}
      const result=photo(Buffer.concat(chunks));return result?{...result,source:'vs-service'}:null;
    }finally{clearTimeout(timer);this.controllers.delete(controller);}
  }
  close(){this.closed=true;for(const controller of this.controllers)controller.abort();for(const task of this.queue){task.done(null);this.pending.delete(task.username);}this.queue=[];}
}
