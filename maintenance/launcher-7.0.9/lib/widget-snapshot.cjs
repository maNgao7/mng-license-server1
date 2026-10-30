'use strict';
const compactTypes=new Set(['raconking','streambeauty','streamhandsome','raconlist','pk']);
function scopedWidgetSnapshot(state,type){
    if(!compactTypes.has(type))return state;
    const s=state.studio||{},key=type;
    return {channel:state.channel,studio:{settings:s.settings?.[key]?{[key]:s.settings[key]}:{},tests:s.tests?.[key]?{[key]:s.tests[key]}:{},session:s.session||null,resets:s.resets?.[key]?{[key]:s.resets[key]}:{},royalLeaders:s.royalLeaders?.[key]?{[key]:s.royalLeaders[key]}:{},...(type==='raconlist'?{raconRanking:(s.raconRanking||[]).slice(0,5)}:{}),...(type==='pk'?{pk:s.pk||null}:{})}};
}
module.exports={scopedWidgetSnapshot};
