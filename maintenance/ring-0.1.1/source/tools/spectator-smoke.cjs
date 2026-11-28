'use strict';
const assert = require('node:assert/strict');
const {setTimeout: wait} = require('node:timers/promises');
const path = require('node:path');
const appRoot = process.env.HEDIYE_BOX_QA_APP_ROOT || path.resolve(__dirname,'..');
const {NativeSpectator} = require(path.join(appRoot,'src/native-spectator.cjs'));
const {AudienceQueue} = require(path.join(appRoot,'src/audience-queue.cjs'));
const {projectWorld}=require(path.join(appRoot,'tools/native-camera.js'));
const centered=(view,side)=>{
  const point=view?.anchors?.[side]?.world;
  if(!point||!view.camera||Date.now()-view.at>250)return false;
  const body=projectWorld([point[0],point[1]-.65,point[2]],view.camera);
  return body.inViewport&&Math.hypot(body.viewport[0]-.5,body.viewport[1]-.5)<.18;
};

async function until(read, predicate, label, timeout = 20000) {
  const end = Date.now() + timeout;
  let value;
  while (Date.now() < end) {
    value = await read();
    if (value?.phase === 'error') throw new Error(value.error);
    if (predicate(value)) return value;
    await wait(100);
  }
  throw new Error(label + ': ' + JSON.stringify(value));
}

async function run() {
  const game = new NativeSpectator();
  const fullCombo = process.argv.includes('--hundred-gifts');
  const blueDamage = fullCombo ? 1 : 25;
  const queue = new AudienceQueue({kingOfRing: true, settings:{giftDamage:{'5655':blueDamage}}});
  const sample = () => game.command('sample');
  const camera = () => game.command('camera_sample');
  const join = name => queue.ingestChat({userId:name, nickname:name, eventId:'join-' + name, comment:'katıl'});
  const gift = (userId,giftId,eventId,count) => ({userId,giftId,eventId,repeatCount:count,coinUnit:1,isDelta:true});
  let latest, cameraMode, hitCount=0;
  const strikes = [];
  game.on('camera', view => { cameraMode=view.camera?.mode; });
  game.on('state', state => { latest=state; });
  game.on('punch', event => strikes.push(['swing', event.side, event.issued]));
  game.on('hit', event => {
    hitCount++;
    strikes.push(['hit', event.defender, event.damage]);
  });
  async function stage() {
    const {active}=queue.snapshot();
    const sides=[!!active.left,!!active.right];
    await game.stage(sides);
    return until(sample,s=>s.phase==='waiting' && sides.every((visible,i)=>s.health[i]===(visible?1:null)), 'Corner placement');
  }
  async function dispatch(event, expectedCount) {
    const {actions}=queue.ingestGift(event);
    assert.equal(actions.length,1);
    const action={...actions[0],side:actions[0].side==='left'?0:1};
    if (expectedCount !== undefined) assert.equal(action.count, expectedCount);
    assert.ok((await game.punch(action)).accepted);
    assert.ok((await game.punch(action)).duplicate);
    assert.equal(queue.ingestGift(event).actions.length,0);
  }
  try {
    game.open();
    await until(()=>latest,s=>s?.phase==='waiting','Empty ring initialization',30000);
    assert.deepEqual(latest.health,[null,null]);
    const parked=head=>Math.abs(head[0])>10000&&head[2]>.75;
    assert.ok(latest.rawHeadWorld.every(parked));
    await assert.rejects(game.startMatch());
    assert.ok(join('Red').joined);
    const one=await stage();
    assert.ok(parked(one.rawHeadWorld[0]) && Math.abs(one.rawHeadWorld[1][0])<10 && one.rawHeadWorld[1][2]>.75);
    await until(()=>cameraMode,mode=>mode==='free','Free camera on entry');
    await game.setCamera('ring');
    await until(camera,v=>v?.anchors?.[1]?.inViewport&&!v.anchors[0]&&centered(v,1),'Single corner centered projection');
    assert.equal((await game.followTarget()).followSide,1);
    await until(camera,v=>v?.backs?.[1]?.length===4,'Red back logo in chase view');
    await game.setCamera('ring');
    assert.ok(join('Blue').joined);
    const both=await stage();
    assert.ok(both.floorGaps.every(gap=>Number.isFinite(gap)&&Math.abs(gap)<.025),'Both soles must meet the ring surface: '+both.floorGaps);
    console.log('Staged left/right boot clearances (world units):',JSON.stringify(both.shoeGaps));
    const planted=s=>s.shoeGaps.every(pair=>pair?.length===2&&pair.every(gap=>Number.isFinite(gap)&&Math.abs(gap)<.04));
    assert.ok(planted(both),'Each boot must be close to the canvas');
    assert.ok(both.rootDistance>=6);
    const moved=[false,false];
    const untilIdle=Date.now()+3700;
    do {
      await wait(150);
      const s=await sample();
      assert.equal(s.phase,'waiting');
      assert.deepEqual(s.health,[1,1]);
      assert.deepEqual(s.punches.map(p=>p.issued),[0,0]);
      assert.ok(planted(s),'Guard lifted a boot: '+JSON.stringify(s.shoeGaps));
      assert.ok(Math.abs(s.rootDistance-both.rootDistance)<.12,'Boxers left their corners before P');
      s.rawHeadWorld.forEach((head,side)=>{
        const travel=Math.hypot(...head.map((v,i)=>v-both.rawHeadWorld[side][i]));
        assert.ok(head[2]>.95&&travel<.12,'Waiting boxer lost the upright guard');
        if(travel>.004)moved[side]=true;
      });
    } while(Date.now()<untilIdle);
    assert.deepEqual(moved,[true,true],'Both standing guards must breathe before P');
    const view=await until(camera,v=>v?.anchors?.length===2&&v.anchors.every(a=>a?.inViewport),'Corner projections');
    const dist=v=>Math.hypot(...v.camera.position.map((p,i)=>p-view.camera.position[i]));
    await game.cameraZoom(2);
    const near=await until(camera,v=>v?.camera&&dist(v)>.25,'Zoom in');
    assert.equal(near.camera.fov,view.camera.fov);
    await game.cameraZoom(-2);
    await until(camera,v=>v?.camera&&dist(v)<.05,'Zoom out');
    assert.equal((await game.setCamera('free')).mode,'free');
    assert.equal((await game.setCamera('ring')).mode,'ring');
    console.log('Empty ring, both individual corners, waiting pose, zoom and free camera passed.');
    await game.startMatch();
    assert.ok(queue.startRound().accepted);
    const movement=await until(sample,s=>s.phase==='fighting'&&s.rootDistance<3,'Moving into range',22000);
    assert.deepEqual(movement.health,[1,1]);
    assert.deepEqual(movement.punches.map(p=>p.issued),[0,0]);
    const streak = (count, suffix, repeatEnd = false) => ({
      userId:'Blue', giftId:'5655', eventId:'series-' + suffix, giftType:1,
      streakId:'hundred-gifts', repeatCount:count, repeatEnd, coinUnit:1,
    });
    await dispatch(streak(5,'first'), 5);
    await dispatch(streak(20,'next'), 15);
    await dispatch(streak(100,'last'), 80);
    assert.deepEqual(queue.ingestGift(streak(100,'final',true)).actions, []);
    assert.deepEqual(queue.ingestGift(streak(20,'late')).actions, []);
    const landed=await until(sample,s=>s.health[1]<1&&hitCount>0,'Commanded contact damage',40000);
    console.log('Native contact confirmed; right health:',landed.health[1], 'left punches:',landed.punches[0].issued);
    if (!fullCombo && !process.argv.includes('--round')) return;
    const result=await until(sample,s=>s.phase==='finished','KO after separate punches', fullCombo ? 185000 : 30000);
    assert.equal(result.winner,'left');
    const expectedHits = 100 / blueDamage;
    assert.deepEqual(strikes, Array.from({length:expectedHits}, (_, i) =>
      [['swing',0,i+1], ['hit',1,blueDamage]]).flat());
    assert.deepEqual(result.health,[1,0]);
    console.log(`Verified ${expectedHits} separate punches at ${blueDamage} damage each before KO.`);
    queue.finishRound(result.winner);
    const restored=await stage();
    assert.deepEqual(restored.health,[1,null]);
    assert.deepEqual(restored.punches.map(p=>p.issued),[0,0]);
    await until(camera,v=>v?.anchors?.[0]?.inViewport&&!v.anchors[1]&&centered(v,0),'Winner alone centered in frame');
    assert.equal((await game.followTarget()).followSide,0);
    await until(camera,v=>v?.backs?.[0]?.length===4,'Winner back logo in chase view');
    await game.setCamera('ring');
    assert.ok(join('Challenger').joined);
    await stage();
    await game.startMatch();
    assert.ok(queue.startRound().accepted);
    const next=await until(sample,s=>s.phase==='fighting'&&s.rootDistance<3,'Second round movement',22000);
    assert.deepEqual(next.health,[1,1]);
    await dispatch(gift('Challenger','5269','challenger-attack',20));
    await until(sample,s=>s.health[0]<1,'New challenger landed a punch',35000);
    const earlyKnockout = await until(sample,s=>s.phase==='finished','KO before the gift series is spent',30000);
    assert.equal(earlyKnockout.winner, 'right');
    assert.equal(earlyKnockout.punches[1].issued, 7);
    queue.finishRound('right');
    assert.ok(join('Next').joined);
    const newPair = await stage();
    assert.deepEqual(newPair.health, [1,1]);
    assert.deepEqual(newPair.punches.map(p=>p.pending), [0,0]);
    console.log('Early KO stopped the 20-gift series after seven hits. Both new-round punch queues are empty.');
  } finally { await game.close(); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
