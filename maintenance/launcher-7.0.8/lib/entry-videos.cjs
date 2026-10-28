'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {createMediaStudio}=require('./media-studio.cjs');
const KEY='entry_videos_v1', GAME='entry-videos';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TRIGGERS=new Set(['entry','comment','gift','interaction']);
const TYPES=new Set(['member','chat','gift','follow','like','share','subscribe']);
const cleanChannel=value=>String(value||'varsayilan').replace(/^@/,'').trim().toLocaleLowerCase('tr-TR').replace(/[^a-z0-9._-]/g,'_').slice(0,128)||'varsayilan';
function username(value){
    if(typeof value!=='string')throw new Error('TikTok kullanıcı adını yazın.');
    const result=value.trim().replace(/^@/,'').toLowerCase();
    if(!/^[a-z0-9._]{1,64}$/.test(result))throw new Error('Kullanıcı adı yalnızca harf, rakam, nokta ve alt çizgi içerebilir.');
    return result;
}
function ruleSettings(input,previous={}){
    const result={...previous,username:username(input.username??previous.username),trigger:input.trigger??previous.trigger??'entry'};
    if(!TRIGGERS.has(result.trigger))throw new Error('Geçerli bir tetikleme koşulu seçin.');
    result.giftId=String(input.giftId??previous.giftId??'').trim();
    if(result.giftId&&!/^\d{1,20}$/.test(result.giftId))throw new Error('Geçerli bir hediye seçin.');
    if(result.trigger==='gift'&&!result.giftId)throw new Error('Bu video için tetikleyici hediyeyi seçin.');
    result.oncePerLive=input.oncePerLive??previous.oncePerLive??true;
    if(typeof result.oncePerLive!=='boolean')throw new Error('Tekrar ayarı geçersiz.');
    if(result.trigger==='entry')result.oncePerLive=true;
    result.cooldownSeconds=input.cooldownSeconds??previous.cooldownSeconds??30;
    if(typeof result.cooldownSeconds!=='number'||!Number.isFinite(result.cooldownSeconds)||result.cooldownSeconds<0||result.cooldownSeconds>86400)throw new Error('Tekrar aralığı 0–86400 saniye olmalı.');
    return result;
}
function createEntryVideos({store,root,accessKey,getChannel=()=> 'varsayilan',onEvent}={}){
    const stored=store.get(KEY,{});
    let data={version:2,rules:[],sessions:{},media:{version:1,items:[]},...stored};
    if(!Array.isArray(data.rules))data.rules=[];
    if(!data.sessions||typeof data.sessions!=='object'||Array.isArray(data.sessions))data.sessions={};
    data.rules=data.rules.flatMap(row=>{
        try{if(!UUID.test(row?.id))return [];return [{...ruleSettings(row.trigger==='follow'?{...row,trigger:'entry'}:row),id:row.id,channel:cleanChannel(row.channel)}];}catch{return [];}
    });
    // The first preview recorded dispatches as plays without a browser acknowledgement.
    if(data.version<2){data={...data,version:2,sessions:Object.fromEntries(Object.entries(data.sessions).map(([name,session])=>[name,{...session,played:{},lastPlayed:{},receipts:{},pending:{},errors:{}}]))};store.set(KEY,data);}
    let paused=false,studio;
    const testPending=new Map();
    const channel=()=>cleanChannel(getChannel());
    const persist=next=>{store.set(KEY,next);data=next;};
    const mediaStore={get:(_key,fallback)=>structuredClone(data.media||fallback),set:(_key,value)=>{
        const next={...data,media:value};if(paused)data=next;else persist(next);
    }};
    const makeStudio=()=>createMediaStudio({store:mediaStore,root,accessKey,getChannel,getActiveGame:()=>GAME,
        delivery:{pending:pendingEvents,acknowledge},onEvent:event=>{if(event.test){testPending.set(event.id,event);if(testPending.size>256)testPending.delete(testPending.keys().next().value);}onEvent?.(event);}});
    studio=makeStudio();
    function transaction(work){
        const before=structuredClone(data);paused=true;
        try{const result=work();store.set(KEY,data);paused=false;return result;}
        catch(error){data=before;paused=false;studio.close();studio=makeStudio();throw error;}
    }
    const find=id=>data.rules.find(row=>row.id===id&&row.channel===channel());
    const currentSession=()=>Object.hasOwn(data.sessions,channel())?data.sessions[channel()]:null;
    function list(){
        const media=new Map(studio.list().map(item=>[item.id,item]));
        const session=currentSession();
        return data.rules.filter(row=>row.channel===channel()&&media.has(row.id)).map(row=>({...media.get(row.id),...row,playedThisLive:Boolean(session?.played?.[row.id]),
            pendingThisLive:Object.values(session?.pending||{}).some(event=>event.item.id===row.id&&!event.failed&&event.createdAt>Date.now()-300000),playbackError:session?.errors?.[row.id]||''}));
    }
    async function importAsset(source){
        if(typeof source!=='string'||!path.isAbsolute(source)||!['.mp4','.webm'].includes(path.extname(source).toLowerCase()))throw new Error('MP4 veya WebM video seçin.');
        const stat=await fs.promises.stat(source);
        if(!stat.isFile()||stat.size>512*1024*1024)throw new Error('Video dosyası en fazla 512 MB olabilir.');
        const selectedChannel=channel();
        const [asset]=await studio.importFiles([source],[],{assetsOnly:true});
        if(channel()!==selectedChannel)throw new Error('Yayın hesabı değişti; videoyu yeniden seçin.');
        return studio.listAssets().find(item=>item.id===asset.id);
    }
    function save(input){
        if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Video ayarları gerekli.');
        const previous=input.id?find(input.id):null;
        if(input.id&&!previous)throw new Error('Video bulunamadı.');
        const settings=ruleSettings(input,previous||{});
        if(input.title!==undefined&&(typeof input.title!=='string'||input.title.trim().length>160))throw new Error('Video adı en fazla 160 karakter olabilir.');
        if(input.url!==undefined&&input.url!==''&&!/^https:\/\//i.test(input.url))throw new Error('Güvenli HTTPS video bağlantısı gerekli.');
        const asset=input.assetId?studio.listAssets().find(item=>item.id===input.assetId&&item.kind==='video'):null;
        if(input.assetId&&!asset)throw new Error('Video dosyası bulunamadı.');
        if(!previous&&!asset&&!input.url)throw new Error('Bir video dosyası veya HTTPS bağlantısı seçin.');
        return transaction(()=>{
            let item=previous?studio.list().find(item=>item.id===previous.id):asset?studio.addAsset(asset.id,{gameId:GAME}):null;
            if(previous&&asset)item=studio.replaceAsset(previous.id,asset.id);
            item=studio.save({...(item?{id:item.id}:{}),...(input.url?{url:input.url,kind:'video'}:{}),
                title:input.title?.trim()||item?.title||'@'+settings.username+' giriş videosu',category:'Özel Giriş Videoları',gameId:GAME,
                volume:input.volume??item?.volume??.8,enabled:input.enabled??item?.enabled??true,fade:input.fade??item?.fade??true,
                trigger:'gift',giftId:'',cooldownSeconds:0,playLimit:0,combineGifts:false,interrupt:false});
            const rule={...settings,id:item.id,channel:channel()};
            data={...data,rules:previous?data.rules.map(row=>row.id===previous.id?rule:row):[...data.rules,rule]};
            if(previous)clearPending(previous.id);
            return {...item,...rule};
        });
    }
    function remove(id){
        if(!find(id))throw new Error('Video bulunamadı.');
        return transaction(()=>{studio.remove(id);clearPending(id);data={...data,rules:data.rules.filter(row=>row.id!==id)};return true;});
    }
    function clearPending(id){
        const session=currentSession();if(!session)return;
        session.pending=Object.fromEntries(Object.entries(session.pending||{}).filter(([,event])=>event.item.id!==id));
        if(session.errors)delete session.errors[id];
        for(const [eventId,event]of testPending)if(event.item.id===id)testPending.delete(eventId);
    }
    function pendingEvents({channel:account,gameId,itemId,preview}){
        if(gameId!==GAME||account!==channel())return [];
        const cutoff=Date.now()-300000,session=currentSession(),enabled=new Set(studio.list().filter(item=>item.enabled).map(item=>item.id));
        for(const [id,event]of testPending)if(event.createdAt<cutoff)testPending.delete(id);
        return [...(preview?[]:Object.values(session?.pending||{})),...testPending.values()]
            .filter(event=>event.channel===account&&event.createdAt>=cutoff&&enabled.has(event.item.id)&&(!itemId||event.item.id===itemId))
            .sort((a,b)=>a.createdAt-b.createdAt).slice(0,64);
    }
    function acknowledge({channel:account,gameId,itemId,id,state,reason}){
        if(gameId!==GAME||account!==channel())return;
        const test=testPending.get(id);
        if(test){if(test.channel===account&&(!itemId||test.item.id===itemId))testPending.delete(id);return;}
        const session=currentSession(),event=session?.pending?.[id];
        if(!event||event.channel!==account||(itemId&&event.item.id!==itemId))return;
        const next=structuredClone(session);next.errors||={};next.played||={};next.lastPlayed||={};
        if(state==='started'){
            next.pending=Object.fromEntries(Object.entries(next.pending).filter(([,queued])=>queued.item.id!==event.item.id));
            next.played[event.item.id]=Date.now();next.lastPlayed[event.item.id]=Date.now();delete next.errors[event.item.id];
        }else{next.errors[event.item.id]=reason||'network';next.pending[id].failed=true;}
        persist({...data,sessions:{...data.sessions,[account]:next}});onEvent?.({type:'entry:playback',state});
    }
    function reset(id){
        if(!find(id))throw new Error('Video bulunamadı.');
        return transaction(()=>{clearPending(id);const session=currentSession();if(session){delete session.played?.[id];delete session.lastPlayed?.[id];}return true;});
    }
    function beginSession(account,room){
        const name=cleanChannel(account),roomId=String(room||'');
        if(!/^\d{1,32}$/.test(roomId)||!/[1-9]/.test(roomId))return false;
        const previous=Object.hasOwn(data.sessions,name)?data.sessions[name]:null;
        if(previous?.roomId===roomId)return false;
        persist({...data,sessions:{...data.sessions,[name]:{roomId,played:{},receipts:{},lastPlayed:{},pending:{},errors:{}}}});
        return true;
    }
    function ingest(type,payload={},account=channel()){
        if(!TYPES.has(type)||!payload||typeof payload!=='object'||cleanChannel(account)!==channel())return [];
        let who;try{who=username(payload.username||payload.uniqueId||payload.user?.uniqueId||'');}catch{return [];}
        const rawRoom=payload.roomId??payload.room_id??payload.common?.roomId;
        if(rawRoom&&currentSession()?.roomId&&String(rawRoom)!==currentSession().roomId)return [];
        if(rawRoom&&!currentSession()?.roomId)beginSession(account,rawRoom);
        const session=currentSession();
        if(!session?.roomId)return [];
        const gift=String(payload.giftId??payload.gift?.id??payload.extendedGiftInfo?.id??'');
        if(type==='gift'&&!/^\d{1,20}$/.test(gift))return [];
        const giftType=payload.giftType??payload.gift?.type??payload.extendedGiftInfo?.giftType;
        if(type==='gift'&&Number(giftType)===1&&![true,1,'1','true'].includes(payload.repeatEnd))return [];
        if(type==='chat'&&!String(payload.message??payload.comment??payload.content??'').trim())return [];
        const eventId=String(payload.eventId||payload.msgId||payload.common?.msgId||payload.logId||payload.id||'').slice(0,256);
        const now=Date.now(),receipt=crypto.createHash('sha256').update(JSON.stringify([session.roomId,type,eventId||[who,gift,payload.message||'',Math.floor(now/2500)]])).digest('hex');
        if(Object.hasOwn(session.receipts||{},receipt))return [];
        const enabled=new Map(studio.list().map(item=>[item.id,item.enabled]));
        const rules=data.rules.filter(rule=>rule.channel===channel()&&rule.username===who&&enabled.get(rule.id)&&
            (rule.trigger==='entry'?type==='member':rule.trigger==='comment'?type==='chat':rule.trigger==='gift'?type==='gift'&&rule.giftId===gift:type!=='member')&&
            (!rule.oncePerLive||!Object.hasOwn(session.played||{},rule.id))&&
            !Object.values(session.pending||{}).some(event=>event.item.id===rule.id&&!event.failed&&event.createdAt>now-300000)&&
            (rule.oncePerLive||now-(session.lastPlayed?.[rule.id]||0)>=rule.cooldownSeconds*1000));
        if(!rules.length)return [];
        const next=structuredClone(session);next.receipts||={};next.pending||={};next.errors||={};
        next.receipts[receipt]=now;
        const events=rules.map(rule=>studio.dispatch(rule.id,{type,eventId,giftId:type==='gift'?gift:''})).filter(Boolean);
        next.pending=Object.fromEntries(Object.entries(next.pending).filter(([,event])=>!event.failed&&event.createdAt>now-300000));
        for(const event of events){next.pending[event.id]=event;delete next.errors[event.item.id];}
        const receipts=Object.entries(next.receipts).sort((a,b)=>b[1]-a[1]).slice(0,4096);next.receipts=Object.fromEntries(receipts);
        persist({...data,sessions:{...data.sessions,[channel()]:next}});
        return events;
    }
    function ownsRequest(url){
        if(url.searchParams.get('game')===GAME)return true;
        const match=/^\/tikmng\/media\/(?:file\/|library\/file\/|library\/)?([0-9a-f-]{36})$/.exec(url.pathname);
        if(!match)return false;
        const media=data.media||{};
        return [...(media.items||[]),...(media.assetLibrary||[])].some(row=>row.id===match[1]);
    }
    return {list,save,remove,reset,importAsset,ingest,beginSession,ownsRequest,
        test:id=>{if(!find(id))throw new Error('Video bulunamadı.');return studio.test(id);},
        status:()=>({...studio.status(GAME),configured:list().filter(row=>row.enabled).length,roomVerified:Boolean(currentSession()?.roomId),roomId:currentSession()?.roomId||'',played:list().filter(row=>row.playedThisLive).length}),
        handleRequest:(...args)=>studio.handleRequest(...args),close:()=>studio.close()};
}
module.exports={createEntryVideos,username,ruleSettings,GAME};
