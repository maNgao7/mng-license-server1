'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const {scopedWidgetSnapshot}=require('../lib/widget-snapshot.cjs');
const renderer=fs.readFileSync(path.join(__dirname,'../renderer/widgets/reference-widgets.html'),'utf8');
const demo=renderer.slice(renderer.indexOf('function demoState() {'),renderer.indexOf('function demoEvent()'));
const prepareStart=renderer.indexOf('    let data=preview?'),prepare=renderer.slice(prepareStart,renderer.indexOf('    renderData(data);',prepareStart));
const rankStart=renderer.indexOf("    if (['topgifter','topliker'].includes(type)"),rank=renderer.slice(rankStart,renderer.indexOf("    if (type==='gifts')",rankStart));
assert.ok(demo&&prepare&&rank,'production ranking and test-event rendering were located');
const script=new vm.Script('(function(){\n'+demo+'\n'+prepare+'\n'+rank+'\n})()');
function rendered(live,type,{items,preview=false}={}){
    const context={live,type,slot:type,preview,config:{items:9,layout:'podium',...live.studio?.settings?.[type],...(items!==undefined?{items}:{})},signatures:{},giftURL:id=>'/widget/gift-assets/'+id+'.png',escape:value=>String(value??''),num:value=>Math.max(0,Number(value)||0).toLocaleString('tr-TR'),avatar:row=>JSON.stringify([row.username,row.avatar]),reconcileLeaderboard:html=>{context.html=html;}};
    script.runInNewContext(context);return context.html;
}
const keyFor=type=>type==='topliker'?'topLikes':'topGifters';
const metricFor=type=>type==='topliker'?'totalLikes':'totalCoins';
const person=(username,total)=>({username,nickname:'Viewer '+username,avatar:'https://example.invalid/original/'+username+'~1080x1080.jpeg?signature=original',avatarWidth:1080,totalCoins:total,totalLikes:total,giftCount:12,updatedAt:100});
function fixture(type,rows,config={},baseline){
    return {channel:'host',license:{active:true},[keyFor(type)]:rows,studio:{settings:{[type]:config},tests:{},resets:{[type]:200},baselines:baseline?{[type]:{totalCoins:123,ranks:baseline,revision:7}}:{},session:{roomId:'123',startedAt:50}}};
}
function equivalent(state,type,options={}){
    const saved=structuredClone(state),result=scopedWidgetSnapshot(state,type,{items:state.studio?.settings?.[type]?.items??9,...options});
    assert.equal(rendered(result,type,options),rendered(state,type,options),'production renderer output must stay identical');
    assert.deepEqual(state,saved,'snapshot must not mutate shared state');return result;
}

for(const type of ['topliker','topgifter']){
    test(type+' sends only configured positive rows, preserving complete original portraits and totals',()=>{
        const rows=[person('third',3),person('first',10),person('zero',0),person('second',8),person('negative',-5)];
        const state=fixture(type,rows,{items:2}),result=equivalent(state,type);
        assert.deepEqual(result[keyFor(type)], [rows[1],rows[3]]);
        assert.equal(result[keyFor(type)][0].avatarWidth,1080);
        assert.equal(result[keyFor(type)][0].avatar,rows[1].avatar);
        assert.equal(result[keyFor(type)][0][metricFor(type)],10);
    });
    test(type+' ranks after baseline subtraction, filters exhausted totals and preserves stable ties',()=>{
        const rows=[person('oldLeader',10000),person('tieFirst',70),person('tieSecond',90),person('newViewer',55),person('reset',40),person('rolledBack',30),person('badTotal','invalid')];
        const baseline={oldLeader:9999,tieFirst:'10',tieSecond:30,reset:40,rolledBack:50,badTotal:0,absent:12345};
        const state=fixture(type,rows,{items:3},baseline),result=equivalent(state,type);
        assert.deepEqual(result[keyFor(type)].map(row=>row.username),['tieFirst','tieSecond','newViewer']);
        assert.deepEqual(result.studio.baselines[type],{totalCoins:123,ranks:{tieFirst:'10',tieSecond:30},revision:7});
        assert.equal(result[keyFor(type)][0][metricFor(type)],70,'baseline subtraction is not serialized into raw totals');
    });
    test(type+' keeps prototype-like usernames as own baseline properties',()=>{
        const rows=[person('__proto__',110),person('constructor',60),person('toString',25),person('other',20)];
        const baseline=Object.fromEntries([['__proto__',100],['constructor',10],['not_visible',9000]]);
        const state=fixture(type,rows,{items:3},baseline),result=equivalent(state,type);
        assert.deepEqual(result[keyFor(type)].map(row=>row.username),['constructor','toString','other']);
        state.studio.settings[type].items=4;
        const expanded=equivalent(state,type);
        assert.equal(Object.hasOwn(expanded.studio.baselines[type].ranks,'__proto__'),true);
        assert.equal(expanded.studio.baselines[type].ranks.__proto__,100);
    });
    test(type+' recalculates on setting, baseline, reset and session changes',()=>{
        const rows=Array.from({length:13},(_,i)=>person('person'+i,100-i)),state=fixture(type,rows,{items:2});
        assert.equal(equivalent(state,type)[keyFor(type)].length,2);
        state.studio.settings[type].items=8;state.studio.settings[type].layout='list';
        assert.equal(equivalent(state,type)[keyFor(type)].length,8);
        state.studio.baselines[type]={ranks:Object.fromEntries(rows.map(row=>[row.username,row[metricFor(type)]]))};
        state.studio.resets[type]=300;
        assert.deepEqual(equivalent(state,type)[keyFor(type)],[]);
        rows.at(-1)[metricFor(type)]+=100;
        assert.deepEqual(equivalent(state,type)[keyFor(type)].map(row=>row.username),['person12']);
        state.studio.baselines={};state.studio.resets[type]=400;state.studio.session={roomId:'456',startedAt:400};
        assert.equal(equivalent(state,type)[keyFor(type)].length,8);
    });
    test(type+' preserves browser-injected test scores and a hidden test-user baseline',()=>{
        const state=fixture(type,[person('one',100),person('two',80),person('three',60)],{items:2},{tikmng_test:500,one:90,two:75,three:55,unrelated:10000});
        state.studio.tests[type]={events:[{id:'test-1',coins:800,count:800,createdAt:201}],expiresAt:10000};
        const result=equivalent(state,type);
        assert.equal(result.studio.baselines[type].ranks.tikmng_test,500);
        assert.equal(result.studio.baselines[type].ranks.unrelated,undefined);
        assert.deepEqual(result.studio.tests[type],state.studio.tests[type]);
        state.studio.tests[type].events[0].coins=400;state.studio.tests[type].events[0].count=400;
        equivalent(state,type);
    });
    test(type+' supports default, legacy item overrides, fractional and negative slice semantics',()=>{
        const state=fixture(type,Array.from({length:13},(_,i)=>person('person'+i,100-i)),{items:2});
        assert.equal(equivalent(state,type,{items:12})[keyFor(type)].length,12);
        for(const items of [undefined,'3',0,'0','invalid',1.8,0.5,-1,-3,Infinity,-Infinity]){
            state.studio.settings[type].items=items;
            equivalent(state,type);
        }
        state.studio.settings[type]={};
        assert.equal(equivalent(state,type)[keyFor(type)].length,9);
    });
    test(type+' preview ignores live reset baselines and keeps demonstration rendering',()=>{
        const rows=[person('oldLeader',1000),person('newLeader',50)];
        const state=fixture(type,rows,{items:1},{oldLeader:1000,newLeader:0,deniz:999999});
        assert.equal(equivalent(state,type)[keyFor(type)][0].username,'newLeader');
        assert.equal(equivalent(state,type,{preview:true})[keyFor(type)][0].username,'oldLeader');
        assert.deepEqual(scopedWidgetSnapshot(state,type,{preview:'1'})[keyFor(type)],scopedWidgetSnapshot(state,type,{preview:true})[keyFor(type)]);
        assert.deepEqual(scopedWidgetSnapshot(state,type,{preview:'0'})[keyFor(type)],scopedWidgetSnapshot(state,type)[keyFor(type)]);
    });
    test(type+' keeps legacy item overrides intact when the transport has not forwarded their count',()=>{
        const rows=Array.from({length:13},(_,i)=>person('person'+i,100-i));
        const baseline=Object.fromEntries([...rows.map(row=>[row.username,10]),['absent',100000]]);
        const state=fixture(type,rows,{items:2},baseline),result=scopedWidgetSnapshot(state,type);
        assert.equal(result[keyFor(type)].length,13,'legacy transport cannot infer the effective count from saved settings');
        for(const items of [1,9,12,13,-1])assert.equal(rendered(result,type,{items}),rendered(state,type,{items}));
        assert.equal(result.studio.baselines[type].ranks.absent,undefined,'baseline compaction still applies');
    });
}

test('unknown and unscoped responses keep their existing shape and licensing fields',()=>{
    const state={channel:'host',license:{active:true},topLikes:[person('one',10)],studio:{settings:{topliker:{items:1}},baselines:{topliker:{ranks:{one:1,other:2}}}}};
    for(const type of [undefined,null,'unknown','constructor','__proto__'])assert.strictEqual(scopedWidgetSnapshot(state,type),state);
    const withAudience={...state,audience:[person('audience',1)]},expected={...withAudience};delete expected.audience;
    assert.deepEqual(scopedWidgetSnapshot(withAudience,'unknown'),expected,'existing unscoped audience omission is preserved');
});

test('all event widgets preserve complete streams, including equal-timestamp gifts and like thresholds',()=>{
    const activities=Array.from({length:120},(_,i)=>({id:'event-'+i,type:i%2?'gift':'like',createdAt:100+i%3,count:101,coins:12,likeAlerts:{1:100,8:100},avatar:person('one',1).avatar}));
    const state={channel:'host',activities,jarGifts:activities.filter(row=>row.type==='gift'),stats:{totalCoins:720},studio:{settings:{},baselines:{},tests:{}}};
    for(const type of ['myactions','wheel','actionwheel','firework','coindrop','likefountain','penalty','coinjar','giftpusher','gifts']){
        assert.deepEqual(scopedWidgetSnapshot(state,type).activities,activities,type+' history must not be shortened');
        assert.deepEqual(scopedWidgetSnapshot(state,type,{after:101}).activities,activities.filter(row=>row.createdAt>=101),type+' equal-timestamp events must survive');
    }
    for(const type of ['coinjar','giftpusher'])assert.deepEqual(scopedWidgetSnapshot(state,type).jarGifts,state.jarGifts);
});

test('representative 13-row responses shrink before and after gzip, including a large reset baseline',t=>{
    for(const type of ['topliker','topgifter'])for(const baselineCount of [0,10000]){
        const rows=Array.from({length:13},(_,i)=>person('viewer_'+String(i).padStart(5,'0'),50000-i*10));
        const baseline=baselineCount?Object.fromEntries(Array.from({length:baselineCount},(_,i)=>['viewer_'+String(i).padStart(5,'0'),40000+i])):undefined;
        const state=fixture(type,rows,{items:9},baseline),key=keyFor(type);
        const before={channel:state.channel,studio:state.studio,[key]:state[key]},after=equivalent(state,type);
        const sizes=value=>{const data=Buffer.from(JSON.stringify(value));return {json:data.length,gzip:zlib.gzipSync(data).length};};
        const original=sizes(before),compact=sizes(after),reduction=kind=>Number(((1-compact[kind]/original[kind])*100).toFixed(2));
        assert.equal(after[key].length,9);
        assert.ok(compact.json<original.json*0.75,'configured rows should reduce JSON by at least 25%');
        if(baselineCount)assert.ok(compact.json<original.json*0.02,'baseline reduction should exceed 98%');
        assert.ok(compact.gzip<original.gzip,'snapshot trimming should also benefit gzip');
        t.diagnostic(JSON.stringify({type,baselineCount,before:original,after:compact,reductionPercent:{json:reduction('json'),gzip:reduction('gzip')}}));
        if(baselineCount){
            const automatic=scopedWidgetSnapshot(state,type),automaticSizes=sizes(automatic);
            assert.equal(automatic[key].length,13);
            assert.equal(rendered(automatic,type,{items:13}),rendered(state,type,{items:13}));
            assert.ok(automaticSizes.json<original.json*0.02,'old transports also get baseline reduction above 98%');
            t.diagnostic(JSON.stringify({type,mode:'legacy-count-unknown',baselineCount,before:original,after:automaticSizes,reductionPercent:{json:Number(((1-automaticSizes.json/original.json)*100).toFixed(2)),gzip:Number(((1-automaticSizes.gzip/original.gzip)*100).toFixed(2))}}));
        }
    }
});
