'use strict';
const compactTypes=new Set(['raconking','streambeauty','streamhandsome','raconlist','pk']);
function scopedWidgetSnapshot(state,type){
    const {audience,...rest}=state,withoutAudience=Object.hasOwn(state,'audience')?rest:state;
    if(type==='streambuddies'){
        const rows=Array.isArray(audience)?audience:[],count=Math.max(1,Math.min(150,Number(state.studio?.settings?.streambuddies?.items)||40));
        const offset=rows.length>count?Math.floor(Date.now()/20000)*count%rows.length:0;
        return {channel:state.channel,studio:{settings:{streambuddies:state.studio?.settings?.streambuddies||{}},tests:{streambuddies:state.studio?.tests?.streambuddies},session:state.studio?.session||null,resets:{streambuddies:state.studio?.resets?.streambuddies}},audience:rows.length>count?[...rows.slice(offset),...rows.slice(0,offset)].slice(0,count):rows,audienceTotal:rows.length,activities:(state.activities||[]).filter(row=>['chat','like'].includes(row.type)).slice(0,40)};
    }
    state=withoutAudience;
    if(!compactTypes.has(type))return state;
    const s=state.studio||{},key=type;
    return {channel:state.channel,studio:{settings:s.settings?.[key]?{[key]:s.settings[key]}:{},tests:s.tests?.[key]?{[key]:s.tests[key]}:{},session:s.session||null,resets:s.resets?.[key]?{[key]:s.resets[key]}:{},royalLeaders:s.royalLeaders?.[key]?{[key]:s.royalLeaders[key]}:{},...(type==='raconlist'?{raconRanking:(s.raconRanking||[]).slice(0,5)}:{}),...(type==='pk'?{pk:s.pk||null}:{})}};
}
module.exports={scopedWidgetSnapshot};
