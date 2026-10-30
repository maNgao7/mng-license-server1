'use strict';
const path=require('node:path');
const clean=value=>String(value||'').replace(/^@/,'').trim().toLowerCase();
function createWidgetPortraits({folder,BrowserWindow,session,folders=[],engine=require('./portrait-engine.cjs'),now=Date.now}={}){
    const cache=new engine.PortraitCache(folder),desktop=BrowserWindow&&session?engine.createDesktopPortraits({BrowserWindow,session}):null;
    const sources=new engine.ProfileSources({render:desktop?name=>desktop.get(name):undefined}),vs=new engine.VsPortraits({folders});
    const people=new Map(),pending=new Map(),retryAfter=new Map();let closed=false,windowStart=now(),budget=0;
    function apply(username,image){
        if(closed||!image)return;
        const size=cache.info(image),width=Math.min(size.width,size.height),old=people.get(username);
        if(!width||(old&&old.width>=width))return;
        const id=image.split('/').pop();people.set(username,{image:'/widget/gift-assets/portrait-'+id+'.png',width});
        while(people.size>1500)people.delete(people.keys().next().value);
    }
    async function resolve(username,candidates){
        const urls=candidates.flatMap(group=>group.urls);
        const cached=vs.cached(username);if(cached)apply(username,cache.import(cached.bytes));
        for(const group of candidates){const image=await cache.get(group.urls,{priority:group.rank>=3});apply(username,image);if((people.get(username)?.width||0)>=512)break;}
        if((people.get(username)?.width||0)>=512||closed)return;
        const known=await vs.get(username,urls);if(known)apply(username,cache.import(known.bytes));
        if((people.get(username)?.width||0)>=512||closed)return;
        const originals=await sources.get(username,{preferRender:true});
        for(const group of originals)apply(username,await cache.get(group.urls,{priority:true}));
    }
    function observe(data){
        const username=clean(data?.username||data?.user?.uniqueId||data?.uniqueId);if(closed||!(/^[a-z0-9_.]{1,64}$/).test(username))return;
        if((people.get(username)?.width||0)>=512||pending.has(username)||(retryAfter.get(username)||0)>now())return;
        if(now()-windowStart>=600000){windowStart=now();budget=0;}
        if(budget>=60||pending.size>=8)return;budget++;
        retryAfter.set(username,now()+60000);while(retryAfter.size>1500)retryAfter.delete(retryAfter.keys().next().value);
        const candidates=engine.portraitCandidates(data);
        const task=resolve(username,candidates).catch(()=>{}).finally(()=>pending.delete(username));pending.set(username,task);
    }
    function row(value){
        if(!value||typeof value!=='object')return value;
        const photo=people.get(clean(value.username));return photo?{...value,avatar:photo.image,avatarWidth:photo.width}:value;
    }
    function snapshot(state){
        for(const value of [state.topGift,...Object.values(state.studio?.royalLeaders||{}),...(state.studio?.raconRanking||[]).slice(0,3)])if(value)observe(value);
        const result={...state};for(const name of ['activities','audience','jarGifts','topLikes','topGifters','ranking'])if(Array.isArray(state[name]))result[name]=state[name].map(row);
        if(state.topGift)result.topGift=row(state.topGift);
        const studio=state.studio;if(studio)result.studio={...studio,royalLeaders:Object.fromEntries(Object.entries(studio.royalLeaders||{}).map(([key,value])=>[key,row(value)])),raconRanking:(studio.raconRanking||[]).map(row),tests:Object.fromEntries(Object.entries(studio.tests||{}).map(([key,value])=>[key,{...value,events:(value.events||[]).map(row)}]))};
        return result;
    }
    function file(name){const id=/^portrait-([a-f0-9-]{36})\.png$/.exec(name)?.[1];return id?cache.file(id):'';}
    function close(){closed=true;cache.close();sources.close();vs.close();desktop?.close();}
    return {observe,snapshot,file,close,idle:()=>Promise.all([...pending.values()])};
}
module.exports={createWidgetPortraits};
