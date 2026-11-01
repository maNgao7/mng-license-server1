import {parse} from 'parse5';
import {portraitCandidates} from './portrait-cache.mjs';
const normalize=value=>typeof value==='string'?value.trim().replace(/^@/,'').toLowerCase():'';
const valid=name=>/^[a-z0-9_.]{1,64}$/.test(name);

export function extractSources(html,username){
  if(typeof html!=='string'||html.length>1500000||!valid(username))return [];
  const scripts=[];
  function walk(node){
    if(node.tagName==='script'){
      const id=node.attrs?.find(a=>a.name==='id')?.value;
      if(['__UNIVERSAL_DATA_FOR_REHYDRATION__','SIGI_STATE'].includes(id))scripts.push({id,text:(node.childNodes||[]).map(n=>n.value||'').join('')});
    }
    for(const child of node.childNodes||[])walk(child);
  }
  walk(parse(html));
  const found=[];
  for(const script of scripts)try{
    const state=JSON.parse(script.text);
    const user=script.id==='SIGI_STATE'?state.UserModule?.users?.[username]:state.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo?.user;
    if(normalize(user?.uniqueId)!==username)continue;
    found.push(...portraitCandidates({user}));
  }catch{}
  return found.sort((a,b)=>b.rank-a.rank);
}

export class ProfileSources {
  constructor({fetch:request=globalThis.fetch,now=Date.now,render}={}){this.fetch=request;this.render=render;this.now=now;this.cache=new Map();this.pending=new Map();this.queue=[];this.active=0;this.closed=false;this.controllers=new Set();}
  get(username,{renderOnly=false,preferRender=false}={}){
    if(!valid(username)||this.closed)return Promise.resolve([]);
    if(renderOnly&&!this.render)return Promise.resolve([]);
    const key=renderOnly?'render:'+username:username;
    const cached=this.cache.get(key);if(cached&&cached.until>this.now())return Promise.resolve(cached.sources);
    if(this.pending.has(key))return this.pending.get(key);
    if(this.pending.size>=16)return Promise.resolve([]);
    let done;const promise=new Promise(resolve=>done=resolve);this.pending.set(key,promise);this.queue.push({username,key,renderOnly,preferRender,done});void this.pump();return promise;
  }
  async pump(){
    if(this.active>=2||this.closed)return;this.active++;
    while(!this.closed&&this.queue.length){const job=this.queue.shift();let sources=[];
      if(!job.renderOnly&&!(job.preferRender&&this.render))try{sources=await this.read(job.username);}catch{}
      if((job.renderOnly||!sources.some(s=>s.rank>=3))&&this.render&&!this.closed){
        const key='render:'+job.username,cached=this.cache.get(key);let rendered=[];
        if(cached&&cached.until>this.now())rendered=cached.sources;
        else{try{rendered=await this.render(job.username);}catch{}this.cache.set(key,{sources:rendered,until:this.now()+(rendered.length?600000:60000)});}
        sources=[...rendered,...sources];
      }
      if(this.cache.size>=60)this.cache.delete(this.cache.keys().next().value);
      this.cache.set(job.key,{sources,until:this.now()+(sources.length?10*60*1000:60000)});this.pending.delete(job.key);job.done(sources);
    }
    this.active--;
  }
  async read(username){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);this.controllers.add(controller);
    try{
      let url=new URL('https://www.tiktok.com/@'+encodeURIComponent(username));
      for(let redirect=0;redirect<3;redirect++){
        const response=await this.fetch(url,{redirect:'manual',signal:controller.signal,headers:{Accept:'text/html','User-Agent':'TikMnG-ProfileContest/0.2'}});
        if([301,302,303,307,308].includes(response.status)){
          const location=response.headers.get('location');await response.body?.cancel();if(!location)return [];
          const next=new URL(location,url);if(next.origin!=='https://www.tiktok.com'||next.username||next.password||!next.pathname.startsWith('/@'+username))return [];url=next;continue;
        }
        if(response.status!==200||!response.headers.get('content-type')?.includes('text/html')||Number(response.headers.get('content-length'))>1500000){await response.body?.cancel();return [];}
        const chunks=[];let size=0;
        for await(const chunk of response.body){size+=chunk.length;if(size>1500000){controller.abort();return [];}chunks.push(Buffer.from(chunk));}
        return extractSources(Buffer.concat(chunks).toString('utf8'),username);
      }
      return [];
    }finally{clearTimeout(timer);this.controllers.delete(controller);}
  }
  close(){this.closed=true;for(const controller of this.controllers)controller.abort();for(const job of this.queue){job.done([]);this.pending.delete(job.key);}this.queue=[];}
}
