'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
async function launchProfileContest({directory,dataDirectory,session,BrowserWindow,portraitSession,createConnection,createOverlay,username='',onWindow=()=>{}}){
    const hostFactory=require(path.join(directory,'host.cjs')).createHost;
    const portraits=require('./portrait-engine.cjs').createDesktopPortraits({BrowserWindow,session:portraitSession});
    let host;
    try{
        host=await hostFactory({port:44150,record:false,dataDir:dataDirectory,createConnection,createOverlay,profileSources:{render:name=>portraits.get(name)}});
        session.disposers.add(async()=>{portraits.close();await host.close();});
        const base=await host.listen();fs.mkdirSync(dataDirectory,{recursive:true});const pointer=path.join(dataDirectory,'launcher-room.json');let room;
        try{room=JSON.parse(fs.readFileSync(pointer,'utf8')).id;}catch{}
        if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(room||'')){room=crypto.randomUUID();fs.writeFileSync(pointer,JSON.stringify({id:room}));}
        const win=new BrowserWindow({width:1440,height:990,minWidth:940,minHeight:700,title:'TikMnG · Profil Yarışması',show:false,autoHideMenuBar:true,backgroundColor:'#f4f6f9',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,autoplayPolicy:'no-user-gesture-required'}});
        onWindow(win);session.window=win;
        win.webContents.setWindowOpenHandler(({url})=>{try{const u=new URL(url);if(u.origin===base||u.protocol==='https:'&&u.hostname==='mng-license-server1.onrender.com')void require('electron').shell.openExternal(url);}catch{}return {action:'deny'};});
        win.webContents.on('will-navigate',(event,url)=>{try{if(new URL(url).origin!==base)event.preventDefault();}catch{event.preventDefault();}});
        win.once('closed',()=>{void session.close();});
        await win.loadURL(base+'/?room='+room+'&desktop=1');win.show();win.focus();session.markReady('Profil Yarışması hazır.');
        if(username)void host.getRoom(room).live.start(String(username).replace(/^@/,'').trim()).catch(()=>{});
        return {basarili:true};
    }catch(error){portraits.close();if(host)await host.close();throw error;}
}
module.exports={launchProfileContest};
