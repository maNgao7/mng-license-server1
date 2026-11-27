'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../tools/spectator-native.js'),'utf8');
const code=source.slice(source.indexOf('function protectHealth('),source.indexOf('function publish('));
test('a planted but bent body loses to a more upright native guard',()=>{
 const code=source.slice(source.indexOf('function bodyLean('),source.indexOf('function captureCorners('));
 const TikMngNativeCamera={balancedGuard:(root,head,feet)=>feet.every(foot=>foot.gap<.07)};
 const score=vm.runInNewContext(code+'\ngroundedGuardScore',{TikMngNativeCamera});
 const root=[0,0,0],feet=[{gap:.01},{gap:.02}];
 const upright=score(root,[.08,0,.65],[.2,0,1.25],feet);
 const bent=score(root,[.40,0,.55],[.3,0,1.2],feet);
 assert.ok(upright<bent);
 assert.equal(score(root,[0,0,.65],[0,0,1.25],[{gap:.14},{gap:.02}]),Infinity);
});
test('native corner capture requires gloves together near the head',()=>{
 const closedGuard=vm.runInNewContext(
   source.slice(source.indexOf('function closedGuard('),source.indexOf('function captureCorners('))+'\nclosedGuard',{});
 assert.equal(closedGuard([0,0,1.4],[[-.3,.3,1.2],[.3,.3,1.2]]),true);
 assert.equal(closedGuard([0,0,1.4],[[-1.8,0,.8],[1.8,0,.8]]),false);
 assert.equal(closedGuard([0,0,1.4],[[-.3,0,-.2],[.3,0,-.2]]),false);
});
test('the next roster clears KO state before native controls run',()=>{
 const writes=[],ctx={
   ready:true,stageDirty:true,finished:true,started:true,resumePhysics:false,knockoutAt:42,winner:'left',
   restoreBoxerStatus:false,boxerStatus:[new Uint8Array(5),new Uint8Array(5)],
   stageVersion:3,cleanedStageVersion:2,nativeRoundCleanup:()=>writes.push('cleanup'),
   clearNativeInputHistory(){},
   punches:[{pending:20,issued:4},{pending:12,issued:5}],lastChannelHealth:[[20,0],[20,-1]],
   scoredSwing:[4,5],ringHealth:[1,0],nativeStunPeaks:[12,30],orders:[[{count:20}],[{count:12}]],orderCursor:[3,4]
 };
 const code=source.slice(source.indexOf('function resetMatch('),source.indexOf('let desiredLineup='));
 const retain=vm.runInNewContext(code+'\nretainManualRound',ctx);
 const pointer=offset=>({add:n=>pointer(offset+n),writeU32:()=>writes.push(offset),
   writeByteArray:()=>writes.push(offset),writeU64:value=>writes.push([offset,value])});
 retain(pointer(0));
 assert.deepEqual(ctx.ringHealth,[100,100]);
 assert.deepEqual(ctx.punches.map(p=>p.pending),[0,0]);
 assert.deepEqual(ctx.orders,[[],[]]);
 assert.equal(ctx.started,false);
 assert.equal(ctx.finished,false);
 assert.equal(ctx.knockoutAt,0);
 assert.equal(ctx.restoreBoxerStatus,false);
 assert.deepEqual(writes,[0x9108,'cleanup',[0x2c68,0],[0x2c80,0],
   [0x2e20+0x2c68,0],[0x2e20+0x2c80,0],0x2d30,0x2e20+0x2d30]);
});

test('P start releases held warmup keys even when the roster did not change',()=>{
 const values=new Map([[0x2c68,1],[0x2c80,1],[0x2e20+0x2c68,1],[0x2e20+0x2c80,1]]);
 let cleaned=0;
 const ctx={ready:true,stageDirty:false,finished:false,started:true,resumePhysics:true,
   restoreBoxerStatus:false,boxerStatus:[[],[]],stageVersion:4,cleanedStageVersion:4,
   clearNativeInputHistory(){},
   nativeRoundCleanup(){cleaned++;}};
 const pointer=offset=>({add:n=>pointer(offset+n),writeU32(){},writeU64:n=>values.set(offset,n)});
 const code=source.slice(source.indexOf('function resetMatch('),source.indexOf('let desiredLineup='));
 const retain=vm.runInNewContext(code+'\nretainManualRound',ctx);
 retain(pointer(0));
 assert.equal(cleaned,1);
 assert.deepEqual([...values.values()],[0,0,0,0]);
 assert.equal(ctx.started,true);
 assert.equal(ctx.finished,false);
});
test('custom match damage cannot weaken native stance before KO and still scores contacts once',()=>{
 const values=new Map();
 const defender=0x2e20;
 for(const base of [0,defender]){
   for(const offset of [0x9ec,0x9f0,0xa2c,0xa30])values.set(base+offset,200);
   values.set(base+0x9ac,30);values.set(base+0x9b0,0);
   values.set(base+0x9bc,350);values.set(base+0x9c0,0);
   values.set(base+0x9fc,1800);values.set(base+0xa00,0);
   values.set(base+0xa3c,1800);values.set(base+0xa40,0);
   values.set(base+0x2d88,85);values.set(base+0x2d90,70);
 }
 const ptr=offset=>({add:n=>ptr(offset+n),readFloat:()=>values.get(offset),writeFloat:n=>values.set(offset,n)});
 const channels=base=>[values.get(base+0x9f0),values.get(base+0xa30)];
 const hits=[],ringHealth=[100,100],attack={issued:0,awaitingContact:false};
 const ctx={health:()=>[1,1],started:true,knockoutAt:0,punches:[attack,{issued:0}],ringHealth,nativeStunPeaks:[0,0],
   lastChannelHealth:[[200,200],[200,200]],scoredSwing:[0,0],combatMs:1000,send:hit=>hits.push(hit)};
 const scoring=source.slice(source.indexOf('function scoreContact('),source.indexOf('function checkGloves('));
 const protect=vm.runInNewContext(scoring+'\n'+code+'\nprotectHealth',ctx);

 values.set(defender+0x9f0,150);
 protect(ptr(0));
 assert.deepEqual(ringHealth,[100,100]);
 assert.deepEqual(channels(defender),[200,200]);
 assert.deepEqual([values.get(defender+0x9b0),values.get(defender+0x9c0)],[30,350]);
 assert.deepEqual([values.get(defender+0xa00),values.get(defender+0xa40)],[1800,1800]);
 assert.deepEqual([values.get(defender+0x2d88),values.get(defender+0x2d90)],[0,0]);

 Object.assign(attack,{issued:1,awaitingContact:true,until:1100,damage:99});
 for(const offset of [0xa30,0x9f0]){
   values.set(defender+offset,190);
   values.set(defender+0x9b0,0);values.set(defender+0x9c0,0);
   protect(ptr(0));
   assert.deepEqual(ringHealth,[100,1]);
   assert.deepEqual(channels(defender),[200,200]);
   assert.deepEqual([values.get(defender+0x9b0),values.get(defender+0x9c0)],[30,350]);
 }
 Object.assign(attack,{issued:2,awaitingContact:true});
 values.set(defender+0x9b0,2);values.set(defender+0x9c0,5);
 values.set(defender+0x2d88,90);values.set(defender+0x2d90,75);
 values.set(defender+0x9f0,190);
 protect(ptr(0));
 assert.deepEqual(hits.map(hit=>[hit.defender,hit.damage]),[[1,99],[1,1]]);
 assert.deepEqual(ringHealth,[100,0]);
 assert.deepEqual(channels(defender),[-1,-1]);
 assert.deepEqual(channels(0),[200,200]);
 assert.deepEqual([values.get(defender+0x9b0),values.get(defender+0x9c0)],[2,5]);
 assert.deepEqual([values.get(defender+0x2d88),values.get(defender+0x2d90)],[90,75]);
});
