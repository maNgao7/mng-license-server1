'use strict';
const compactTypes=new Set(['raconking','streambeauty','streamhandsome','raconlist','pk']);
function scopedLeaderboard(result,type,{items,preview=false}){
    const key=type==='topliker'?'topLikes':'topGifters',metric=type==='topliker'?'totalLikes':'totalCoins';
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
    const {audience,...rest}=state,withoutAudience=Object.hasOwn(state,'audience')?rest:state;
    if(type==='streambuddies'){
        const rows=Array.isArray(audience)?audience:[],count=Math.max(1,Math.min(150,Number(state.studio?.settings?.streambuddies?.items)||40));
        const offset=rows.length>count?Math.floor(Date.now()/20000)*count%rows.length:0;
        return {channel:state.channel,studio:{settings:{streambuddies:state.studio?.settings?.streambuddies||{}},tests:{streambuddies:state.studio?.tests?.streambuddies},session:state.studio?.session||null,resets:{streambuddies:state.studio?.resets?.streambuddies}},audience:rows.length>count?[...rows.slice(offset),...rows.slice(0,offset)].slice(0,count):rows,audienceTotal:rows.length,activities:(state.activities||[]).filter(row=>['chat','like'].includes(row.type)).slice(0,40)};
    }
    state=withoutAudience;
    if(!compactTypes.has(type)){
        const groups={topgift:['topGift'],topgifter:['topGifters'],topliker:['topLikes'],gifts:['activities'],coinjar:['activities','jarGifts','stats'],giftpusher:['activities','jarGifts','stats'],streamtimer:[],myactions:['activities'],wheel:['activities'],actionwheel:['activities'],firework:['activities'],coindrop:['activities'],likefountain:['activities'],penalty:['activities']};
        if(!Object.hasOwn(groups,type))return state;
        const source=state.studio||{},keys=type==='myactions'?['myactions:'+Math.max(1,Math.min(8,Math.floor(Number(screen)||1)))]:[type],pick=value=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));
        const result={channel:state.channel,studio:{settings:pick(source.settings),tests:pick(source.tests),resets:pick(source.resets),baselines:pick(source.baselines),session:source.session||null,...(type==='penalty'?{penaltyScores:source.penaltyScores||[]}:{}),...(type==='streamtimer'?{streamTimer:source.streamTimer}:{} )}};
        for(const key of groups[type])if(state[key]!==undefined)result[key]=state[key];
        if(type==='topliker'||type==='topgifter')scopedLeaderboard(result,type,{items,preview:preview===true||preview==='1'});
        if(!jarHistory&&['coinjar','giftpusher'].includes(type))delete result.jarGifts;
        if(Array.isArray(result.activities)&&Number.isFinite(after)&&after>0)result.activities=result.activities.filter(row=>Number(row.createdAt)>=after);
        return result;
    }
    const s=state.studio||{},key=type;
    const ranking=s.raconRanking||[],pageSize=Math.max(3,Math.min(20,Number(s.settings?.raconlist?.items)||8)),tail=ranking.slice(3),page=Math.floor(Date.now()/((Number(s.settings?.raconlist?.pageSeconds)||10)*1000)),offset=tail.length?page*Math.max(1,pageSize-3)%tail.length:0;
    const visible=ranking.length>pageSize?[...ranking.slice(0,3),...[...tail.slice(offset),...tail.slice(0,offset)].slice(0,pageSize-3)]:ranking;
    return {channel:state.channel,studio:{settings:s.settings?.[key]?{[key]:s.settings[key]}:{},tests:s.tests?.[key]?{[key]:s.tests[key]}:{},session:s.session||null,resets:s.resets?.[key]?{[key]:s.resets[key]}:{},royalLeaders:s.royalLeaders?.[key]?{[key]:s.royalLeaders[key]}:{},...(type==='raconlist'?{raconRanking:visible.map(row=>({...row,position:ranking.indexOf(row)+1})),raconTotal:ranking.length}:{}),...(type==='pk'?{pk:s.pk||null}:{})}};
}
module.exports={scopedWidgetSnapshot};
