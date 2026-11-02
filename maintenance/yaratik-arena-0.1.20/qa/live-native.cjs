'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const q=require('./commands.cjs');
const {normalizeGift}=require('../bridge/normalize.cjs');
const {EventSpool}=require('../bridge/storage.cjs');
const root=path.resolve(__dirname,'..'),data=path.join(root,'userdata');
const checks=[],rooms=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const original=JSON.parse(fs.readFileSync(path.join(data,'mod-settings.json'),'utf8'));
async function main(){
  await q.send('lock',{enabled:true});await q.send('reset');
  for(const username of ['barbarpm','serkanwstt']){
    await q.send('live-connect',{username});
    const s=await q.wait(s=>s.live.username===username&&['connected','waiting','error'].includes(s.live.status),'Real room '+username,30000);
    rooms.push({username,...s.live,error:s.liveError});
    if(s.live.status==='connected'){
      await sleep(18000);
      const result=q.state();rooms.push({username,observation:true,...result.live,avatars:result.realAvatarFiles,applied:result.liveApplied,unmapped:result.liveUnmapped});
      break;
    }
  }
  await q.send('live-disconnect',{clear:true});
  await q.wait(s=>s.live.status==='disconnected'&&s.live.epoch.length>0,'Native disconnect');
  await sleep(500);await q.send('reset');
  const epoch=q.state().live.epoch;
  const fixtureUser='qa_bridge_'+Date.now();
  const spool=new EventSpool(path.join(data,'live-events'),2000);
  const native=(id,repeatCount=1)=>normalizeGift({common:{msgId:String(Date.now())+String(Math.floor(Math.random()*10000)).padStart(4,'0')},giftId:id,giftType:0,repeatCount,user:{userId:'999999999',uniqueId:fixtureUser,nickname:'YEREL KOPRU TESTI'}},epoch,'999999999');
  await q.send('binding',{index:0,giftId:'5655',count:1});
  for(let index=1;index<original.Actions.length;index++)await q.send('binding',{index,giftId:''});
  const event=native('5655',3).event;
  const applied=q.state().liveApplied;
  spool.enqueue(event);
  await q.wait(s=>s.Alive===3&&s.liveApplied===applied+1,'Normalized fixture through native IPC');
  checks.push('Synthetic normalized native-ID event crosses actual file IPC and creates three native creatures');
  spool.enqueue(event);await sleep(650);assert.equal(q.state().Alive,3);assert.equal(q.state().liveApplied,applied+1);
  checks.push('Native consumer rejects duplicate message identity');
  spool.enqueue({...native('5655').event,epoch:'stale-qa-epoch'});await sleep(650);assert.equal(q.state().Alive,3);
  checks.push('Native consumer rejects stale connection epoch');
  const gifts=JSON.parse(fs.readFileSync(path.join(root,'catalog','gifts.json'),'utf8'));
  const upgrade=gifts.find(g=>g.id!=='5655'&&g.coins>=10).id;
  const downgrade=gifts.find(g=>g.id!=='5655'&&g.id!==upgrade&&g.coins>=10).id;
  await q.send('binding',{index:3,giftId:upgrade});
  spool.enqueue(native(upgrade,2).event);await q.wait(s=>s.level===2&&s.weaponActive,'Two upgrade events');
  await q.send('binding',{index:4,giftId:downgrade});
  spool.enqueue(native(downgrade).event);await q.wait(s=>s.level===1&&s.weaponActive,'Downgrade event');
  checks.push('Real catalog IDs and normalized repeat counts raise and lower actual weapons');
  const image=path.join(data,'avatars','qa-native-avatar.png');
  fs.copyFileSync(path.join(root,'assets','creature_icon-1094.png'),image);
  const avatarsBefore=q.state().realAvatarFiles;
  spool.enqueue({kind:'avatar',epoch,username:fixtureUser,nickname:'YEREL KOPRU TESTI',avatarFile:image});
  await q.wait(s=>s.realAvatarFiles===avatarsBefore+1&&s.loadedLivePortraits>0&&!s.hudError,'Native PNG portrait upload');
  checks.push('Separate synthetic avatar event uploads a local PNG into the native profile renderer');
  const capture=(await q.send('capture')).seq;
  fs.writeFileSync('live-native-result.json',JSON.stringify({passed:true,checks,rooms,capture,syntheticGiftTests:true,realGiftObserved:rooms.some(r=>r.observation&&r.giftEvents>0)},null,2));
  console.log(JSON.stringify({passed:true,checks,rooms,capture}));
}
async function restore(){
  for(let index=0;index<original.Actions.length;index++)await q.send('binding',{index,giftId:original.Actions[index].GiftId,count:original.Actions[index].Count});
  await q.send('reset');await q.send('live-disconnect',{clear:true});await q.send('lock',{enabled:false});
}
main().then(restore).catch(async error=>{fs.writeFileSync('live-native-result.json',JSON.stringify({passed:false,error:error.stack,checks,rooms},null,2));try{await restore();}catch{}console.error(error);process.exitCode=1;});
