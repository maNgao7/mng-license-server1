'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {standardRules, applyProfile, libraryProfiles} = require('./apply-standard-gifts.cjs');

for(const [id,name,count] of [['battle-royale','mng-battle-royale.json',10],['snow-war','mng-snow-war.json',16]]) {
    test(id + ' explicitly restores only the approved gift rules, backs up and survives rereading', t=>{
        const root = fs.mkdtempSync(path.join(os.tmpdir(),'mng-approved-gifts-'));
        t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
        const file = path.join(root,name);
        const before = {effectVolume:43,playerHealth:177,streamer:'retained',giftRules:[
            {giftId:'5658',action:'ZIRH_4',amount:7},{giftId:'extra',action:'MP5K',amount:50}]};
        const original = JSON.stringify(before);
        fs.writeFileSync(file, original);
        assert.equal(applyProfile(id,file).changed,true);
        assert.equal(fs.readFileSync(file,'utf8'),original);
        const result = applyProfile(id,file,{apply:true});
        assert.equal(result.applied,true);
        assert.equal(fs.readFileSync(result.backup,'utf8'),original);
        const saved = JSON.parse(fs.readFileSync(file,'utf8'));
        assert.deepEqual(saved.giftRules,standardRules(id));
        assert.equal(saved.giftRules.length,count);
        delete saved.giftRules; delete before.giftRules;
        assert.deepEqual(saved,before);
        assert.equal(applyProfile(id,file,{apply:true}).changed,false);
        assert.equal(fs.readdirSync(root).length,2);
    });
}

test('only current active versions are selected; rollback versions are not edited', t=>{
    const root = fs.mkdtempSync(path.join(os.tmpdir(),'mng-approved-gifts-'));
    t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
    const meta=path.join(root,'.game-library','snow-war');
    const directory='00000000-0000-0000-0000-000000000001';
    const config=path.join(meta,'versions',directory,'game-instance/config/mng-snow-war.json');
    fs.mkdirSync(path.dirname(config),{recursive:true}); fs.writeFileSync(config,'{}');
    const pointer=path.join(meta,'active.json');
    fs.writeFileSync(pointer,JSON.stringify({schema:1,directory}));
    assert.deepEqual(libraryProfiles(root),[['snow-war',config]]);
    fs.writeFileSync(pointer,JSON.stringify({schema:1,directory:'../../outside'}));
    assert.throws(()=>libraryProfiles(root),/Unsafe/);
});

test('approved posters retain the 10/16 exact-ID contracts, without extra rows',()=>{
    const pubg=standardRules('battle-royale'),snow=standardRules('snow-war');
    assert.deepEqual(pubg.map(r=>[r.giftId,r.action,r.amount]),[
        ['5655','OYUNCU',1],['5658','SILAH_YUKSELT',1],['5282','ZIRH_1',1],['5879','ZIRH_2',1],
        ['5303','ZIRH_3',1],['6427','ZIRH_4',1],['5319','KIT_BAS',1],['5509','TAM_TECHIZAT',1],
        ['5994','EL_BOMBASI',1],['7934','OYUNCU',1]]);
    assert.deepEqual(snow.map(r=>[r.giftId,r.action,r.amount]),[
        ['5655','OYUNCU',2],['5319','OYUNCU',5],['5879','OYUNCU',25],['5658','TAKIM_KALKANI',5],
        ['5303','KAR_HORTUMU',1],['6427','AGIR_KARTOPU',5],['127088','IYILESTIR',1],['626064','EKSTRA_CAN',1],
        ['17473','KAR_ADAMI',10],['6104','BUZ_TUZAGI',1],['5566','KARTOPU_SILAHI',1],['11046','HERKESI_DUSUR',1],
        ['7168','CIG',1],['5509','TAKIM_KALKANI',30],['7934','OYUNCU',5],['5282','OYUNCU',10]]);
});
