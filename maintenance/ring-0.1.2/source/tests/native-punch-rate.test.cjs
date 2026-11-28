'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../tools/spectator-native.js'),'utf8');
const timing=source.slice(source.indexOf('const punchRateScale='),source.indexOf('// Consecutive identical commands'));
const values=vm.runInNewContext(timing+'\n({punchRateScale,punchMotionMs,punchRecoveryMs,finishGraceMs})');
function fixture(){
  const ctx={...values,punches:[0,1].map(()=>({pending:0,pendingA:0,pendingB:0,until:0,nextAt:0,issued:0,awaitingContact:false})),
    orders:[[],[]],orderCursor:[0,0],livingSafety:[{recovering:false},{recovering:false}],
    rootDistance:2.5,rawHeadWorld:[],ringHealth:[100,100],scoredSwing:[0,0],messages:[],
    geomDistance:()=>1,closestPoints:null,send:value=>ctx.messages.push(value)};
  const score=source.slice(source.indexOf('function scoreContact('),source.indexOf('function nativeMatchControls('));
  const issue=source.slice(source.indexOf('function activeStrike('),source.indexOf('function needsNativeGuard('));
  const rpc=source.slice(source.indexOf('  punch(request){'),source.indexOf('  stop(){'));
  vm.runInNewContext(score+'\n'+issue+'\nconst rpc=({'+rpc+'});globalThis.request=rpc.punch;',Object.assign(ctx,{
    started:true,finished:false,knockoutAt:0,damagePerHit:15,seenPunches:new Set()}));
  return{ctx,queue:(side,count=3)=>ctx.request({side,count,damage:2,eventId:'viewer-'+side})};
}

test('configured start rate increases by 40 percent rather than reducing the interval by 40 percent',()=>{
  assert.ok(Math.abs(values.punchMotionMs-250)<1e-10);
  assert.equal(values.punchRecoveryMs,100/1.4);
  assert.ok(Math.abs(450/(values.punchMotionMs+values.punchRecoveryMs)-1.4)<1e-12);
  assert.ok(values.finishGraceMs<values.punchRecoveryMs,'A missed contact settles before the next command slot');
});

test('queued native starts obey the faster complete cycle, alternate corners and keep damage single-use',()=>{
  const {ctx,queue}=fixture();queue(0);queue(1);
  for(let now=1000;now<=3000;now++){
    ctx.checkGloves(null,null,now);
    ctx.issuePunch(0,now);ctx.issuePunch(1,now);
  }
  const starts=ctx.messages.filter(m=>m.type==='punch'),hits=ctx.messages.filter(m=>m.type==='hit');
  assert.deepEqual(starts.map(m=>m.side),[0,1,0,1,0,1]);
  assert.deepEqual(starts.slice(1).map((m,i)=>m.simulationMs-starts[i].simulationMs),[322,322,322,322,322]);
  assert.deepEqual(hits.map(m=>m.damage),[2,2,2,2,2,2]);assert.deepEqual(ctx.ringHealth,[94,94]);
  assert.ok(hits.every(m=>m.contact==='settled'));
  ctx.checkGloves(null,null,9000);assert.equal(ctx.messages.filter(m=>m.type==='hit').length,6);
});

test('no command starts during the held input, release or unresolved contact windows',()=>{
  const {ctx,queue}=fixture();queue(0);ctx.issuePunch(0,1000);
  assert.equal(ctx.activeStrike(1249.999),true);assert.equal(ctx.activeStrike(1250),false);
  for(const now of [1249.999,1250,1303.5,1321.428])ctx.issuePunch(0,now);
  assert.equal(ctx.punches[0].issued,1,'Even after the release, unresolved contact serializes starts');
  ctx.checkGloves(null,null,1321.4286);ctx.issuePunch(0,1321.4286);
  assert.equal(ctx.punches[0].issued,2);
});

test('recovery and out-of-range waits retain queued viewer commands and event replay protection',()=>{
  const {ctx,queue}=fixture();queue(0);assert.equal(queue(0).duplicate,true);
  assert.equal(ctx.punches[0].pending,3);
  ctx.livingSafety[1].recovering=true;ctx.issuePunch(0,1000);
  assert.equal(ctx.punches[0].issued,0);assert.equal(ctx.punches[0].pending,3);
  ctx.livingSafety[1].recovering=false;ctx.rootDistance=3;ctx.issuePunch(0,1001);
  assert.equal(ctx.punches[0].issued,0);assert.equal(ctx.punches[0].pending,3);
  ctx.rootDistance=2.8;ctx.issuePunch(0,1002);
  assert.equal(ctx.punches[0].issued,1);assert.equal(ctx.punches[0].pending,2);
});
