'use strict';
const valid=name=>typeof name==='string'&&/^[a-z0-9_.]{1,64}$/.test(name);
const {avatarUrl}=require('./vendor/avatars.cjs');

function createDesktopPortraits({BrowserWindow,session,timeout=18000}={}){
  const partition=session.fromPartition('tikmng-profile-portraits');
  partition.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  partition.setPermissionCheckHandler(()=>false);
  partition.on('will-download',event=>event.preventDefault());
  partition.webRequest?.onBeforeRequest((details,callback)=>callback({cancel:details.resourceType==='media'}));
  let active=0,closed=false;const windows=new Set(),pending=new Map(),queue=[];
  async function resolve(username){
    const target='https://www.tiktok.com/@'+encodeURIComponent(username);
    const current=new BrowserWindow({show:false,width:1000,height:800,webPreferences:{session:partition,sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,autoplayPolicy:'user-gesture-required'}});
    windows.add(current);current.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    current.webContents.on('will-navigate',(event,url)=>{try{const u=new URL(url);if(u.origin!=='https://www.tiktok.com'||u.pathname!=='/@'+username)event.preventDefault();}catch{event.preventDefault();}});
    current.webContents.on('will-redirect',(event,url)=>{try{const u=new URL(url);if(u.origin!=='https://www.tiktok.com'||u.pathname!=='/@'+username)event.preventDefault();}catch{event.preventDefault();}});
    let loaded=false;const end=Date.now()+timeout;
    void current.loadURL(target).then(()=>{loaded=true;}).catch(()=>{loaded=true;});
    try{
      while(!closed&&!current.isDestroyed()&&Date.now()<end){
        if(!current.webContents.isLoadingMainFrame()||loaded){
          let inspectionTimer;
          const result=await Promise.race([current.webContents.executeJavaScript(`(() => {
            const name=${JSON.stringify(username)};
            const normalize=value=>String(value||'').replace(/^@/,'').toLowerCase();
            const urls=value=>typeof value==='string'?[value]:Array.isArray(value)?value.flatMap(urls):value&&typeof value==='object'?urls(value.urlList||value.url_list||value.urls||value.url):[];
            for(const id of ['__UNIVERSAL_DATA_FOR_REHYDRATION__','SIGI_STATE'])try{
              const text=document.getElementById(id)?.textContent;if(!text||text.length>1500000)continue;
              const data=JSON.parse(text),user=id==='SIGI_STATE'?data.UserModule?.users?.[name]:data.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo?.user;
              if(normalize(user?.uniqueId)!==name)continue;
              const sources=urls([user.avatarLarger,user.avatarLarge,user.avatar_larger,user.avatar_large]);
              if(sources.length)return {sources:sources.map(url=>({url,width:0,height:0}))};
            }catch{}
            const label=document.querySelector('[data-e2e="user-subtitle"]');
            if(label&&label.textContent.trim().replace(/^@/,'').toLowerCase()===name){
              const images=[...document.images].filter(i=>i.complete&&Math.min(i.naturalWidth,i.naturalHeight)>=512&&i.getBoundingClientRect().width>0);
              const profileImages=images.filter(i=>i.getBoundingClientRect().y<=label.getBoundingClientRect().bottom+200);
              return {sources:profileImages.map(i=>({url:i.currentSrc||i.src,width:i.naturalWidth,height:i.naturalHeight})).filter(i=>{try{return new URL(i.url).pathname.includes('-avt-');}catch{return false;}})};
            }
            const challenge=document.querySelector('iframe[src*="captcha"],[id*="captcha"],[class*="captcha-verify"]');
            return {blocked:!!challenge};
          })()`,false).catch(()=>null),new Promise(resolve=>{inspectionTimer=setTimeout(()=>resolve(null),Math.min(2000,Math.max(1,end-Date.now())));})]);
          clearTimeout(inspectionTimer);
          if(result?.blocked)return [];
          if(result?.sources?.length){const urls=result.sources.sort((a,b)=>Math.min(b.width,b.height)-Math.min(a.width,a.height)).map(i=>avatarUrl(i.url)?.href).filter(Boolean).slice(0,4);if(urls.length)return [{rank:4,urls}];}
        }
        await new Promise(resolve=>setTimeout(resolve,300));
      }
      return [];
    }finally{if(!current.isDestroyed())current.destroy();windows.delete(current);}
  }
  async function pump(){
    if(active>=2||closed)return;active++;
    while(!closed&&queue.length){const job=queue.shift();let result=[];try{result=await resolve(job.username);}catch{}pending.delete(job.username);job.done(result);}
    active--;
  }
  return {
    get(username){if(!valid(username)||closed)return Promise.resolve([]);if(pending.has(username))return pending.get(username);if(pending.size>=8)return Promise.resolve([]);let done;const promise=new Promise(resolve=>done=resolve);pending.set(username,promise);queue.push({username,done});void pump();return promise;},
    close(){closed=true;for(const window of windows)if(!window.isDestroyed())window.destroy();for(const job of queue){job.done([]);pending.delete(job.username);}queue.length=0;}
  };
}
module.exports={createDesktopPortraits};
