import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {defaults,standardRules,rulesRevision,Settings,validate} from '../lib/settings.mjs';
import {Commands} from '../lib/commands.mjs';
import {GiftDispatch} from '../lib/gift-dispatch.mjs';
test('guide defaults preserve actual distance tiers and time parameters',()=>{
  const rules=standardRules();assert.equal(rules.length,13);
  for(const action of ['forward','backward'])assert.deepEqual(rules.filter(rule=>rule.action===action).map(rule=>rule.distance),[50,250,500]);
  assert.equal(rules.find(rule=>rule.action==='tornado').distance,25);
  assert.deepEqual(rules.filter(rule=>['jail','release'].includes(rule.action)).map(({giftId,action,duration})=>({giftId,action,duration})),[
    {giftId:'6064',action:'jail',duration:1},{giftId:'5827',action:'release',duration:1}
  ]);
  for(const action of ['explode','boost'])assert.equal(rules.find(rule=>rule.action===action).duration,10);
  assert.equal(rules.find(rule=>rule.action==='finish').giftId,'6427','user confirmed Hat and Mustache');assert.ok(rules.every(rule=>rule.enabled));
  assert.deepEqual(validate(defaults()).rules,rules);
});
test('native fresh offline standards match the bridge without replacing saved or cached rules',async()=>{
  const source=await readFile(new URL('../plugin/BridgeRecovery.cs',import.meta.url),'utf8');
  const catalog=source.match(/GiftRule\[\] LocalStandardRules\(\)\{return new\[\]\{([\s\S]*?)\};\}/)[1];
  const offline=[...catalog.matchAll(/new GiftRule\{([^}]+)\}/g)].map(([,fields])=>({enabled:true,distance:10,duration:10,strength:2,...Object.fromEntries([...fields.matchAll(/(\w+)=(?:"([^"]*)"|(\d+))/g)].map(([,key,value,number])=>[key,value??Number(number)]))}));
  assert.deepEqual(offline,standardRules());
  assert.match(source,/if\(local==null\|\|local.voice==null\)local=cache!=null\?cache.settings:null;/);
  assert.match(source,/draft=local!=null&&local.voice!=null\?local:new ModSettings\{voice=new VoiceSettings\(\),rules=LocalStandardRules\(\)\};/);
  assert.match(source,/if\(draft.rules==null\)draft.rules=new GiftRule\[0\];/);
});
test('one-second standards persist across restart and reach dispatched gift commands',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'voice-standard-'));
  try{
    const file=path.join(root,'settings.json'),store=await new Settings(file).load();await store.save(store.value);
    const settings=await new Settings(file).load(),commands=new Commands();commands.heartbeat({session:'standard-test',ready:true});
    const dispatch=new GiftDispatch({commands,settings,catalog:{enrich:event=>event}});
    for(const giftId of ['6064','5827'])dispatch.accept({id:giftId,type:'gift',giftId,count:1,username:'viewer',timestamp:Date.now()});
    assert.deepEqual(commands.pending.map(({action,duration})=>({action,duration})),[{action:'jail',duration:1},{action:'release',duration:1}]);
    assert.deepEqual(settings.value.rules,standardRules());
  }finally{await rm(root,{recursive:true,force:true});}
});
test('saved custom cage assignments and explicit duration choices survive restart unchanged',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'voice-standard-'));
  try{
    const file=path.join(root,'settings.json'),value=defaults();
    value.rules=[
      {...standardRules().find(rule=>rule.action==='jail'),duration:10},
      {...standardRules().find(rule=>rule.action==='release'),duration:23},
      {id:'custom-jail',giftId:'5655',action:'jail',enabled:true,distance:17,duration:8,strength:3},
      {id:'custom-release',giftId:'5827',action:'release',enabled:false,distance:10,duration:10,strength:2}
    ];
    await new Settings(file).save(value);
    const before=await readFile(file,'utf8'),reloaded=await new Settings(file).load();
    assert.deepEqual(reloaded.value.rules,value.rules);assert.equal(await readFile(file,'utf8'),before);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('saved rules survive reload and standards require explicit current revision confirmation',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'voice-standard-'));
  try{
    const store=await new Settings(path.join(root,'settings.json')).load();const settings=defaults();settings.rules=[{...standardRules()[0],duration:23}];await store.save(settings);
    const reloaded=await new Settings(store.file).load();assert.equal(reloaded.value.rules[0].duration,23);
    await assert.rejects(reloaded.applyStandard(),/onaylayın/);
    await assert.rejects(reloaded.applyStandard({confirmReplacement:true,revision:'stale'}),/onaylayın/);
    await reloaded.applyStandard({confirmReplacement:true,revision:rulesRevision(reloaded.value.rules)});
    assert.deepEqual(JSON.parse(await readFile(store.file,'utf8')).rules,standardRules());
    assert.deepEqual((await new Settings(store.file).load()).value.rules,standardRules());
  }finally{await rm(root,{recursive:true,force:true});}
});
