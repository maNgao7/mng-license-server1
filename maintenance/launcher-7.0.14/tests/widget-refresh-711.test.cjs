'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),timer=require('../lib/stream-timer.cjs'),{normalize,createStudio}=require('../lib/widget-studio.cjs'),{updatePK}=require('../lib/pk-state.cjs'),{scopedWidgetSnapshot}=require('../lib/widget-snapshot.cjs'),{describeEmoji}=require('../lib/speech-emoji.cjs');
test('timer gifts add per unit, deduplicate, pause and preserve exact remaining time',()=>{
 const data={},config=normalize('streamtimer',{baseSeconds:100,running:true,gift1:'5655',seconds1:20,gift2:'7934',seconds2:60}),wheel=normalize('actionwheel',{giftId:'999',segments:'Dans et'});
 timer.configure(data,config,1000);timer.ingest(data,{id:'a',type:'gift',giftId:'5655',count:3,coins:3,username:'one'},config,wheel,()=>0,11000);assert.equal(timer.remaining(data.streamTimer,11000),150000);
 timer.ingest(data,{id:'a',type:'gift',giftId:'5655',count:3,coins:3},config,wheel,()=>0,11000);assert.equal(timer.remaining(data.streamTimer,11000),150000);
 timer.configure(data,{...config,running:false},21000);assert.equal(timer.remaining(data.streamTimer,99000),140000);
 timer.ingest(data,{id:'b',type:'gift',giftId:'7934',count:2,coins:2},config,wheel,()=>0,100000);assert.equal(timer.remaining(data.streamTimer,200000),260000);
 timer.configure(data,config,200000);assert.equal(timer.remaining(data.streamTimer,210000),250000);
});
test('wheel uses the server outcome once and may extend the independent timer',()=>{
 const data={},config=normalize('streamtimer',{baseSeconds:0}),wheel=normalize('actionwheel',{giftId:'5655',segments:'Dans et\nYayın süresini uzat',extendSeconds:90}),event={id:'g',type:'gift',giftId:'5655',count:1,coins:1};
 timer.ingest(data,event,config,wheel,()=>1,1000);assert.equal(event.actionWheelIndex,1);assert.equal(timer.remaining(data.streamTimer,1000),90000);
 timer.ingest(data,event,config,wheel,()=>0,1000);assert.equal(event.actionWheelIndex,1);assert.equal(timer.remaining(data.streamTimer,1000),90000);
});
test('real 2v2 aggregate anchor slot IDs do not become spurious extra players',()=>{
 const message={battleId:'900',armies:{'7108888648279835649':{anchorIdStr:'1',hostscore:'10'},'6717272976642049029':{anchorIdStr:'2',hostscore:'20'}},teamArmies:[{teamId:'1',teamTotalScore:'10',teamUser:[{userId:'7108888648279835649',score:'4'},{userId:'6637827331829334021',score:'6'}]},{teamId:'2',teamTotalScore:'20',teamUser:[{userId:'6717272976642049029',score:'8'},{userId:'6740370726355207173',score:'12'}]}]};
 const pk=updatePK(null,message);assert.equal(pk.players.length,4);assert.equal(pk.teams.length,2);assert.ok(!pk.players.some(p=>['1','2'].includes(p.id)));
 const map=new Map(),studio=createStudio({get:(k,d)=>map.get(k)||d,set:(k,v)=>map.set(k,v)},()=>''),finished={...message,battleSettings:{status:2}};
 studio.ingestPK('one',finished);studio.ingestPK('one',finished);assert.equal(studio.state('one').pk.wins['2'],1);
 const restored=createStudio({get:(k,d)=>map.get(k)||d,set:(k,v)=>map.set(k,v)},()=>'' );restored.ingestPK('one',finished);assert.equal(restored.state('one').pk.wins['2'],1);
});
test('all durable Racon participants can rotate after the fixed top three',()=>{
 const saved=Date.now,rows=Array.from({length:27},(_,i)=>({username:'p'+i,count:100-i})),seen=new Set();
 try{for(let page=0;page<27;page++){Date.now=()=>page*10000;const s=scopedWidgetSnapshot({studio:{settings:{raconlist:{items:8,pageSeconds:10}},raconRanking:rows}},'raconlist');assert.equal(s.studio.raconTotal,27);assert.equal(s.studio.raconRanking.length,8);assert.deepEqual(s.studio.raconRanking.slice(0,3).map(p=>p.username),['p0','p1','p2']);for(const p of s.studio.raconRanking)seen.add(p.username);}assert.equal(seen.size,27);}finally{Date.now=saved;}
 assert.equal(normalize('raconlist',{portraitFrame:'sultan'}).portraitFrame,'sultan');
});
test('emoji descriptions never read emoji identifiers or unicode surrogate codes',()=>{
 assert.match(describeEmoji('Merhaba 😂 [loveface] <a:clap:123456789>'),/gülmekten ağlayan yüz.*aşık yüz.*alkış/);
 assert.equal(describeEmoji('[emote_123456]'),'emoji');assert.equal(describeEmoji('👍🏽'),'beğeni');assert.equal(describeEmoji('🇹🇷'),'Türk bayrağı');assert.ok(!describeEmoji('😂').includes('1F602'));
});
