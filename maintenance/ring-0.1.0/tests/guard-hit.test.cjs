'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

// Exercise just the shipped scoring rules, with deterministic contact samples.
// Native desktop QA separately verifies actual swings, HP bars and knockouts.
const game = readFileSync(join(__dirname,'../tools/spectator-native.js'),'utf8');
const scoring = game.slice(game.indexOf('function scoreContact('),game.indexOf('function nativeMatchControls('));
test('opposite live batches wait 100 ms after retraction and deliver each order once',()=>{
  const punches=[0,1].map(()=>({pending:2,pendingA:2,until:0,nextAt:0,issued:0}));
  const delivered=[];
  const ctx={punches,rootDistance:2,rawHeadWorld:[],orders:[[{count:2,damage:1}],[{count:2,damage:1}]],
    orderCursor:[0,0],scoredSwing:[0,0],ringHealth:[100,100],geomDistance:()=>0,closestPoints:null,
    send:message=>{if(message.type==='punch')delivered.push([message.side,message.simulationMs]);}};
  const source=game.slice(game.indexOf('function activeStrike('),game.indexOf('const step2=new NativeCallback('));
  const timing=game.match(/^const punch(?:Motion|Recovery)Ms=.*;$/gm).join('\n');
  const {issuePunch,activeStrike,checkGloves}=runInNewContext(
    [timing,scoring,source,'({issuePunch,activeStrike,checkGloves})'].join('\n'),ctx);
  function tick(now){
    issuePunch(0,now);
    issuePunch(1,now);
    checkGloves(null,null,now);
  }
  tick(1000);
  assert.equal(activeStrike(1349),true);
  assert.equal(activeStrike(1350),false);
  tick(1350);
  tick(1449);
  assert.deepEqual(delivered,[[0,1000]]);
  tick(1450);
  tick(1900);
  tick(2350);
  tick(2800);
  assert.deepEqual(delivered,[[0,1000],[1,1450],[0,1900],[1,2350]]);
  assert.deepEqual(punches.map(p=>p.pending),[0,0]);
});
test('a boxer at the ropes can punch when upper bodies are close',()=>{
  const code=game.slice(game.indexOf('function canStrike('),game.indexOf('function issuePunch('));
  const canStrike=runInNewContext(code+'\ncanStrike',{});
  assert.equal(canStrike(2.34,[[-7.64,-6.91,1.11],[-8.54,-5.36,1.07]]),true);
  assert.equal(canStrike(2.34,[[0,0,1],[2.3,0,1]]),true);
  assert.equal(canStrike(2.8,[[0,0,1],[2.8,0,1]]),true);
  assert.equal(canStrike(2.81,[[0,0,1],[2.81,0,1]]),false);
  assert.equal(canStrike(4,[[0,0,1],[1.8,0,1]]),false);
  assert.equal(canStrike(null,[null,null]),false);
});
for (const sample of ['guard','body','missed sample']) {
  test(sample+' consumes the viewer punch exactly once',()=>{
    const hp=[100,100], hits=[];
    const context={
      punches:[{awaitingContact:true,issued:1,until:350,damage:23},{awaitingContact:false}],
      scoredSwing:[0,0],ringHealth:hp,finishGraceMs:75,closestPoints:null,
      geomDistance:(_model,_data,_glove,part)=>part===(sample==='guard'?33:sample==='body'?38:-1)?0:1,
      send:hit=>hits.push(hit)
    };
    const check=runInNewContext(scoring+'\ncheckGloves',context);
    check(null,null,100);
    assert.equal(hp[1],sample==='missed sample'?100:77);
    check(null,null,500);
    check(null,null,900);
    assert.deepEqual(hp,[100,77]);
    assert.equal(hits.length,1);
    assert.equal(hits[0].blocked,sample==='guard');
  });
}
