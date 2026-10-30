import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { upgradedBootstrapState } from '../content-bootstrap.js';

const legacy=JSON.parse(fs.readFileSync(new URL('../content-bootstrap-6.5.17.json',import.meta.url),'utf8'));
const current=JSON.parse(fs.readFileSync(new URL('../content-defaults.json',import.meta.url),'utf8'));
const launcher706=JSON.parse(fs.readFileSync(new URL('../content-bootstrap-7.0.6.json',import.meta.url),'utf8'));
const launcher707=JSON.parse(fs.readFileSync(new URL('../content-bootstrap-7.0.7.json',import.meta.url),'utf8'));
const launcher709=JSON.parse(fs.readFileSync(new URL('../content-bootstrap-7.0.9.json',import.meta.url),'utf8'));
const candidate=JSON.parse(fs.readFileSync(new URL('../maintenance/minecraft-rounds-7.0.3/qa/catalog-candidate.json',import.meta.url),'utf8'));

test('an explicitly approved Minecraft candidate upgrades exactly two packages, without a launcher or media update',()=>{
  const state={draft:structuredClone(launcher706),published:structuredClone(launcher706)};
  const upgraded=upgradedBootstrapState(state,launcher706,candidate,{allowReleasedBaseline:true});
  assert.ok(upgraded);
  const ids=['snow-war','battle-royale'];
  assert.deepEqual(upgraded.published.games.filter(g=>!ids.includes(g.id)),launcher706.games.filter(g=>!ids.includes(g.id)));
  assert.deepEqual(upgraded.published.launcher,launcher706.launcher);
  assert.deepEqual(upgraded.published.media,launcher706.media);
  for(const id of ids){
    const game=upgraded.published.games.find(g=>g.id===id);
    assert.equal(game.version,'7.0.3');
    assert.match(game.url,/\/minecraft-rounds-20261027\//);
  }
  assert.deepEqual(state.draft,launcher706);
  assert.equal(upgradedBootstrapState(upgraded,launcher706,candidate,{allowReleasedBaseline:true}),null);
});

test('the approved install repair advances the two Minecraft packages without changing gameplay or media',()=>{
  const current=launcher707;
  const baseline=JSON.parse(fs.readFileSync(new URL('../content-bootstrap-minecraft-7.0.3.json',import.meta.url),'utf8'));
  assert.deepEqual(baseline,candidate);
  const upgraded=upgradedBootstrapState({draft:structuredClone(baseline),published:structuredClone(baseline)},baseline,current,{allowReleasedBaseline:true});
  assert.deepEqual(upgraded.published,current);
  assert.deepEqual(current.games.filter(g=>!['snow-war','battle-royale'].includes(g.id)),baseline.games.filter(g=>!['snow-war','battle-royale'].includes(g.id)));
  assert.deepEqual(current.media,baseline.media);
  assert.deepEqual(current.launcher,launcher706.launcher);
  assert.equal(upgradedBootstrapState({draft:current,published:current},launcher706,current,{allowReleasedBaseline:true}),null);
  for(const id of ['snow-war','battle-royale'])assert.equal(current.games.find(g=>g.id===id).version,'7.0.4');
  for(const change of [state=>state.draft.games[0].title='Custom',state=>state.published.revision++]){
    const state={draft:structuredClone(baseline),published:structuredClone(baseline)};change(state);
    assert.equal(upgradedBootstrapState(state,baseline,current,{allowReleasedBaseline:true}),null);
  }
});

test('7.0.8 removes only Crowd Control and preserves every remaining game and media descriptor',()=>{
  const current=launcher709;
  assert.deepEqual(current.games,launcher707.games.filter(game=>game.id!=='crowd-control'));
  assert.deepEqual(current.media,launcher707.media);
  assert.deepEqual(current.launcher,launcher707.launcher);
  assert.equal(current.games.length,15);
  const state={draft:structuredClone(launcher707),published:structuredClone(launcher707)};
  const upgraded=upgradedBootstrapState(state,launcher707,current,{allowReleasedBaseline:true});
  assert.deepEqual(upgraded.published,current);
  assert.deepEqual(state.published,launcher707);
  assert.equal(upgradedBootstrapState(upgraded,launcher707,current,{allowReleasedBaseline:true}),null);
});

test('7.0.10 adds only Profile Contest and preserves administrator changes',()=>{
  assert.deepEqual(current.games.filter(game=>game.id!=='profile-contest'),launcher709.games);
  assert.deepEqual(current.media,launcher709.media);
  assert.deepEqual(current.launcher,launcher709.launcher);
  assert.equal(current.games.length,16);
  const state={draft:structuredClone(launcher709),published:structuredClone(launcher709)};
  assert.deepEqual(upgradedBootstrapState(state,launcher709,current,{allowReleasedBaseline:true}).published,current);
  state.draft.games[0].title='Custom';
  assert.equal(upgradedBootstrapState(state,launcher709,current,{allowReleasedBaseline:true}),null);
});

test('Minecraft release retains customized published state and pending administrator edits',()=>{
  for(const change of [state=>state.draft.games[0].title='Custom',state=>state.published.games[0].title='Custom',state=>state.draft.revision++,state=>state.published.media.pop()]){
    const state={draft:structuredClone(launcher706),published:structuredClone(launcher706)};
    change(state);
    assert.equal(upgradedBootstrapState(state,launcher706,candidate,{allowReleasedBaseline:true}),null);
  }
});

test('untouched 7.0.5 receives snake 0.16.0 without changing other game packages',()=>{
  const old=JSON.parse(fs.readFileSync(new URL('../content-bootstrap-7.0.5.json',import.meta.url),'utf8'));
  const upgraded=upgradedBootstrapState({draft:structuredClone(old),published:structuredClone(old)},old,launcher706,{allowReleasedBaseline:true});
  assert.equal(upgraded.published.games.find(g=>g.id==='minecraft-snake-arena').version,'0.16.0');
  assert.deepEqual(upgraded.published.games.filter(g=>g.id!=='minecraft-snake-arena'),old.games.filter(g=>g.id!=='minecraft-snake-arena'));
});
test('untouched 7.0.4 catalog receives both urgent game packages; customized catalogs stay unchanged',()=>{
  const previous=JSON.parse(fs.readFileSync(new URL('../content-bootstrap-7.0.4.json',import.meta.url),'utf8'));
  const state={draft:structuredClone(previous),published:structuredClone(previous)};
  const upgraded=upgradedBootstrapState(state,previous,current,{allowReleasedBaseline:true});
  assert.equal(upgraded.published.games.find(g=>g.id==='frog-river').version,'7.0.5');
  assert.equal(upgraded.published.games.find(g=>g.id==='caahr').version,'0.6.12');
  state.draft.games[0].title='Custom';assert.equal(upgradedBootstrapState(state,previous,current,{allowReleasedBaseline:true}),null);
});
test('only untouched legacy bootstrap upgrades to the current game/media release',()=>{
  const state={draft:structuredClone(legacy),published:structuredClone(legacy)};
  const next=upgradedBootstrapState(state,legacy,current);
  assert.equal(next.published.games.length,current.games.length);assert.equal(next.published.media.length,285);
  assert.deepEqual(state.draft,legacy);assert.notEqual(next.draft,next.published);
});

test('the exact 7.0.1 baseline upgrades once; customized released catalogs are retained',()=>{
  const previous=JSON.parse(fs.readFileSync(new URL('../content-bootstrap-7.0.1.json',import.meta.url),'utf8'));
  const state={draft:structuredClone(previous),published:structuredClone(previous)};
  const next=upgradedBootstrapState(state,previous,current,{allowReleasedBaseline:true});
  if(current.revision>previous.revision){assert.equal(next.published.revision,current.revision);assert.equal(next.published.games.length,current.games.length);}
  state.draft.games[0].title='Publisher custom title';
  assert.equal(upgradedBootstrapState(state,previous,current,{allowReleasedBaseline:true}),null);
});
test('administrator revisions, changed fields, custom media and unpublished edits are never replaced',()=>{
  for(const change of [state=>state.draft.revision++,state=>state.published.revision++,state=>state.draft.games[0].title='Custom',state=>state.published.games[0].description='Custom',state=>state.draft.media.push({id:'custom'}),state=>state.published.launcher={version:'8.0.0'}]){
    const state={draft:structuredClone(legacy),published:structuredClone(legacy)};change(state);
    assert.equal(upgradedBootstrapState(state,legacy,current),null);
  }
});
test('already upgraded state is retained without a second migration',()=>{
  assert.equal(upgradedBootstrapState({draft:current,published:current},legacy,current),null);
});
