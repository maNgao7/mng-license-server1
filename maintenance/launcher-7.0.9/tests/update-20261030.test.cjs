'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createStudio}=require('../lib/widget-studio.cjs');
const {scopedWidgetSnapshot}=require('../lib/widget-snapshot.cjs');
const {updatePK}=require('../lib/pk-state.cjs');
function fixture(){const rows=new Map();return createStudio({get:(key,fallback)=>structuredClone(rows.get(key)??fallback),set:(key,value)=>rows.set(key,structuredClone(value))},()=>'/widget/gift-assets/7934.png');}
const gift=(id,user,count=1,giftId='7934')=>({id,type:'gift',username:user,nickname:user,giftId,count,coins:count,createdAt:Date.now()});
test('Racon exact gift, terminal counts, dedupe, editing, channel/session isolation',()=>{
    const s=fixture();s.save('host','raconlist',{giftId:'7934'});
    s.ingest('host',gift('a','one'));s.ingest('host',gift('b','one'));s.ingest('host',gift('c','two',5));
    s.ingest('host',gift('c','two',5));s.ingest('host',gift('wrong','three',999,'5655'));
    s.ingest('host',{...gift('pending','three',100),giftType:1,repeatEnd:false});
    assert.deepEqual(s.state('host').raconRanking.map(r=>[r.username,r.count]),[['two',5],['one',2]]);
    s.save('host','raconlist',{giftId:'7934',rankingRows:[{username:'one',count:10}]});
    assert.deepEqual(s.state('host').raconRanking.map(r=>[r.username,r.count]),[['one',10]]);
    assert.throws(()=>s.save('host','raconlist',{giftId:'7934',rankingRows:[{username:'one',count:NaN}]}));
    assert.equal(s.state('host').raconRanking[0].count,10);
    assert.deepEqual(s.state('other').raconRanking,[]);
    s.beginSession('host','123');assert.deepEqual(s.state('host').raconRanking.map(r=>[r.username,r.count]),[['one',10]]);
    assert.equal(s.settings('host','raconlist').giftId,'7934');
    s.ingest('host',gift('d','one'));s.save('host','raconlist',{giftId:'5655',rankingRows:[{username:'one',count:100}]});
    assert.deepEqual(s.state('host').raconRanking,[],'new gift cannot inherit previous gift totals');
});
test('compact royal response excludes other settings and histories, ranking limited to five',()=>{
    const state={channel:'host',activity:Array(120).fill({message:'not needed',avatar:'https://example.invalid/photo'}),studio:{settings:{raconking:{giftId:'7934'},streambeauty:{giftId:'5655'}},royalLeaders:{raconking:{username:'one'},streambeauty:{username:'other'}},raconRanking:Array.from({length:100},(_,i)=>({username:'user'+i,count:100-i}))}};
    const compact=scopedWidgetSnapshot(state,'raconking');
    assert.deepEqual(Object.keys(compact.studio.settings),['raconking']);assert.equal(compact.activity,undefined);
    assert.deepEqual(Object.keys(compact.studio.royalLeaders),['raconking']);
    assert.equal(scopedWidgetSnapshot(state,'raconlist').studio.raconRanking.length,5);
    assert.equal(scopedWidgetSnapshot(state,'coinjar'),state);
    assert.ok(JSON.stringify(compact).length<JSON.stringify(state).length/10);
});
test('PK decodes official host totals, never supporter or team totals, preserves four independent scores',async()=>{
    const p=await import('tiktok-live-proto/v3');
    const army={...p.BattleUserArmies.decode(new Uint8Array()),hostscore:'123',anchorIdStr:'111',userArmies:[{...p.BattleUserArmy.decode(new Uint8Array()),userId:'999',score:'999999'}]};
    const raw={...p.WebcastLinkMicArmies.decode(new Uint8Array()),battleId:'789',updateBattleScoreTime:'100',armies:{111:army,222:{...army,anchorIdStr:'222',hostscore:'456'}}};
    const decoded=p.WebcastLinkMicArmies.decode(p.WebcastLinkMicArmies.encode(raw).finish());
    let state=updatePK(null,decoded,1000);assert.deepEqual(state.players.map(r=>r.score),[123,456]);
    const previous=state;state=updatePK(state,{...decoded,updateBattleScoreTime:'99'},1001);assert.equal(state,previous,'out of order score ignored');
    const four={...decoded,battleId:'790',armies:{},teamArmies:[{teamTotalScore:'999',teamUser:[{userId:'111',score:'10'},{userId:'222',score:'20'}]},{teamTotalScore:'888',teamUser:[{userId:'333',score:'30'},{userId:'444',score:'40'}]}]};
    state=updatePK(state,four,2000);assert.deepEqual(state.players.map(r=>r.score),[10,20,30,40]);
    assert.equal(updatePK(null,{battleId:'1',armies:{111:{hostscore:'5'}}}).players.length,0);
    assert.equal(updatePK(null,{battleId:'1',armies:{111:{hostscore:'NaN'},222:{hostscore:'2'}}}).players.length,0);
});
test('gift normalization retains v3 streak identity and coin counts',()=>{
    const source=fs.readFileSync(path.join(__dirname,'../main.js'),'utf8');
    const code=source.slice(source.indexOf('function widgetTikTokHediyesiniOku('),source.indexOf('function widgetTikTokYenidenBaglan('));
    const context={};vm.runInNewContext(code,context);
    const payload=context.widgetTikTokHediyesiniOku({giftId:'7934',gift:{type:1,diamondCount:1,name:'Beni Sev'},repeatEnd:true,repeatCount:3,groupId:'123',common:{msgId:'777'}});
    assert.equal(payload.giftType,1);assert.equal(payload.repeatEnd,true);assert.equal(payload.count,3);assert.equal(payload.coins,3);assert.equal(payload.eventId,'777');
    assert.equal(Object.hasOwn(context.widgetTikTokHediyesiniOku({giftId:'5655'}),'repeatEnd'),false);
    assert.equal(context.widgetTikTokHediyesiniOku({giftId:'7934',repeatEnd:'true'}).repeatEnd,true);
    assert.equal(context.widgetTikTokHediyesiniOku({giftId:'7934',repeatEnd:'false'}).repeatEnd,false);
});
