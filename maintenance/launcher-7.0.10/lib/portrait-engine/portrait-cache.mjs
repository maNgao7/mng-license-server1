import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {imageSize} from 'image-size';
import avatarTools from './vendor/avatars.cjs';
const {avatarUrl,downloadAvatar,imageExtension}=avatarTools;

const imageUrls=value=>typeof value==='string'?[value]:Array.isArray(value)?value.filter(url=>typeof url==='string'):value&&typeof value==='object'?imageUrls(value.urlList||value.url_list||value.urls||value.url):[];
export function portraitCandidates(data){
  const u=data.user||{},seen=new Set();
  return [
    [4,[u.avatarLarger,u.avatar_larger,data.avatarLarger,data.avatar_larger]],
    [3,[u.avatarLarge,u.avatar_large,data.avatarLarge,data.avatar_large]],
    [2,[u.avatarMedium,u.avatar_medium,u.profilePicture,u.profilePictureUrl,u.profilePictureUrls,data.profilePictureUrl,data.profilePictureUrls,data.profilePicture,data.avatar]],
    [1,[u.avatarThumb,u.avatar_thumb,data.avatarThumb,data.avatar_thumb]],
  ].map(([rank,values])=>({rank,urls:values.flatMap(imageUrls).filter(url=>{if(url.length>4096||seen.has(url))return false;seen.add(url);return true;}).slice(0,16)})).filter(candidate=>candidate.urls.length);
}

export class PortraitCache {
  constructor(folder,{download=downloadAvatar,maxEntries=1500}={}){
    this.folder=folder;this.download=download;this.maxEntries=Math.max(1,maxEntries);this.active=0;this.activePriority=0;this.activeNormal=0;this.jobs=[];this.pending=new Map();this.index=new Map();this.content=new Map();this.dimensions=new Map();this.closed=false;this.failures=new Map();
    fs.mkdirSync(folder,{recursive:true});
    try{const index=JSON.parse(fs.readFileSync(path.join(folder,'index.json'),'utf8'));for(const [key,file] of Object.entries(index))if(/^[a-f0-9]{64}$/.test(key)&&/^[a-f0-9-]{36}\.(png|jpg|webp|gif)$/.test(file)&&fs.existsSync(path.join(folder,file)))this.index.set(key,file);}catch{}
    try{for(const [key,file] of Object.entries(JSON.parse(fs.readFileSync(path.join(folder,'content-index.json'),'utf8'))))if(/^[a-f0-9]{64}$/.test(key)&&/^[a-f0-9-]{36}\.(png|jpg|webp|gif)$/.test(file)&&fs.existsSync(path.join(folder,file)))this.content.set(key,file);}catch{}
  }
  async get(urls,{priority=false}={}){
    for(const candidate of [...new Set(urls||[])].slice(0,16)){
      const url=avatarUrl(candidate);if(!url||this.closed)continue;
      const image=await this.getOne(url,priority);if(image)return image;
    }
    return '';
  }
  getOne(url,priority=false){
    const key=createHash('sha256').update(url.href).digest('hex');
    if(this.index.has(key)){
      const file=this.index.get(key);
      if(fs.existsSync(path.join(this.folder,file))){this.index.delete(key);this.index.set(key,file);return Promise.resolve('./tikmng/media/file/'+file.split('.')[0]);}
      this.index.delete(key);
    }
    if((this.failures.get(key)||0)>Date.now())return Promise.resolve('');
    if(this.pending.has(key)){if(priority){const job=this.jobs.find(job=>job.key===key);if(job){job.priority=true;this.pump();}}return this.pending.get(key);}
    if(this.pending.size>=(priority?128:96))return Promise.resolve('');
    let done;const promise=new Promise(resolve=>done=resolve);this.pending.set(key,promise);this.jobs.push({key,url:url.href,done,priority});this.pump();return promise;
  }
  pump(){
    while(!this.closed&&this.active<3&&this.jobs.length){
      // Reserve two download lanes for originals so a busy chat cannot starve HD work.
      const index=this.jobs.findIndex(job=>job.priority?this.activePriority<2:this.activeNormal<1);if(index<0)return;
      const [job]=this.jobs.splice(index,1);this.active++;if(job.priority)this.activePriority++;else this.activeNormal++;
      this.run(job).finally(()=>{this.pending.delete(job.key);this.active--;if(job.priority)this.activePriority--;else this.activeNormal--;this.pump();});
    }
  }
  async run(job){
    try{
      const image=await this.download(job.url,{signal:AbortSignal.timeout(job.priority?10000:4000)});if(this.closed)return job.done('');
      const size=imageSize(image.bytes);if(!size.width||!size.height||size.width>8192||size.height>8192)throw new Error('Invalid portrait dimensions');
      job.done(this.store(image.bytes,image.extension,size,job.key));this.failures.delete(job.key);
    }catch{this.failures.set(job.key,Date.now()+20000);while(this.failures.size>256)this.failures.delete(this.failures.keys().next().value);job.done('');}
  }
  store(bytes,extension,size,key){
    const digest=createHash('sha256').update(bytes).digest('hex');let file=this.content.get(digest);
    if(!file||!fs.existsSync(path.join(this.folder,file))){
      file=randomUUID()+'.'+extension;
      // Original photo files stay valid even when old signed-URL lookup entries expire.
      fs.writeFileSync(path.join(this.folder,file),bytes,{flag:'wx',mode:0o600});
    }
    this.content.delete(digest);this.content.set(digest,file);this.index.delete(key);this.index.set(key,file);
    for(const map of [this.index,this.content])while(map.size>this.maxEntries)map.delete(map.keys().next().value);
    this.dimensions.set(file.split('.')[0],{width:size.width,height:size.height});
    for(const [name,map] of [['index',this.index],['content-index',this.content]]){const temp=path.join(this.folder,name+'.tmp');fs.writeFileSync(temp,JSON.stringify(Object.fromEntries(map)));fs.renameSync(temp,path.join(this.folder,name+'.json'));}
    return './tikmng/media/file/'+file.split('.')[0];
  }
  file(id){if(!/^[a-f0-9-]{36}$/.test(id))return '';for(const extension of ['png','jpg','webp','gif']){const file=path.join(this.folder,id+'.'+extension);if(fs.existsSync(file))return file;}return '';}
  info(image){
    const id=/^\.\/tikmng\/media\/file\/([a-f0-9-]{36})$/.exec(image||'')?.[1];if(!id)return {width:0,height:0};
    if(this.dimensions.has(id))return this.dimensions.get(id);
    try{const file=this.file(id);if(!file||fs.statSync(file).size>5*1024*1024)return {width:0,height:0};const size=imageSize(fs.readFileSync(file)),result={width:size.width,height:size.height};this.dimensions.set(id,result);return result;}catch{return {width:0,height:0};}
  }
  import(bytes){
    if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>5*1024*1024)throw new Error('Fotoğraf en fazla 5 MB olabilir.');
    const extension=imageExtension(bytes);if(!['png','jpg','webp'].includes(extension))throw new Error('PNG, JPEG veya WebP fotoğraf seç.');
    let size;try{size=imageSize(bytes);}catch{throw new Error('Fotoğraf dosyası okunamadı.');}
    if(Math.min(size.width||0,size.height||0)<512)throw new Error('Net görüntü için en az 512 × 512 piksel fotoğraf seç.');
    if(Math.max(size.width,size.height)>4096)throw new Error('Fotoğraf en fazla 4096 × 4096 piksel olabilir.');
    const key=createHash('sha256').update('manual:').update(bytes).digest('hex');
    if(this.index.has(key))return './tikmng/media/file/'+this.index.get(key).split('.')[0];
    return this.store(bytes,extension,size,key);
  }
  close(){this.closed=true;for(const job of this.jobs)job.done('');this.jobs=[];}
}
