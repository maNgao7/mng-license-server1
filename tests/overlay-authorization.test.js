import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOverlayAuthorization } from '../overlay-authorization.js';

test('overlay authorization requires an existing active bound license without activating devices', () => {
    const rows = [{ kod:'TEST',durum:'aktif',cihaz_kimlik:'device',bitis_zamani:2000 }], blocked=[];
    const authorize=createOverlayAuthorization({licenses:()=>rows,blacklist:()=>blocked,now:()=>1000});
    const result=authorize({licenseCode:' test ',deviceId:'device'});assert.match(result.ownerId,/^[a-f0-9]{64}$/);
    for(const input of [{licenseCode:'TEST',deviceId:'other'},{licenseCode:'MISSING',deviceId:'device'},{}])assert.equal(authorize(input),false);
    const snapshot=structuredClone(rows);blocked.push('TEST');assert.equal(authorize({licenseCode:'TEST',deviceId:'device'}),false);blocked.pop();
    for(const state of ['beklemede','iptal','arsivlendi','suresi_doldu']){rows[0].durum=state;assert.equal(authorize({licenseCode:'TEST',deviceId:'device'}),false);}
    rows[0]=snapshot[0];rows[0].bitis_zamani=999;assert.equal(authorize({licenseCode:'TEST',deviceId:'device'}),false);
    rows[0].bitis_zamani=null;assert.ok(authorize({licenseCode:'TEST',deviceId:'device'}));assert.equal(rows[0].cihaz_kimlik,'device');
});

test('agency link is available only to enrolled and unblocked devices', () => {
    const row={kod:'AGENCY',tip:'ajans',durum:'aktif',cihazlar:['enrolled'],engelli_cihazlar:[],bitis_zamani:null};
    const authorize=createOverlayAuthorization({licenses:()=>[row],blacklist:()=>[]});
    assert.ok(authorize({licenseCode:'AGENCY',deviceId:'enrolled'}));
    assert.equal(authorize({licenseCode:'AGENCY',deviceId:'new-device'}),false);
    row.engelli_cihazlar.push('enrolled');assert.equal(authorize({licenseCode:'AGENCY',deviceId:'enrolled'}),false);
    assert.equal(row.cihazlar.length,1);
});
