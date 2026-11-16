'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
async function launchProfileContest({directory,dataDirectory,session,BrowserWindow,portraitSession,createConnection,createOverlay,username='',onWindow=()=>{}}){
    const hostFactory=require(path.join(directory,'host.cjs')).createHost;
    const portraits=require('./portrait-engine.cjs').createDesktopPortraits({BrowserWindow,session:portraitSession});
    let host,cleanup;
    const dispose=()=>cleanup ||= Promise.resolve().then(async()=>{portraits.close();if(host)await host.close();});
    try{
        host=await hostFactory({port:44150,record:false,dataDir:dataDirectory,createConnection,createOverlay,profileSources:{render:name=>portraits.get(name)}});
        session.disposers.add(dispose);
        if(session.closed)throw new Error('Profil Yarışması başlatma iptal edildi.');
        const base=await host.listen();fs.mkdirSync(dataDirectory,{recursive:true});const pointer=path.join(dataDirectory,'launcher-room.json');let room;
        try{room=JSON.parse(fs.readFileSync(pointer,'utf8')).id;}catch{}
        if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(room||'')){room=crypto.randomUUID();fs.writeFileSync(pointer,JSON.stringify({id:room}));}
        const win=new BrowserWindow({width:1152,height:800,minWidth:940,minHeight:700,resizable:true,title:'TikMnG · Profil Yarışması',show:false,autoHideMenuBar:true,backgroundColor:'#f4f6f9',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,autoplayPolicy:'no-user-gesture-required'}});
        onWindow(win);session.window=win;
        win.webContents.setWindowOpenHandler(({url})=>{try{const u=new URL(url);if(u.origin===base||u.protocol==='https:'&&u.hostname==='mng-license-server1.onrender.com')void require('electron').shell.openExternal(url);}catch{}return {action:'deny'};});
        win.webContents.on('will-navigate',(event,url)=>{try{if(new URL(url).origin!==base)event.preventDefault();}catch{event.preventDefault();}});
        win.once('closed',()=>{void session.close();});
        const crashed=(_event,details)=>{void session.close(new Error('Profil Yarışması görüntüsü kapandı: '+(details?.reason||'renderer hatası')));};
        const failed=(_event,code,description,_url,isMainFrame)=>{if(isMainFrame!==false)void session.close(new Error('Profil Yarışması yüklenemedi: '+description+' ('+code+').'));};
        const contents = win.webContents;
        contents.on('render-process-gone', crashed);
        contents.on('did-fail-load', failed);
        session.disposers.add(() => {
            if (contents.isDestroyed()) return;
            contents.removeListener('render-process-gone', crashed);
            contents.removeListener('did-fail-load', failed);
        });
        await session.stage('profile-contest-window','Profil Yarışması penceresi yükleniyor...',()=>win.loadURL(base+'/?room='+room+'&desktop=1'),30000);
        if(session.closed||win.isDestroyed())throw session.error||new Error('Profil Yarışması penceresi kapatıldı.');
        win.show();win.focus();session.markReady('Profil Yarışması hazır.');
        if(username){
            const warn=error=>{if(!session.closed)session.onProgress({oyun:session.game||'profile-contest',tip:'hesap-uyari',phase:'connection-error',mesaj:'Profil Yarışması yayın bağlantısı: '+error.message});};
            void Promise.resolve().then(()=>{if(!session.closed)return host.getRoom(room).live.start(String(username).replace(/^@/,'').trim());})
                .then(status=>{if(status&&status.status!=='connected')warn(new Error(status.message||'Yayın bağlantısı kurulamadı.'));},warn);
        }
        return {basarili:true};
    }catch(error){await dispose();throw error;}
}
module.exports={launchProfileContest};
