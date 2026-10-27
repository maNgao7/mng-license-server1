import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { upgradedBootstrapState } from '../content-bootstrap.js';

const legacy=JSON.parse(fs.readFileSync(new URL('../content-bootstrap-6.5.17.json',import.meta.url),'utf8'));
const current=JSON.parse(fs.readFileSync(new URL('../content-defaults.json',import.meta.url),'utf8'));
const launcher706=JSON.parse(fs.readFileSync(new URL('../content-bootstrap-7.0.6.json',import.meta.url),'utf8'));
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

test('private Minecraft preview is not promoted by restarting the public server',()=>{
  assert.deepEqual(current,launcher706);
  assert.equal(upgradedBootstrapState({draft:current,published:current},launcher706,current,{allowReleasedBaseline:true}),null);
  for(const id of ['snow-war','battle-royale'])assert.equal(current.games.find(g=>g.id===id).version,'7.0.2');
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
