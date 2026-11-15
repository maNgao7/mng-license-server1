'use strict';
const path=require('node:path');
const {pathToFileURL}=require('node:url');
async function launchProfileDuel({directory,session,BrowserWindow,events,username,getProfile,getParticipants,getPortrait,getStatus,ensureLive,getGiftCatalog,getGiftImage,getGiftConfig,onGiftConfig,
 getBroadcastURL,onOverlay,getPortraitPath,onWindow=()=>{}}){
 const channel=String(username||'').replace(/^@/,'').trim().toLowerCase();
 const {createLauncherServer}=await import(pathToFileURL(path.join(directory,'src/server.mjs')).href);
 const host=await createLauncherServer({port:44181,channel,subscribeSharedEvents:events.subscribe,getCachedProfile:getProfile,getParticipants,getPortrait,getLiveStatus:getStatus,getGiftCatalog,getGiftImage,onGiftConfig,connectLive:ensureLive,autoSelectOwner:false,getBroadcastURL,
  giftConfig:getGiftConfig?.()||{roseGiftIds:['5655'],tiktokGiftIds:['5269'],roseGiftNames:['Rose','Gül'],tiktokGiftNames:['TikTok'],roseGiftImage:'./gifts/5655.png',tiktokGiftImage:'./gifts/5269.png'}});
 session.disposers.add(()=>host.close());
 if (onOverlay) {
    onOverlay(require('./profile-duel-overlay.cjs').createProfileDuelOverlay({directory, host, getPortraitPath}));
    session.disposers.add(() => onOverlay(null));
 }
 const win=new BrowserWindow({width:1152,height:760,resizable:true,minWidth:760,minHeight:650,title:'TikMnG · Teke Tek Profil',show:false,autoHideMenuBar:true,backgroundColor:'#0b1320',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 session.window=win;onWindow(win);
 win.webContents.setWindowOpenHandler(({url})=>{
    if(url===host.widgetUrl || getBroadcastURL && url===getBroadcastURL(host.getChannel())) void require('electron').shell.openExternal(url);
    return {action:'deny'};
 });
 win.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==host.baseUrl)event.preventDefault();});
 win.once('closed',()=>{void session.close();});
 await win.loadURL(host.controlUrl);win.show();session.markReady('Teke Tek Profil hazır.');
 if(channel)void Promise.resolve(ensureLive(channel)).catch(()=>{});
 return {basarili:true};
}
module.exports={launchProfileDuel};
