'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {createMediaStudio}=require('./media-studio.cjs');
const KEY='entry_videos_v1', GAME='entry-videos';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TRIGGERS=new Set(['entry','comment','gift','interaction']);
const SCOPES=new Set(['person','any-sender']);
const TYPES=new Set(['member','chat','gift','follow','like','share','subscribe']);
const MAX_PENDING=256;
const cleanChannel=value=>String(value||'varsayilan').replace(/^@/,'').trim().toLocaleLowerCase('tr-TR').replace(/[^a-z0-9._-]/g,'_').slice(0,128)||'varsayilan';
function username(value){
    if(typeof value!=='string')throw new Error('TikTok kullanıcı adını yazın.');
    const result=value.trim().replace(/^@/,'').toLowerCase();
    if(!/^[a-z0-9._]{1,64}$/.test(result))throw new Error('Kullanıcı adı yalnızca harf, rakam, nokta ve alt çizgi içerebilir.');
    return result;
}
function giftId(value){
    if(value===undefined||value===null||value==='')return '';
    if(!['string','number','bigint'].includes(typeof value)||(typeof value==='number'&&!Number.isSafeInteger(value)))throw new Error('Geçerli bir hediye seçin.');
    const result=String(value).trim();
    if(!/^\d{1,20}$/.test(result)||BigInt(result)<=0n)throw new Error('Geçerli bir hediye seçin.');
    return BigInt(result).toString();
}
const everyMatch=rule=>!rule.oncePerLive&&rule.cooldownSeconds===0;
const anySenderGift=rule=>rule?.scope==='any-sender'&&rule.trigger==='gift';
const eventReceipt=(room,type,id)=>crypto.createHash('sha256').update(JSON.stringify([room,type,id])).digest('hex');
function ruleSettings(input,previous={}){
    const scope=input.scope??previous.scope??'person';
    if(!SCOPES.has(scope))throw new Error('Geçerli bir kişi kapsamı seçin.');
    const result={...previous,scope,username:scope==='any-sender'?'':username(input.username??previous.username),trigger:input.trigger??previous.trigger??'entry'};
    if(!TRIGGERS.has(result.trigger))throw new Error('Geçerli bir tetikleme koşulu seçin.');
    result.giftId=giftId(input.giftId??previous.giftId??'');
    if(result.trigger==='gift'&&!result.giftId)throw new Error('Bu video için tetikleyici hediyeyi seçin.');
    result.oncePerLive=input.oncePerLive??previous.oncePerLive??false;
    if(typeof result.oncePerLive!=='boolean')throw new Error('Tekrar ayarı geçersiz.');
    result.cooldownSeconds=input.cooldownSeconds??previous.cooldownSeconds??600;
    if(typeof result.cooldownSeconds!=='number'||!Number.isFinite(result.cooldownSeconds)||result.cooldownSeconds<0||result.cooldownSeconds>86400)throw new Error('Tekrar aralığı 0–86400 saniye olmalı.');
    if(anySenderGift(result)){result.oncePerLive=false;result.cooldownSeconds=0;}
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
    if(data.version<2){data={...data,version:2,sessions:Object.fromEntries(Object.entries(data.sessions).map(([name,session])=>[name,{...session,played:{},lastPlayed:{},receipts:{},giftReceipts:{},pending:{},errors:{}}]))};store.set(KEY,data);}
    let paused=false,studio;
    const testPending=new Map(),manualPending=new Map(),manualErrors=new Map();
    const channel=()=>cleanChannel(getChannel());
    const persist=next=>{store.set(KEY,next);data=next;};
    const mediaStore={get:(_key,fallback)=>structuredClone(data.media||fallback),set:(_key,value)=>{
        const next={...data,media:value};if(paused)data=next;else persist(next);
    }};
    const makeStudio=()=>createMediaStudio({store:mediaStore,root,accessKey,getChannel,getActiveGame:()=>GAME,
        delivery:{pending:pendingEvents,acknowledge},onEvent:event=>{if(event.test){testPending.set(event.id,event);if(testPending.size>256)testPending.delete(testPending.keys().next().value);}if(event.trigger?.type==='manual')manualPending.set(event.id,event);onEvent?.(event);}});
    studio=makeStudio();
    function transaction(work){
        const before=structuredClone(data);paused=true;
        try{const result=work();store.set(KEY,data);paused=false;return result;}
        catch(error){data=before;paused=false;studio.close();studio=makeStudio();throw error;}
    }
    const find=id=>data.rules.find(row=>row.id===id&&row.channel===channel());
    // Accepted unrestricted gifts wait for playback, even behind a long video queue.
    const retainDelivery=(event,now)=>anySenderGift(find(event.item.id))||event.createdAt>=now-300000;
    const currentSession=()=>Object.hasOwn(data.sessions,channel())?data.sessions[channel()]:null;
    function list(){
        const media=new Map(studio.list().map(item=>[item.id,item]));
        const session=currentSession();
        return data.rules.filter(row=>row.channel===channel()&&media.has(row.id)).map(row=>({...media.get(row.id),...row,playedThisLive:Boolean(session?.played?.[row.id]),nextEligibleAt:row.oncePerLive||!row.cooldownSeconds?null:(session?.lastPlayed?.[row.id]?session.lastPlayed[row.id]+row.cooldownSeconds*1000:null),
            pendingThisLive:Object.values(session?.pending||{}).some(event=>event.item.id===row.id&&!event.failed&&retainDelivery(event,Date.now())),
            manualPending:[...manualPending.values()].some(event=>event.channel===channel()&&event.item.id===row.id&&event.createdAt>Date.now()-300000),
            playbackError:manualErrors.get(row.id)||session?.errors?.[row.id]||''}));
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
                title:input.title?.trim()||item?.title||(settings.scope==='any-sender'?'Herkes için giriş videosu':'@'+settings.username+' giriş videosu'),category:'Özel Giriş Videoları',gameId:GAME,
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
        for(const [eventId,event]of manualPending)if(event.item.id===id)manualPending.delete(eventId);
        for(const [eventId,event]of testPending)if(event.item.id===id)testPending.delete(eventId);
        manualErrors.delete(id);
        const session=currentSession();if(!session)return;
        session.pending=Object.fromEntries(Object.entries(session.pending||{}).filter(([,event])=>event.item.id!==id));
        if(session.errors)delete session.errors[id];
    }
    function pendingEvents({channel:account,gameId,itemId,preview}){
        if(gameId!==GAME||account!==channel())return [];
        const now=Date.now(),cutoff=now-300000,session=currentSession(),enabled=new Set(studio.list().filter(item=>item.enabled).map(item=>item.id));
        for(const [id,event]of testPending)if(event.createdAt<cutoff)testPending.delete(id);
        for(const [id,event]of manualPending)if(event.createdAt<cutoff)manualPending.delete(id);
        return [...(preview?[]:[...Object.values(session?.pending||{}),...manualPending.values()]),...testPending.values()]
            .filter(event=>event.channel===account&&retainDelivery(event,now)&&enabled.has(event.item.id)&&(!itemId||event.item.id===itemId))
            .sort((a,b)=>a.createdAt-b.createdAt).slice(0,64);
    }
    function acknowledge({channel:account,gameId,itemId,id,state,reason}){
        if(gameId!==GAME||account!==channel())return;
        const manual=manualPending.get(id);
        if(manual){
            if(manual.channel!==account||(itemId&&manual.item.id!==itemId))return;
            manualPending.delete(id);
            if(state==='started')manualErrors.delete(manual.item.id);else manualErrors.set(manual.item.id,reason||'network');
            onEvent?.({type:'entry:playback',state,manual:true});return;
        }
        const test=testPending.get(id);
        if(test){if(test.channel===account&&(!itemId||test.item.id===itemId))testPending.delete(id);return;}
        const session=currentSession(),event=session?.pending?.[id];
        if(!event||event.channel!==account||(itemId&&event.item.id!==itemId))return;
        const next=structuredClone(session);next.errors||={};next.played||={};next.lastPlayed||={};
        if(state==='started'){
            // A receipt belongs to one delivery, even when the same video is queued again.
            delete next.pending[id];
            if(anySenderGift(find(event.item.id))&&event.trigger?.eventId){next.giftReceipts||={};next.giftReceipts[eventReceipt(next.roomId,event.trigger.type,event.trigger.eventId)]=Date.now();}
            next.played[event.item.id]=Date.now();next.lastPlayed[event.item.id]=Date.now();delete next.errors[event.item.id];
        }else{next.errors[event.item.id]=reason||'network';next.pending[id].failed=true;}
        persist({...data,sessions:{...data.sessions,[account]:next}});onEvent?.({type:'entry:playback',state});
    }
    function reset(id){
        if(!find(id))throw new Error('Video bulunamadı.');
        return transaction(()=>{clearPending(id);const session=currentSession();if(session){delete session.played?.[id];delete session.lastPlayed?.[id];}return true;});
    }
    function play(id){
        if(!find(id))throw new Error('Video bulunamadı.');
        const item=list().find(row=>row.id===id);
        if(!item?.enabled)throw new Error('Oynatmak için videoyu etkinleştirin.');
        if(item.manualPending)throw new Error('Bu video yayın kaynağında oynatılmayı bekliyor.');
        for(const [key,event]of manualPending)if(event.createdAt<Date.now()-300000)manualPending.delete(key);
        if(manualPending.size>=64)throw new Error('Video kuyruğu dolu; oynatmaların bitmesini bekleyin.');
        manualErrors.delete(id);
        // Manual plays never consume automatic entry receipts or cooldowns.
        return studio.play(id);
    }
    function beginSession(account,room){
        const name=cleanChannel(account),roomId=String(room||'');
        if(!/^\d{1,32}$/.test(roomId)||!/[1-9]/.test(roomId))return false;
        const previous=Object.hasOwn(data.sessions,name)?data.sessions[name]:null;
        if(previous?.roomId===roomId)return false;
        persist({...data,sessions:{...data.sessions,[name]:{roomId,played:{},receipts:{},giftReceipts:{},lastPlayed:{},pending:{},errors:{}}}});
        return true;
    }
    function ingest(type,payload={},account=channel()){
        type=String(type||'').trim().toLowerCase();
        if(type==='entry')type='member';else if(type==='comment')type='chat';
        if(!TYPES.has(type)||!payload||typeof payload!=='object'||Array.isArray(payload)||cleanChannel(account)!==channel())return [];
        let who='';try{who=username(payload.username||payload.uniqueId||payload.user?.uniqueId||payload.user?.username||payload.displayId||payload.user?.displayId||'');}catch{ /* Unfiltered rules do not require a public username. */ }
        const rawRoom=payload.roomId??payload.room_id??payload.common?.roomId;
        if(rawRoom&&currentSession()?.roomId&&String(rawRoom)!==currentSession().roomId)return [];
        if(rawRoom&&!currentSession()?.roomId)beginSession(account,rawRoom);
        const session=currentSession();
        if(!session?.roomId)return [];
        const giftData=payload.gift||payload.extendedGiftInfo||payload.giftDetails||{};
        let gift='';try{if(type==='gift')gift=giftId(payload.giftId??payload.gift_id??giftData.id??giftData.giftId);}catch{return [];}
        if(type==='gift'&&!gift)return [];
        const giftType=payload.giftType??giftData.giftType??giftData.type;
        const streak=Number(giftType)===1||(giftType===undefined&&Object.hasOwn(payload,'repeatEnd'));
        if(type==='gift'&&streak&&![true,1,'1','true'].includes(payload.repeatEnd))return [];
        const message=String(payload.message??payload.comment??payload.content??'').trim();
        if(type==='chat'&&!message)return [];
        const eventId=String(payload.eventId||payload.msgId||payload.common?.msgId||payload.logId||payload.id||'').slice(0,256);
        const now=Date.now(),receipt=eventReceipt(session.roomId,type,eventId||[who||String(payload.userId??payload.user?.id??''),gift,message,Math.floor(now/2500)]);
        if(Object.hasOwn(session.receipts||{},receipt)||Object.hasOwn(session.giftReceipts||{},receipt))return [];
        const enabled=new Map(studio.list().map(item=>[item.id,item.enabled]));
        const pending=Object.fromEntries(Object.entries(session.pending||{}).filter(([,event])=>!event.failed&&retainDelivery(event,now)));
        if(eventId&&Object.values(pending).some(event=>event.trigger?.type===type&&event.trigger?.eventId===eventId))return [];
        const rules=data.rules.filter(rule=>rule.channel===channel()&&(rule.scope==='any-sender'||rule.username===who)&&enabled.get(rule.id)&&
            (rule.trigger==='entry'?type==='member':rule.trigger==='comment'?type==='chat':rule.trigger==='gift'?type==='gift'&&rule.giftId===gift:type!=='member')&&
            (!rule.oncePerLive||!Object.hasOwn(session.played||{},rule.id))&&
            (everyMatch(rule)||!Object.values(pending).some(event=>event.item.id===rule.id))&&
            (rule.oncePerLive||now-(session.lastPlayed?.[rule.id]||0)>=rule.cooldownSeconds*1000));
        if(!rules.length)return [];
        // Bound repeatable live traffic without dispatching or consuming overflow receipts.
        if(Object.keys(pending).length+rules.length>MAX_PENDING)throw new Error('Video kuyruğu dolu; oynatmaların bitmesini bekleyin.');
        const next=structuredClone(session);next.receipts||={};next.pending||={};next.errors||={};
        next.receipts[receipt]=now;
        // Unrestricted gifts remain idempotent for the whole room, beyond the recent-history cap.
        if(rules.some(anySenderGift)){next.giftReceipts||={};next.giftReceipts[receipt]=now;}
        const events=rules.map(rule=>studio.dispatch(rule.id,{type,eventId,giftId:type==='gift'?gift:''})).filter(Boolean);
        next.pending=pending;
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
    return {list,save,remove,reset,play,importAsset,ingest,beginSession,ownsRequest,
        test:id=>{if(!find(id))throw new Error('Video bulunamadı.');return studio.test(id);},
        status:()=>({...studio.status(GAME),configured:list().filter(row=>row.enabled).length,roomVerified:Boolean(currentSession()?.roomId),roomId:currentSession()?.roomId||'',played:list().filter(row=>row.playedThisLive).length}),
        handleRequest:(...args)=>studio.handleRequest(...args),close:()=>studio.close()};
}
module.exports={createEntryVideos,username,ruleSettings,GAME};
