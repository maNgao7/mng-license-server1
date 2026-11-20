'use strict';
const compactTypes=new Set(['raconking','streambeauty','streamhandsome','raconlist','pk']);
const definitions=require('./widget-studio.cjs').definitions;
const definitionById=new Map(definitions.map(item=>[item.id,item]));
const giftPhysicsTypes=new Set(['coinjar','giftpusher']);
function isGiftPhysicsWidget(type){
    return giftPhysicsTypes.has(definitionById.get(type)?.baseId||type);
}
const groups={topgift:['topGift'],topgifter:['topGifters'],topliker:['topLikes'],gifts:['activities'],coinjar:['activities','jarGifts','stats'],giftpusher:['activities','jarGifts','stats'],streamtimer:[],myactions:['activities'],wheel:['activities'],actionwheel:['activities'],firework:['activities'],coindrop:['activities'],likefountain:['activities'],penalty:['activities'],pkhub:[]};
for(const definition of definitions)if(definition.expansion||definition.scenePreset)groups[definition.id]=definition.stateKeys||groups[definition.baseId]||[];
function scopedLeaderboard(result,type,{items,preview=false,source}){
    const key=source||(type==='topliker'?'topLikes':'topGifters'),metric=key==='topLikes'?'totalLikes':'totalCoins';
    if(!Array.isArray(result[key]))return;
    // Older transports omit URL/draft overrides; only limit rows when their effective count is known.
    const baseline=result.studio.baselines[type],ranks=baseline?.ranks,count=items==null?Infinity:Number(items)||9;
    // Select by post-reset totals, but send original totals for the renderer to subtract once.
    const value=row=>ranks&&!preview?Math.max(0,Number(row[metric]||0)-Number(Object.hasOwn(ranks,row.username)?ranks[row.username]:0)):Number(row[metric]);
    const rows=result[key].map(row=>({row,value:value(row)})).filter(entry=>entry.value>0).sort((a,b)=>b.value-a.value);
    result[key]=(count<0?rows:rows.slice(0,count)).map(entry=>entry.row);
    if(ranks){
        // Test rows are added in the browser, so their baseline must survive the selection too.
        const names=new Set([...result[key].map(row=>row.username),'tikmng_test']);
        result.studio.baselines[type]={...baseline,ranks:Object.fromEntries([...names].filter(name=>Object.hasOwn(ranks,name)).map(name=>[name,ranks[name]]))};
    }
}
function scopedWidgetSnapshot(state,type,{after=0,jarHistory=true,screen='1',items,preview=false}={}){
    const definition=definitionById.get(type),base=definition?.baseId||type;
    const {audience,...rest}=state,withoutAudience=Object.hasOwn(state,'audience')?rest:state;
    if(type==='streambuddies'){
        const rows=Array.isArray(audience)?audience:[],count=Math.max(1,Math.min(150,Number(state.studio?.settings?.streambuddies?.items)||40));
        const offset=rows.length>count?Math.floor(Date.now()/20000)*count%rows.length:0;
        return {channel:state.channel,studio:{settings:{streambuddies:state.studio?.settings?.streambuddies||{}},tests:{streambuddies:state.studio?.tests?.streambuddies},session:state.studio?.session||null,resets:{streambuddies:state.studio?.resets?.streambuddies}},audience:rows.length>count?[...rows.slice(offset),...rows.slice(0,offset)].slice(0,count):rows,audienceTotal:rows.length,activities:(state.activities||[]).filter(row=>['chat','like'].includes(row.type)).slice(0,40)};
    }
    state=withoutAudience;
    if(!compactTypes.has(base)){
        if(!Object.hasOwn(groups,type))return state;
        const source=state.studio||{},keys=type==='myactions'?['myactions:'+Math.max(1,Math.min(8,Math.floor(Number(screen)||1)))]:[type],pick=value=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));
        const result={channel:state.channel,studio:{settings:pick(source.settings),tests:pick(source.tests),resets:pick(source.resets),baselines:pick(source.baselines),session:source.session||null,...(definition?.scenePreset?{aliases:{[base]:type}}:{}),...(type==='penalty'?{penaltyScores:source.penaltyScores||[]}:{}),...(type==='streamtimer'?{streamTimer:source.streamTimer}:{} )}};
        for(const key of groups[type])if(state[key]!==undefined)result[key]=state[key];
        if(base==='pkhub'){
            result.studio.pk=source.pk||null;
            result.studio.pkStage=source.pkStage||null;
        }
        if(type==='topliker'||type==='topgifter')scopedLeaderboard(result,type,{items,preview:preview===true||preview==='1'});
        if(['topLikes','topGifters'].includes(definition?.source))scopedLeaderboard(result,type,{items:12,source:definition.source,preview:preview===true||preview==='1'});
        if(isGiftPhysicsWidget(type)){
            result.activities=(result.activities||[]).filter(row=>row.type==='gift');
            if(!jarHistory)delete result.jarGifts;
            else if(!Array.isArray(result.jarGifts))result.jarGifts=[];
        }
        if(Array.isArray(result.activities)&&Number.isFinite(after)&&after>0)result.activities=result.activities.filter(row=>Number(row.createdAt)>=after);
        return result;
    }
    const s=state.studio||{},key=type;
    const pool=base==='raconlist'&&type!=='raconlist'?s.sceneRankings?.[type]||{}:s;
    const leader=(definition?.scenePreset?s.sceneRoyalLeaders:s.royalLeaders)?.[key];
    const ranking=pool.raconRanking||[],pageSize=Math.max(3,Math.min(20,Number(s.settings?.[key]?.items)||12)),tail=ranking.slice(3),page=Math.floor(Date.now()/((Number(s.settings?.[key]?.pageSeconds)||10)*1000)),offset=tail.length?page*Math.max(1,pageSize-3)%tail.length:0;
    const visible=ranking.length>pageSize?[...ranking.slice(0,3),...[...tail.slice(offset),...tail.slice(0,offset)].slice(0,pageSize-3)]:ranking;
    const battleId=s.pkStage?.battleId;
    const nativeMultiplier=base==='pk'&&s.pkStage?.status==='active'&&(!s.pkStage.endsAt||s.pkStage.endsAt>Date.now())?(s.pkStage?.effects||[]).filter(row=>row?.source==='native'&&row.official===true&&
        row.evidence==='native-task-settle'&&[2,3].includes(row.multiplier)&&Number.isSafeInteger(row.startsAt)&&row.startsAt<=Date.now()&&
        Number.isSafeInteger(row.expiresAt)&&row.expiresAt>Date.now()&&row.expiresAt>row.startsAt&&row.expiresAt-row.startsAt<=60000&&(!s.pkStage.endsAt||row.expiresAt<=s.pkStage.endsAt))
        .sort((a,b)=>b.startsAt-a.startsAt)[0]:null;
    return {channel:state.channel,studio:{settings:s.settings?.[key]?{[key]:s.settings[key]}:{},tests:s.tests?.[key]?{[key]:s.tests[key]}:{},session:s.session||null,resets:s.resets?.[key]?{[key]:s.resets[key]}:{},baselines:s.baselines?.[key]?{[key]:s.baselines[key]}:{},...(definition?.scenePreset?{aliases:{[base]:type}}:{}),royalLeaders:leader?{[key]:leader}:{},...(base==='raconlist'?{raconRanking:visible.map(row=>({...row,position:ranking.indexOf(row)+1})),raconTotal:ranking.length,raconRevision:pool.raconRevision||0}:{}),...(base==='pk'?{pk:s.pk||null,pkMultiplierNotice:nativeMultiplier?{id:nativeMultiplier.boostId,source:'native',official:true,battleId,evidence:nativeMultiplier.evidence,multiplier:nativeMultiplier.multiplier,occurredAt:nativeMultiplier.startsAt,expiresAt:nativeMultiplier.expiresAt}:null}:{})}};
}
module.exports={scopedWidgetSnapshot,isGiftPhysicsWidget};
