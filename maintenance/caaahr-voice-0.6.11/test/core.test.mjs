import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {Settings,defaults,validate,validateGraphics,actions} from '../lib/settings.mjs';
import {Commands} from '../lib/commands.mjs';
import {GiftCatalog} from '../lib/catalog.mjs';
import {GiftDispatch} from '../lib/gift-dispatch.mjs';
import {EventLedger,normalize} from '../lib/events.mjs';
import {createServer} from '../server.mjs';
import {Spectators} from '../lib/spectators.mjs';

test('Curated defaults and removed action bindings preserve gifts without activating obsolete effects',()=>{
  const initial=defaults();assert.equal(initial.voice.sensitivity,.25);assert.equal(initial.voice.gameVolume,.5);assert.equal(initial.voice.autoMicrophone,true);assert.ok(Math.abs(initial.voice.automaticMaxSpeed*3.6-139)<.001);
  for(const action of ['gravity','brake','ice','bounce','repair','shield','jump','logs','wind']){assert.equal(actions.some(item=>item.id===action),false);const migrated=validate({...initial,rules:[{id:action,giftId:'5655',action,enabled:true,distance:17,duration:8,strength:3}]});assert.deepEqual(migrated.rules[0],{id:action,giftId:'5655',action,enabled:false,distance:17,duration:8,strength:3});}
});

test('Win targets accept whole counts, default for old saves and survive settings validation',()=>{
  assert.equal(defaults().track.winTarget,30);assert.equal(validate({...defaults(),track:{length:1000}}).track.winTarget,30);
  for(const winTarget of [1,10,20,30,50,999])assert.equal(validate({...defaults(),track:{length:500,winTarget}}).track.winTarget,winTarget);
  for(const winTarget of [0,-1,1000,1.5,'30',NaN])assert.throws(()=>validate({...defaults(),track:{length:500,winTarget}}));
});

test('Removed gravity bindings are disabled without losing saved gifts; appearance is validated',()=>{
  const value=defaults();value.rules=[{id:'legacy',giftId:'7934',action:'gravity',enabled:true},{id:'keep',giftId:'5655',action:'boost',enabled:true}];
  const migrated=validate(value);assert.equal(migrated.rules[0].giftId,'7934');assert.equal(migrated.rules[0].enabled,false);assert.equal(migrated.rules[1].enabled,true);assert.equal(actions.some(a=>a.id==='gravity'),false);
  assert.ok(actions.some(a=>a.id==='egg'));assert.ok(actions.some(a=>a.id==='release'));
  assert.deepEqual(validate({...defaults(),appearance:undefined}).appearance,defaults().appearance);
  assert.throws(()=>validate({...defaults(),appearance:{configured:true,style:'unknown',red:1,green:0,blue:0}}));
  assert.throws(()=>validate({...defaults(),appearance:{configured:true,style:'sport',red:1.1,green:0,blue:0}}));
});

test('Spectators use real join and interaction identities, bounded seats, expiry and session reset',()=>{
  let now=10000;const crowd=new Spectators({now:()=>now,limit:2,ttl:10000});
  crowd.accept({type:'connection',state:'connected',session:'a'});
  crowd.accept(normalize('member',{user:{uniqueId:'Viewer_1'}}));assert.deepEqual(crowd.snapshot(),[{username:'Viewer_1',avatar:'',cheering:false}]);
  crowd.accept(normalize('like',{uniqueId:'viewer_1',count:10}));assert.equal(crowd.snapshot().length,1);assert.equal(crowd.snapshot()[0].cheering,true);
  now+=5000;assert.equal(crowd.snapshot()[0].cheering,false);
  crowd.accept(normalize('chat',{uniqueId:'two',comment:'hello'}));crowd.accept(normalize('gift',{uniqueId:'three',giftId:'5655'}));assert.equal(crowd.snapshot().length,2);
  now+=11000;assert.equal(crowd.snapshot().length,0);
  crowd.accept(normalize('member',{uniqueId:'four'}));crowd.accept({type:'connection',state:'connecting',session:'b'});assert.equal(crowd.snapshot().length,0);
});

test('Settings persist atomically and reject invalid thresholds, parameters and duplicate rules',async()=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'caaahr-settings-'));assert.equal(path.dirname(temp),os.tmpdir());
  try{const file=path.join(temp,'settings.json'),store=await new Settings(file).load();const value=defaults();value.rules=[{id:'a',giftId:'5655',action:'jail',duration:8,distance:10,strength:2}];await store.save(value);assert.equal((await new Settings(file).load()).value.rules[0].duration,8);
    assert.throws(()=>validate({...value,voice:{...value.voice,fullDb:-47}}));assert.throws(()=>validate({...value,rules:[...value.rules,...value.rules]}));assert.throws(()=>validate({...value,voice:{...value.voice,maxSpeed:NaN}}));
    assert.equal(JSON.parse(await readFile(file,'utf8')).rules.length,1);
    const saved=JSON.parse(await readFile(file,'utf8'));delete saved.voice.gameVolume;
    assert.equal(validate(saved).voice.gameVolume,1);
    assert.equal(validate({...saved,voice:{...saved.voice,gameVolume:0}}).voice.gameVolume,0);
    assert.throws(()=>validate({...saved,voice:{...saved.voice,gameVolume:2}}));
    delete saved.voice.automatic;delete saved.voice.autoMicrophone;delete saved.voice.sensitivity;delete saved.voice.automaticMaxSpeed;
    const migrated=validate(saved);assert.equal(migrated.voice.automatic,true);assert.equal(migrated.voice.autoMicrophone,true);assert.equal(migrated.voice.automaticMaxSpeed,16);
    assert.deepEqual(migrated.rules,saved.rules);
    assert.throws(()=>validate({...migrated,voice:{...migrated.voice,automatic:'yes'}}));
    assert.throws(()=>validate({...migrated,voice:{...migrated.voice,sensitivity:2}}));
    assert.equal(validate({...migrated,voice:{...migrated.voice,automaticMaxSpeed:45}}).voice.automaticMaxSpeed,45);
    assert.throws(()=>validate({...migrated,voice:{...migrated.voice,automaticMaxSpeed:46}}));
    assert.equal(validate({...migrated,track:undefined}).track.length,1000);
    const trackValue={...migrated,track:{length:2500}};await store.save(trackValue);assert.equal((await new Settings(file).load()).value.track.length,2500);
    assert.deepEqual((await new Settings(file).load()).value.rules,migrated.rules);
    for(const length of [99,5001,250.5,NaN])assert.throws(()=>validate({...migrated,track:{length}}));
  }finally{await rm(temp,{recursive:true,force:true});}
});
test('Commands require an active race, expire, acknowledge once, and do not survive race/session changes',()=>{
  let now=1000;const c=new Commands(()=>now),rule={action:'jail',duration:10};assert.throws(()=>c.add(rule));
  c.heartbeat({session:'one',ready:true});const cmd=c.add(rule);assert.equal(c.heartbeat({session:'one',ready:true})[0].id,cmd.id);assert.equal(c.finish(cmd.id,true,'done'),true);assert.equal(c.finish(cmd.id,true),false);
  c.add(rule);c.heartbeat({session:'two',ready:true});assert.equal(c.pending.length,0);assert.equal(c.history[0].ok,false);
  c.add(rule);c.heartbeat({session:'two',ready:false});assert.equal(c.pending.length,0);
  c.heartbeat({session:'two',ready:true});c.add(rule);now+=16000;c.prune();assert.equal(c.pending.length,0);assert.equal(c.history[0].ok,false);assert.throws(()=>c.add(rule));
});
test('A gift held in a menu remains queued in diagnostics and a viewer named test is never a local preview',()=>{
  let now=Date.now()-60000;const commands=new Commands(()=>now);commands.heartbeat({session:'menu',ready:true,ui:true});
  const dispatch=new GiftDispatch({commands,settings:{value:{rules:[{enabled:true,giftId:'one',action:'slow',duration:3}]}},catalog:{enrich:e=>e}});
  dispatch.accept({id:'paused-gift',timestamp:now,type:'gift',giftId:'one',username:'test',count:1});
  for(let i=0;i<60;i++){now+=1000;commands.heartbeat({session:'menu',ready:true,ui:true});}
  assert.equal(commands.pending[0].source,'@test');assert.equal(dispatch.snapshot()[0].status,'queued');assert.match(dispatch.snapshot()[0].message,/Menü açık/);
  commands.finish(commands.pending[0].id,true,'applied after closing menu');assert.equal(dispatch.snapshot()[0].status,'applied');
});

test('Gift streak replay and final counts do not duplicate actions',()=>{
  const ledger=new EventLedger();const data={giftId:'5655',giftName:'Rose',giftType:1,repeatCount:1,groupId:'streak',uniqueId:'viewer',msgId:'one'};
  const first=ledger.accept(normalize('gift',data));const second=ledger.accept(normalize('gift',{...data,repeatCount:3,msgId:'two'}));const final=ledger.accept(normalize('gift',{...data,repeatCount:3,repeatEnd:true,msgId:'three'}));
  assert.equal((first?.count||0)+(second?.count||0)+(final?.count||0),3);
});

test('A live menu pause retains gifts, permits previews and still expires an abandoned game',()=>{
  let now=1000;const queue=new Commands(()=>now);queue.heartbeat({session:'paused',ready:true,ui:true});
  const gifts=Array.from({length:6},()=>queue.add({action:'slow',duration:3},'viewer'));
  for(let i=0;i<60;i++){now+=1000;queue.heartbeat({session:'paused',ready:true,ui:true});}
  assert.equal(queue.pending.length,6);assert.equal(queue.history.length,0);
  const preview=queue.add({action:'boost',duration:2});assert.equal(queue.heartbeat({session:'paused',ready:true,ui:true})[0].id,preview.id);queue.finish(preview.id,true,'preview');
  queue.heartbeat({session:'paused',ready:true,ui:false});assert.equal(queue.pending[0].id,gifts[0].id);
  now+=16000;queue.prune();assert.equal(queue.pending.length,0);
  queue.heartbeat({session:'paused',ready:true,ui:true});queue.add({action:'slow',duration:3},'viewer');now+=16000;queue.prune();assert.equal(queue.pending.length,0);
});
test('Local API exposes 686 gifts, rejects external origins and unauthenticated game commands, routes a real connector event to a saved rule',async()=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'caaahr-api-'));assert.equal(path.dirname(temp),os.tmpdir());
  let connection;const app=await createServer({data:temp,createConnection:()=>{connection=new EventEmitter();connection.connect=async()=>({});connection.disconnect=()=>{};return connection;}});
  try{const address=await app.listen(0),origin=`http://127.0.0.1:${address.port}`;const token=(await readFile(path.join(temp,'token'),'utf8')).trim();
    const post=(route,body,auth=false)=>fetch(origin+route,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
    assert.equal((await fetch(origin+'/api/state',{headers:{Origin:'https://evil.example'}})).status,403);
    assert.equal((await post('/mod/poll',{session:'test',ready:true})).status,403);
    assert.equal((await fetch(origin+'/mod/state')).status,403);
    const gameState=await fetch(origin+'/mod/state',{headers:{Authorization:'Bearer '+token}}).then(r=>r.json());
    assert.equal(gameState.product,'tikmng-caaahr-voice');assert.equal(gameState.protocol,15);
    const gameGifts=await fetch(origin+'/mod/gifts',{headers:{Authorization:'Bearer '+token}}).then(r=>r.json());
    assert.ok(gameGifts.gifts.length>=680);
    assert.equal((await post('/mod/poll',{session:'test',ready:true,processId:123,menuReady:true,catalogCount:686,version:'0.5.2'},true)).status,200);
    const boot=await fetch(origin+'/api/state').then(r=>r.json());assert.equal(boot.game.processId,123);assert.equal(boot.game.menuReady,true);assert.equal(boot.game.catalogCount,686);assert.equal(boot.game.version,'0.5.2');
    const gifts=await fetch(origin+'/api/gifts').then(r=>r.json());assert.ok(gifts.length>=680);assert.ok(gifts.every((g,i)=>!i||g.coins>=gifts[i-1].coins));
    const gift=gifts.find(g=>g.origName==='Rose')||gifts[0],settings=defaults();settings.rules=[{id:'rule',giftId:gift.id,action:'jail',duration:7,distance:10,strength:2}];await app.settings.save(settings);
    assert.equal((await post('/mod/settings',settings,true)).status,200);
    assert.equal((await post('/api/test',{id:'rule'})).status,200);let poll=await post('/mod/poll',{session:'test',ready:true},true).then(r=>r.json());assert.equal(poll.commands[0].duration,7);
    await post('/mod/ack',{id:poll.commands[0].id,ok:true,message:'done'},true);assert.equal(app.commands.pending.length,0);
    assert.equal(app.live.snapshot().status,'disconnected');
    const appearance={configured:true,style:'rally',red:.1,green:.6,blue:.9},beforeGarage=structuredClone(app.settings.value);
    assert.equal((await post('/mod/appearance',appearance)).status,403);
    assert.equal((await post('/mod/appearance',appearance,true)).status,200);
    assert.deepEqual(app.settings.value.voice,beforeGarage.voice);assert.deepEqual(app.settings.value.rules,beforeGarage.rules);assert.deepEqual(app.settings.value.graphics,beforeGarage.graphics);assert.deepEqual((await new Settings(path.join(temp,'settings.json')).load()).value.appearance,appearance);
    assert.equal((await post('/mod/appearance',{...appearance,red:-1},true)).status,400);
    assert.equal((await post('/mod/test-action',{action:'gravity'},true)).status,400);
    const direct=await post('/mod/test-action',{action:'forward',distance:17},true).then(r=>r.json());
    assert.equal(direct.distance,17);assert.equal(direct.source,'test');
    await post('/mod/ack',{id:direct.id,ok:true},true);
    for(const action of ['forward','backward']){
      for(const distance of [1,17.5,100,250,500,5000]){
        const response=await post('/mod/test-action',{action,distance},true);assert.equal(response.status,200);
        const command=await response.json();assert.equal(command.action,action);assert.equal(command.distance,distance);
        await post('/mod/ack',{id:command.id,ok:true},true);
      }
      for(const distance of [0,5001])assert.equal((await post('/mod/test-action',{action,distance},true)).status,400);
    }
    const explosion=await post('/mod/test-action',{action:'explode'},true).then(r=>r.json());assert.equal(explosion.duration,10);await post('/mod/ack',{id:explosion.id,ok:true},true);
    for(const action of ['gravity','brake','ice','bounce','repair','shield','jump','logs','wind'])assert.equal((await post('/mod/test-action',{action},true)).status,400);
    for(const {id:action} of actions){
      const request=await post('/mod/test-action',{action,duration:3,strength:2},true);assert.equal(request.status,200);
      const command=await request.json();assert.equal(command.action,action);assert.equal(command.duration,3);
      const pending=await post('/mod/poll',{session:'test',ready:true},true).then(r=>r.json());assert.equal(pending.commands[0].id,command.id);
      await post('/mod/ack',{id:command.id,ok:true,message:'native effect applied'},true);assert.equal(app.commands.pending.length,0);
    }
    const beforePreview=await readFile(path.join(temp,'settings.json'),'utf8');
    const unsaved=await post('/mod/test-action',{id:'new-unsaved-rule',giftId:'7934',action:'forward',distance:23},true).then(r=>r.json());
    assert.equal(unsaved.distance,23);assert.equal(unsaved.action,'forward');assert.equal(await readFile(path.join(temp,'settings.json'),'utf8'),beforePreview);
    await post('/mod/ack',{id:unsaved.id,ok:true,message:'23 metres moved'},true);
    const simulated=await post('/mod/test-gift',{giftId:gift.id},true).then(r=>r.json());
    assert.equal(simulated.action,'jail');assert.equal(simulated.duration,7);
    await post('/mod/ack',{id:simulated.id,ok:true},true);
    assert.equal((await post('/mod/test-action',{action:'invalid'},true)).status,400);
    assert.equal((await post('/mod/test-action',{action:'jail',duration:999},true)).status,400);
    assert.equal((await post('/mod/test-gift',{giftId:'not-mapped'},true)).status,400);
    const ui=await post('/mod/poll',{session:'test',ready:true,ui:true,catalogLoaded:false},true).then(r=>r.json());
    assert.equal(ui.menu.actions.length,14);assert.deepEqual(ui.menu.actions,actions);assert.ok(ui.gifts.length>=680);
    app.live.connect('test_user');await app.live.pending;
    const {WebcastEvent}=await import('tiktok-live-connector');connection.emit(WebcastEvent.GIFT,{giftId:gift.tiktokIds[0],repeatCount:1,uniqueId:'viewer',msgId:'event1'});
    assert.ok(WebcastEvent.MEMBER);connection.emit(WebcastEvent.MEMBER,{uniqueId:'new_viewer',msgId:'join1'});
    const crowdState=await post('/mod/poll',{session:'test',ready:true},true).then(r=>r.json());assert.ok(crowdState.spectators.some(s=>s.username==='new_viewer'));assert.ok(crowdState.spectators.some(s=>s.username==='viewer'&&s.cheering));
    assert.equal(app.commands.pending.length,1);assert.equal(app.commands.pending[0].action,'jail');connection.emit(WebcastEvent.GIFT,{giftId:gift.tiktokIds[0],repeatCount:1,uniqueId:'viewer',msgId:'event1'});assert.equal(app.commands.pending.length,1);
    assert.equal(app.dispatch.snapshot()[0].status,'queued');
    await post('/mod/ack',{id:app.commands.pending[0].id,ok:true,message:'Actual game callback'},true);
    assert.equal(app.dispatch.snapshot()[0].status,'applied');assert.equal(app.dispatch.snapshot()[0].username,'viewer');
    connection.emit(WebcastEvent.GIFT,{giftId:'unknown',giftName:'Unmapped',repeatCount:1,uniqueId:'viewer',msgId:'event2'});
    assert.equal(app.dispatch.snapshot()[0].status,'unmapped');
    assert.equal((await fetch(origin+'/')).status,200);
    const preserved=structuredClone(app.settings.value),graphics={configured:true,mode:'windowed',width:1280,height:720,quality:2,vSync:0,frameLimit:90};
    assert.equal((await post('/mod/graphics',graphics)).status,403);
    assert.equal((await post('/mod/graphics',graphics,true)).status,200);
    assert.deepEqual(app.settings.value.rules,preserved.rules);assert.deepEqual(app.settings.value.voice,preserved.voice);assert.deepEqual(app.settings.value.track,preserved.track);
    assert.deepEqual((await new Settings(path.join(temp,'settings.json')).load()).value.graphics,graphics);
    assert.equal((await post('/mod/graphics',{...graphics,width:-1},true)).status,400);
  }finally{await app.close();await rm(temp,{recursive:true,force:true});}
});

test('Catalog fallback is exact and unambiguous; IDs always take priority',()=>{
  const catalog=new GiftCatalog('.');
  catalog.gifts=[{id:'a',name:'Gül',origName:'Rose',coins:1},{id:'b',name:'Gül',origName:'Rose',coins:5}];
  catalog.byId.set('old',catalog.gifts[0]);
  assert.equal(catalog.find('old','anything',5).id,'a');
  assert.equal(catalog.find('new','Rose',5).id,'b');
  assert.equal(catalog.find('new','Rose'),undefined);
  assert.equal(catalog.find('new','ros',1),undefined);
});

test('Gift diagnostics report inactive races and partial burst application honestly',()=>{
  const commands=new Commands(),settings={value:{rules:[{enabled:true,giftId:'a',action:'forward',distance:10}]}},catalog={enrich:e=>e};
  const dispatch=new GiftDispatch({commands,settings,catalog});
  const event={id:'one',timestamp:Date.now(),type:'gift',giftId:'a',username:'viewer',count:1};
  dispatch.accept(event);assert.equal(dispatch.snapshot()[0].status,'not_applied');
  commands.heartbeat({session:'test',ready:true});dispatch.accept({...event,id:'burst',count:105});
  assert.equal(commands.pending.length,100);
  for(const c of [...commands.pending])commands.finish(c.id,true,'done');
  const result=dispatch.snapshot()[0];assert.equal(result.status,'partial');assert.equal(result.applied,100);assert.equal(result.count,105);
  assert.match(result.message,/100\/105/);
});

test('Legacy settings preserve current display until explicitly configured; invalid display options are rejected',()=>{
  const legacy=defaults();delete legacy.graphics;assert.equal(validate(legacy).graphics.configured,false);
  const graphics={configured:true,mode:'fullscreen',width:1920,height:1080,quality:3,vSync:1,frameLimit:60};
  assert.deepEqual(validateGraphics(graphics),graphics);
  for(const invalid of [{mode:'unknown'},{width:0},{height:0},{quality:4},{quality:999},{vSync:2},{frameLimit:0},{width:1280.5}])assert.throws(()=>validateGraphics({...graphics,...invalid}));
});

test('Backward preserves its distance independently of restart, finish and timed turbo',()=>{
  const input=defaults();input.rules=[{id:'old',giftId:'7934',action:'backward',enabled:true,distance:17,duration:10,strength:2}];
  const normalized=validate(input);assert.equal(input.rules[0].action,'backward');assert.deepEqual(normalized.rules[0],input.rules[0]);
  assert.deepEqual(actions.map(a=>a.id).sort(),['explode','restart','forward','backward','finish','wheel','jail','release','boost','slow','invert','tornado','traffic','egg'].sort());
  for(const action of ['forward','backward']){assert.equal(actions.find(a=>a.id===action).parameter,'distance');assert.equal(actions.find(a=>a.id===action).unit,'metre');}
  assert.equal(actions.filter(a=>a.id==='restart').length,1);assert.deepEqual(actions.find(a=>a.id==='restart'),{id:'restart',name:'Başa döndür'});
  assert.deepEqual(actions.find(a=>a.id==='finish'),{id:'finish',name:'Bitişe ışınla'});
  for(const action of ['explode','boost','wheel','jail','release'])assert.equal(actions.find(a=>a.id===action).parameter,'duration');
  assert.equal(validate({...input,rules:[{id:'explode',giftId:'5655',action:'explode'}]}).rules[0].duration,10);
  const wheel={...input,rules:[{...input.rules[0],action:'wheel',duration:8}]};assert.equal(validate(wheel).rules[0].duration,8);assert.throws(()=>validate({...wheel,rules:[{...wheel.rules[0],duration:0}]}));
});

test('Offline menu offers the same action catalog as the online bridge',async()=>{
  const source=await readFile(new URL('../plugin/BridgeRecovery.cs',import.meta.url),'utf8');
  const catalog=source.match(/ActionSpec\[\] LocalActions\(\)\{return new\[\]\{([\s\S]*?)\};\}/)[1];
  const offline=[...catalog.matchAll(/new ActionSpec\{([^}]+)\}/g)].map(([,fields])=>Object.fromEntries([...fields.matchAll(/(\w+)=(?:"([^"]*)"|(true|false))/g)].map(([,key,value,boolean])=>[key,value??(boolean==='true')])));
  assert.deepEqual(offline,actions);
});

test('Removed gift bindings survive a save and load disabled beside a live backward binding',async()=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'caaahr-removed-'));
  try{
    const value=defaults();value.rules=['repair','shield','jump','logs','wind','backward'].map((action,index)=>({id:action,giftId:String(index+1),action,enabled:true,distance:23,duration:10,strength:2}));
    const file=path.join(temp,'settings.json');await new Settings(file).save(value);
    const loaded=(await new Settings(file).load()).value;
    assert.deepEqual(loaded.rules,value.rules.map(rule=>({...rule,enabled:rule.action==='backward'})));
  }finally{await rm(temp,{recursive:true,force:true});}
});
