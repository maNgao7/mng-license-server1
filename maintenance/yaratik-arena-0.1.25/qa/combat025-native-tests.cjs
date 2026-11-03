'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const q = require('./commands.cjs');
const root = process.env.TIKMNG_ARENA_QA_ROOT;
const checks = [], captures = [], measurements = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const visual = user => q.state().creatureVisuals.find(c => c.Username === user);
function check(label, ok) { assert.ok(ok, label); checks.push(label); }
async function level(n) { while(q.state().level < n) await q.send('up'); while(q.state().level > n) await q.send('down'); }
async function fresh() {
  await q.send('lock', {enabled:true}); await q.send('live-events-pause', {enabled:true});
  await q.send('auto-play', {enabled:false}); await q.send('menu', {open:false}); await q.send('reset');
  await q.send('crowd-settings', {timed:false});
  await q.send('combat-settings', {enabled:false,playerHealth:500,damage:3,interval:1.2});
  await q.send('view', {x:0,z:-10,yaw:0,pitch:14});
}
async function capture(label) {
  const s=await q.send('capture'), file='capture-'+s.seq+'.png';
  fs.copyFileSync(path.join(root,file),path.join(root,'combat025-'+label+'.png'));
  captures.push('combat025-'+label+'.png');
}
async function observe(predicate,label,timeout=10000) {
  const until=Date.now()+timeout;
  while(Date.now()<until) { const s=await q.send('report'); if(predicate(s))return s; await sleep(30); }
  throw new Error(label);
}
(async()=>{
  let error;
  try {
    assert.ok(root && !path.resolve(root).toLowerCase().startsWith(path.resolve(__dirname).toLowerCase()), 'Isolated installed game required');
    await q.wait(s=>s.ready&&s.version==='0.1.25','Version 0.1.25 ready',45000);
    await fresh();
    for (const tier of [0,2,4,7]) {
      await q.send('reset'); await level(tier);
      await q.send('combat-fixture',{distance:1.5,user:'qa_percent_'+tier});
      await q.wait(s=>s.combatTestBodies.some(c=>c.Username==='qa_percent_'+tier),'fixture');
      await q.send('combat-settings',{enabled:true});
      const s=await q.wait(s=>s.creatureHits>0&&s.playerLastDamage>0,'Real hostile hit');
      const expected=[3,4,6,7,9,12,15,19][tier]*5;
      // Counters span resets, so observe the last damage value rather than only their count.
      await q.wait(s=>s.playerLastDamage===expected,'Damage at tier '+tier,6000);
      check('real attack at tier '+tier+' removes '+expected+' of 500',q.state().playerLastDamage===expected);
      measurements.push({tier,damage:q.state().playerLastDamage});
      await q.send('combat-settings',{enabled:false});
    }
    for(const kind of ['spawn','boss','bigboss']) {
      await fresh(); await level(4);
      await q.send('team-fixture',{user:'qa_dead_'+kind,kind,x:0,z:-8.7});
      await q.send('combat-settings',{enabled:true});
      await observe(s=>s.creatureVisuals.some(c=>c.Username==='qa_dead_'+kind&&c.swing),'Attacking '+kind);
      await q.send('hit',{user:'qa_dead_'+kind,damage:100000});
      // Large native ragdolls need longer to finish the physical fall, independently of locomotion.
      await sleep(kind==='bigboss'?8000:4000); await q.send('report'); const before=visual('qa_dead_'+kind);
      check(kind+' dies during its swing without a standing animation',before.IsDead&&!before.swing&&before.path===0&&before.moving===0&&before.canGrab&&before.ragdoll);
      await sleep(1000); await q.send('report'); const after=visual('qa_dead_'+kind);
      measurements.push({corpse:kind,before,after});
      check(kind+' corpse rests instead of walking',Math.hypot(before.x-after.x,before.y-after.y,before.z-after.z)<.03);
      await capture('corpse-'+kind);
    }
    await fresh(); await level(4); await q.send('blood-enabled',{enabled:true});
    await q.send('team-fixture',{user:'qa_visible_wound',kind:'spawn',x:0,z:-5});
    await q.send('weapon-ray-shot',{user:'qa_visible_wound'});
    check('raycast firearm hit creates a visible native wound',visual('qa_visible_wound').damageCount>0&&visual('qa_visible_wound').health<visual('qa_visible_wound').maximum);
    await capture('wound-on');
    await q.send('hit',{user:'qa_visible_wound',damage:1});
    const oldWounds=q.state().mergedWounds, oldRadius=Math.max(...visual('qa_visible_wound').woundRadii);
    await q.send('hit',{user:'qa_visible_wound',damage:1});
    check('repeat impacts deepen the existing wound rather than being discarded',q.state().mergedWounds>oldWounds&&Math.max(...visual('qa_visible_wound').woundRadii)>oldRadius);
    for(let i=0;i<8;i++)await q.send('hit',{user:'qa_visible_wound',damage:1});
    const saturated=visual('qa_visible_wound');
    check('repeat injury stays bounded instead of erasing the whole living creature',!saturated.IsDead&&saturated.damageCount<=6&&Math.max(...saturated.woundRadii)<=.5401);
    await sleep(700);await q.send('report');
    check('native movement preserves visible wounds',visual('qa_visible_wound').damageCount>=saturated.damageCount&&Math.max(...visual('qa_visible_wound').woundRadii)>=Math.max(...saturated.woundRadii)-.001);
    await capture('wound-deepened');
    await q.send('blood-enabled',{enabled:false});
    check('turning blood off clears native wounds',visual('qa_visible_wound').damageCount===0);
    const noBloodHealth=visual('qa_visible_wound').health;
    await q.send('hit',{user:'qa_visible_wound',damage:1});
    check('blood-off impacts retain damage but never carve blood wounds',visual('qa_visible_wound').damageCount===0&&visual('qa_visible_wound').health<noBloodHealth);
    await capture('wound-off');
    await q.send('blood-enabled',{enabled:true});
    await q.send('hit',{user:'qa_visible_wound',damage:1});
    check('turning blood on restores native wounds immediately',visual('qa_visible_wound').damageCount>0);
    await fresh(); const collected=q.state().vacuumCollected;
    await q.send('vacuum-hold',{distance:4});
    await q.wait(s=>s.vacuumCollected>collected,'Dead creature remains vacuum collectable',12000);
    check('corpse fix preserves vacuum collection',q.state().vacuumCollected>collected);
    await fresh(); await level(2);
    let a=q.state().weaponResources.reloadAudio;
    await q.send('ammo-reload'); check('full magazine makes no false reload cue',q.state().weaponResources.reloadAudio.starts===a.starts);
    await q.send('audio-sample'); await q.send('ammo-shot'); await q.send('ammo-reload');
    await q.send('ammo-reload');
    check('reload cue starts once even after repeat key',q.state().weaponResources.reloadAudio.starts===a.starts+1);
    await q.wait(s=>!s.weaponResources.reloading,'Reload complete');
    check('reload completion cue plays once',q.state().weaponResources.reloadAudio.completes===a.completes+1);
    await q.send('audio-probe');
    const audio=JSON.parse(fs.readFileSync(path.join(root,'audio-probe.json')));
    check('reload SFX reaches the native output without interop errors',audio.qaAudioPeak>0&&!audio.audioError&&q.state().weaponResources.reloadAudio.failures===0);
    a=q.state().weaponResources.reloadAudio;
    await q.send('ammo-shot'); await q.send('ammo-reload'); await q.send('up'); await sleep(2000);
    check('cancelled reload never plays a stale completion cue',q.state().weaponResources.reloadAudio.completes===a.completes&&q.state().weaponResources.reloadAudio.cancellations>a.cancellations);
    check('all gameplay diagnostics remain healthy',!q.state().failed&&!q.state().survivalError&&!q.state().combatVisualError&&!q.state().autoError);
  } catch(e) { error=e.stack; process.exitCode=1; }
  finally {
    const result={passed:!error,timestamp:new Date().toISOString(),checks,measurements,captures,error};
    fs.writeFileSync(path.join(root,'combat025-native-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
    try { await fresh(); } catch{}
  }
})();
