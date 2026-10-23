import {createHash} from 'node:crypto';
import sharp from 'sharp';
const domains=['tiktokcdn.com','tiktokcdn-us.com','tiktokcdn-eu.com','byteimg.com','ibytedtos.com','muscdn.com'];
export function validAvatarUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&domains.some(d=>url.hostname===d||url.hostname.endsWith('.'+d));}catch{return false;}}
function urls(value){if(typeof value==='string')return[value];if(Array.isArray(value))return value.flatMap(urls);if(!value)return[];return urls(value.urlList||value.url_list||value.urls||value.url||[]);}
export function avatarFrom(user,data={}){
  const candidates=[user.avatarLarger,user.avatarLarge,user.avatar_larger,user.avatar_large,user.avatarMedium,user.avatar_medium,user.profilePictureLarge,user.profilePictureMedium,user.profilePicture,user.profilePictureUrl,data.profilePictureUrl,user.avatarThumb,user.avatar_thumb].flatMap(urls).filter(validAvatarUrl);
  return candidates[0]||'';
}
export class Avatars {
  constructor({fetcher=fetch,limit=160}={}){Object.assign(this,{fetcher,limit});this.entries=new Map();this.active=0;}
  remember(url){if(!validAvatarUrl(url))return'';const key=createHash('sha256').update(url).digest('hex').slice(0,32);const entry=this.entries.get(key)||{url};this.entries.delete(key);this.entries.set(key,entry);while(this.entries.size>this.limit)this.entries.delete(this.entries.keys().next().value);return`/avatars/${key}.png`;}
  async load(key){
    const entry=this.entries.get(key);if(!entry)return null;if(entry.buffer)return entry.buffer;if(entry.pending)return entry.pending;if(entry.retry>Date.now()||this.active>=3)return null;this.active++;
    entry.pending=(async()=>{
      try{
        const response=await this.fetcher(entry.url,{redirect:'error',signal:AbortSignal.timeout(7000),headers:{'User-Agent':'Mozilla/5.0','Referer':'https://www.tiktok.com/'}});
        if(!response.ok||!/^image\/(?:png|jpeg|webp|gif|avif)(?:;|$)/i.test(response.headers.get('content-type')||'')||Number(response.headers.get('content-length'))>4e6)return null;
        const chunks=[];let length=0;for await(const chunk of response.body){length+=chunk.length;if(length>4e6)throw new Error('Avatar too large');chunks.push(chunk);}
        const {data,info}=await sharp(Buffer.concat(chunks),{limitInputPixels:16e6,animated:false}).rotate().resize(256,256,{fit:'cover',kernel:'lanczos3'}).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
        for(let y=0;y<256;y++)for(let x=0;x<256;x++){
          const distance=Math.hypot(x-127.5,y-127.5),offset=(y*256+x)*4;data[offset+3]=Math.round(data[offset+3]*Math.max(0,Math.min(1,128-distance)));
          if(distance>124&&distance<127){data[offset]=242;data[offset+1]=251;data[offset+2]=255;}
        }
        entry.buffer=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();return entry.buffer;
      }catch{return null;}finally{this.active--;entry.retry=Date.now()+15000;entry.pending=null;}
    })();return entry.pending;
  }
}
