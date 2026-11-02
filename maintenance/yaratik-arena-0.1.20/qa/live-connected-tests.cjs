'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const q=require('./commands.cjs');
const {normalizeGift}=require('../bridge/normalize.cjs');
const {EventSpool}=require('../bridge/storage.cjs');
const checks=[];
const data=path.resolve(__dirname,'../userdata');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let before,initialSettings;
async function main(){
  before=q.state();assert.equal(before.live.status,'connected','An existing live connection is required');
  initialSettings=fs.readFileSync(path.join(data,'mod-settings.json'),'utf8');
  const settings=JSON.parse(initialSettings);
  const binding=settings.Actions.find(a=>a.Op==='spawn'&&a.GiftId&&a.Count<=10);
  assert.ok(binding,'A saved small-wave gift binding is required');
  assert.ok(before.realAvatarFiles>0,'Real live avatar events must have arrived');
  await q.send('lock',{enabled:true});await q.send('menu',{open:false});
  await q.send('view',{x:10,z:-8,yaw:-55,pitch:12});
  const originalGiftEvents=q.state().live.giftEvents;
  for(let i=0;i<5;i++)await q.send('avatar-test');
  await q.wait(s=>s.loadedLivePortraits>0&&!s.hudError,'A real cached live profile renders on a native creature',8000);
  checks.push('Real live avatar files render as circular native portraits; creature names stay hidden');
  const fixtureUser='qa_connected_'+Date.now();
  const event=normalizeGift({common:{msgId:String(Date.now())+'001'},giftId:binding.GiftId,giftType:0,repeatCount:3,
    user:{userId:'999999999',uniqueId:fixtureUser,nickname:'YEREL ENTEGRASYON TESTI'}},before.live.epoch,'999999999').event;
  const spool=new EventSpool(path.join(data,'live-events'),2000);
  const applied=q.state().liveApplied,alive=q.state().logicalAlive;
  spool.enqueue(event);
  await q.wait(s=>s.liveApplied===applied+1&&s.logicalAlive>=alive+binding.Count*3,'Saved gift action through native file IPC',8000);
  checks.push('One synthetic native-ID event activates the saved binding with its repeat count');
  spool.enqueue(event);await sleep(700);assert.equal(q.state().liveApplied,applied+1);
  spool.enqueue({...event,eventId:event.eventId+'-stale',epoch:'qa-stale-epoch'});await sleep(700);
  assert.equal(q.state().liveApplied,applied+1);
  checks.push('Duplicate message identity and stale connection epochs do not replay gift actions');
  const capture=(await q.send('capture')).seq;
  const final=q.state();
  assert.equal(final.live.username,before.live.username);assert.equal(final.live.epoch,before.live.epoch);
  assert.equal(fs.readFileSync(path.join(data,'mod-settings.json'),'utf8'),initialSettings);
  checks.push('Existing live account, connection epoch and saved settings remain unchanged');
  const report={passed:true,checks,capture,realAvatarFiles:final.realAvatarFiles,loadedLivePortraits:final.loadedLivePortraits,
    actualBridgeGiftEvents:final.live.giftEvents-originalGiftEvents,syntheticGiftTest:true,profileCreaturesLocallySpawned:true};
  if(final.live.giftEvents===originalGiftEvents)await q.send('reset');
  await q.send('lock',{enabled:false});
  fs.writeFileSync('live-connected-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(async error=>{
  fs.writeFileSync('live-connected-result.json',JSON.stringify({passed:false,checks,error:error.stack},null,2));
  try{await q.send('lock',{enabled:false});}catch{}
  console.error(error);process.exitCode=1;
});
