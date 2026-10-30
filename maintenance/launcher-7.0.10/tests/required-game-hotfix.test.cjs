const test=require('node:test'),assert=require('node:assert/strict');
const {ensureRequiredGameHotfix}=require('../lib/required-game-hotfix.cjs');
test('only the selected urgent game is updated before play',async()=>{
    const calls=[];
    for(const gameId of ['frog-river','caahr'])assert.equal(await ensureRequiredGameHotfix({gameId,state:{installed:true,updateAvailable:true},install:async id=>{calls.push(id);return {basarili:true};}}),true);
    assert.deepEqual(calls,['frog-river','caahr']);
    for(const state of [{installed:true,updateAvailable:false},{installed:false,updateAvailable:true}])assert.equal(await ensureRequiredGameHotfix({gameId:'frog-river',state,install:()=>assert.fail()}),false);
    assert.equal(await ensureRequiredGameHotfix({gameId:'snow-war',state:{installed:true,updateAvailable:true},install:async()=>({basarili:true})}),true);
});
test('failed required update does not launch the known broken version silently',async()=>{
    await assert.rejects(ensureRequiredGameHotfix({gameId:'caahr',state:{installed:true,updateAvailable:true},install:async()=>({basarili:false,hata:'Bağlantı kesildi'})}),/Bağlantı kesildi/);
});
