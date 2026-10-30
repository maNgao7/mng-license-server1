'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createStudio}=require('../lib/widget-studio.cjs');
function fixture(){
    const disk=new Map(),store={get:(key,value)=>structuredClone(disk.get(key)??value),set:(key,value)=>disk.set(key,structuredClone(value))};
    const reopen=()=>createStudio(store,()=>''),studio=reopen();
    studio.save('host','raconlist',{giftId:'7934'});
    let serial=0;
    const gift=(username,count=1,id='gift-'+(++serial))=>({id,type:'gift',giftId:'7934',username,nickname:username,avatar:'https://example.test/'+username+'.png',count,coins:count});
    return {studio,reopen,gift};
}
const rows=studio=>studio.state('host').raconRanking.map(r=>[r.username,r.count]);
const edit=studio=>{const state=studio.state('host');return {giftId:'7934',rankingRows:structuredClone(state.raconRanking),rankingBase:structuredClone(state.raconRanking),rankingRevision:state.raconRevision};};

test('Racon pool persists through new lives, reconnects and service restarts',()=>{
    const f=fixture();f.studio.ingest('host',f.gift('alice',4));
    f.studio.beginSession('host','111');f.studio.beginSession('host','222');
    assert.deepEqual(rows(f.studio),[['alice',4]]);
    const restored=f.reopen();restored.beginSession('host','333');
    assert.deepEqual(rows(restored),[['alice',4]]);
    assert.equal(restored.state('host').raconRanking[0].avatar,'https://example.test/alice.png');
    assert.equal(restored.settings('host','raconlist').giftId,'7934');
    assert.equal(restored.state('host').resets.raconlist,undefined);
});

test('manual X increase, decrease and removal persist; later gifts continue from edited counts',()=>{
    const f=fixture();f.studio.ingest('host',f.gift('alice',4));f.studio.ingest('host',f.gift('bob',2));
    let input=edit(f.studio);input.rankingRows.find(r=>r.username==='alice').count=6;f.studio.save('host','raconlist',input);
    assert.deepEqual(rows(f.studio),[['alice',6],['bob',2]]);
    input=edit(f.studio);input.rankingRows=[{username:'alice',count:3}];f.studio.save('host','raconlist',input);
    const restored=f.reopen();assert.deepEqual(rows(restored),[['alice',3]]);
    restored.ingest('host',f.gift('alice'));assert.deepEqual(rows(restored),[['alice',4]]);
    assert.equal(restored.state('host').raconRanking[0].avatar,'https://example.test/alice.png');
});

test('gifts received while pool editor is open are not overwritten by manual edits',()=>{
    const f=fixture();f.studio.ingest('host',f.gift('alice',4));f.studio.ingest('host',f.gift('bob',2));
    const input=edit(f.studio);input.rankingRows.find(r=>r.username==='alice').count=5;
    f.studio.ingest('host',f.gift('alice',2));f.studio.ingest('host',f.gift('newcomer',3));f.studio.ingest('host',f.gift('bob',4));
    f.studio.save('host','raconlist',input);
    assert.deepEqual(new Map(rows(f.studio)),new Map([['alice',7],['bob',6],['newcomer',3]]));
});

test('old editor cannot restore a reset or concurrently edited pool',()=>{
    const f=fixture();f.studio.ingest('host',f.gift('alice',4));const stale=edit(f.studio);
    f.studio.reset('host','raconlist');
    assert.throws(()=>f.studio.save('host','raconlist',stale),/Havuz değişti/);
    assert.deepEqual(rows(f.studio),[]);
    f.studio.ingest('host',f.gift('bob',2));const first=edit(f.studio),second=edit(f.studio);
    first.rankingRows[0].count=5;f.studio.save('host','raconlist',first);
    second.rankingRows[0].count=9;assert.throws(()=>f.studio.save('host','raconlist',second),/Havuz değişti/);
    assert.deepEqual(rows(f.studio),[['bob',5]]);
});

test('pool reset and gift changes are explicit and isolated by publisher',()=>{
    const f=fixture();f.studio.save('other','raconlist',{giftId:'7934'});
    f.studio.ingest('host',f.gift('alice',4));f.studio.ingest('other',f.gift('bob',2));
    f.studio.beginSession('other','123');f.studio.reset('host','raconlist');
    assert.deepEqual(rows(f.studio),[]);assert.equal(f.studio.state('other').raconRanking[0].count,2);
    assert.equal(f.studio.settings('host','raconlist').giftId,'7934');
    f.studio.ingest('host',f.gift('alice',3));f.studio.save('host','raconlist',{giftId:'5655'});
    assert.deepEqual(rows(f.studio),[]);assert.equal(f.studio.state('other').raconRanking[0].count,2);
});

test('duplicate receipts stay deduplicated across live changes and restarts',()=>{
    const f=fixture(),event=f.gift('alice',4,'same-receipt');f.studio.ingest('host',event);
    f.studio.beginSession('host','123');const restored=f.reopen();restored.ingest('host',event);
    assert.deepEqual(rows(restored),[['alice',4]]);
});

test('invalid pool edits never partially mutate stored counts',()=>{
    const f=fixture();f.studio.ingest('host',f.gift('alice',4));
    for(const count of [0,-1,NaN,1.5,1000000000001]){
        const input=edit(f.studio);input.rankingRows[0].count=count;
        assert.throws(()=>f.studio.save('host','raconlist',input));assert.deepEqual(rows(f.studio),[['alice',4]]);
    }
    const input=edit(f.studio);input.rankingBase={};assert.throws(()=>f.studio.save('host','raconlist',input));
    assert.deepEqual(rows(f.studio),[['alice',4]]);
});
