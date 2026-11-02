'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),q=require('./commands.cjs');
const saved=JSON.parse(fs.readFileSync('settings-before-0.1.8.json','utf8'));
const gifts=JSON.parse(fs.readFileSync('../catalog/gifts.json','utf8'));
const byId=new Map(gifts.map(g=>[g.id,g]));
const checks=[],captures=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
const index=saved.Actions.findIndex(a=>a.Op==='spawn');assert.ok(index>=0);
async function drawn(){return q.wait(s=>s.tab===2&&s.menuRendered&&s.catalogEventsPending===0&&s.catalogVisibleIds.length>0,'catalog repaint',5000);}
async function snap(label){const s=await q.send('capture');captures.push({label,file:`capture-${s.seq}.png`});return s;}
async function wheel(delta){const before=q.state().catalogScroll;await q.send('catalog-input',{kind:'wheel',delta});return q.wait(s=>s.catalogEventsPending===0&&(delta>0?s.catalogScroll>before||s.catalogScroll===s.catalogScrollMax:s.catalogScroll<before||s.catalogScroll===0),'wheel',5000);}
function sorted(s){const coins=s.catalogVisibleIds.map(id=>byId.get(id).coins);for(let i=1;i<coins.length;i++)assert.ok(coins[i]>=coins[i-1]);}
async function restore(){
  await q.send('catalog-back');
  for(let i=0;i<saved.Actions.length;i++)await q.send('binding',{index:i,giftId:saved.Actions[i].GiftId,count:saved.Actions[i].Count});
  await q.send('menu',{open:false});await q.send('reset');
  await q.send('crowd-settings',{total:saved.MaxCreatures,physical:saved.PhysicalCreatures,timed:saved.TimedMode,seconds:saved.RoundSeconds,target:saved.KillTarget,winGoal:saved.WinGoal});
  await q.send('resolution',{width:1280,height:720});await q.send('lock',{enabled:false});await q.send('live-events-pause',{enabled:false});
}
async function main(){
  await q.wait(s=>s.ready&&!s.failed&&s.version==='0.1.8','list build',45000);
  await q.send('live-events-pause',{enabled:true});await q.send('native-resume');await q.send('catalog-open',{index});
  let s=await drawn();assert.equal(s.catalogDisplay,'scroll-list');assert.equal(s.catalogActionCount,saved.Actions[index].Count);
  assert.equal(s.catalogFilteredCount,gifts.length);assert.equal(s.catalogScroll,0);
  assert.ok(s.catalogVisibleIds.length>=4&&s.catalogVisibleIds.length<=8);assert.ok(s.loadedGiftTextures<gifts.length/4);sorted(s);
  assert.equal(byId.get(s.catalogVisibleIds[0]).coins,Math.min(...gifts.map(g=>g.coins)));
  await snap('action-picker-desktop');
  checks.push('Action opens a single sorted list, retaining its count and loading only visible thumbnails');
  const first=s.catalogVisibleIds[0];s=await wheel(9);assert.notEqual(s.catalogVisibleIds[0],first);sorted(s);
  s=await wheel(100000);assert.equal(s.catalogScroll,s.catalogScrollMax);sorted(s);
  const lastId=s.catalogVisibleIds.at(-1);assert.equal(byId.get(lastId).coins,Math.max(...gifts.map(g=>g.coins)));
  await snap('last-gifts');
  s=await wheel(-100000);assert.equal(s.catalogScroll,0);
  checks.push('Native scroll-wheel events reach the highest-coin gifts and return to the first row without paging');
  await q.send('catalog-input',{kind:'down',ratio:.02});await q.wait(s=>s.catalogDragging,'thumb down');
  await q.send('catalog-input',{kind:'drag',ratio:.6});await q.wait(s=>s.catalogEventsPending===0&&s.catalogScroll>s.catalogScrollMax*.4,'thumb drag');
  await q.send('catalog-input',{kind:'up',ratio:.6});await q.wait(s=>!s.catalogDragging&&s.catalogEventsPending===0,'thumb release');
  checks.push('Scrollbar thumb supports actual pointer down, drag and release events');
  await q.send('catalog-input',{kind:'down',ratio:.6});await q.wait(s=>s.catalogDragging,'drag before close');
  await q.send('menu',{open:false});assert.equal(q.state().catalogDragging,false);
  await q.send('catalog-open',{index});await drawn();
  checks.push('Closing during a scrollbar drag releases pointer capture and the next picker opens normally');
  await q.send('catalog-search',{text:'5655'});s=await q.wait(s=>s.catalogSearch==='5655'&&s.catalogScroll===0&&s.catalogVisibleIds.includes('5655'),'ID filter');
  assert.ok(s.catalogVisibleIds.every(id=>id.includes('5655')||byId.get(id).coins===5655));await snap('gift-id-search');
  await q.send('catalog-search',{text:'__no_gift_matches__'});s=await q.wait(s=>s.catalogFilteredCount===0&&s.catalogVisibleIds.length===0,'empty search');
  assert.equal(s.catalogScrollMax,0);await snap('no-results');
  await q.send('catalog-back');assert.equal(q.state().tab,1);
  assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8')),saved);
  checks.push('Search resets scroll, ID filtering works, empty state renders, and cancel changes no assignments or amounts');
  await q.send('catalog-open',{index});await drawn();await wheel(100000);s=await drawn();
  const selectedId=s.catalogVisibleIds.at(-1);await q.send('catalog-choose',{row:s.catalogVisibleIds.length-1});
  assert.equal(q.state().tab,1);
  let current=JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8'));
  assert.equal(current.Actions[index].GiftId,selectedId);assert.equal(current.Actions[index].Count,saved.Actions[index].Count);
  for(let i=0;i<saved.Actions.length;i++)if(i!==index)assert.deepEqual(current.Actions[i],saved.Actions[i]);
  await q.send('catalog-open',{index});await drawn();assert.equal(q.state().catalogActionCount,saved.Actions[index].Count);await q.send('catalog-back');
  await q.send('menu',{open:false});await q.send('reset');await q.send('gift',{id:selectedId,repeatCount:2,user:'qa_catalog'});
  const expected=Math.min(saved.MaxCreatures,saved.Actions[index].Count*2);await q.wait(s=>s.Alive+s.pending===expected,'selected exact gift action');
  checks.push('Choosing a row saves its exact gift ID on the original action; amount survives and repeated gift dispatch uses it');
  await q.send('reset');
  await q.send('catalog-open',{index:-1});await q.send('catalog-search',{text:'5655'});await q.wait(s=>s.catalogVisibleIds.includes('5655'),'simulation gift');
  await q.send('catalog-choose',{row:q.state().catalogVisibleIds.indexOf('5655')});
  assert.equal(q.state().tab,0);assert.equal(q.state().selectedGift,'5655');
  assert.equal(JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8')).Actions[index].GiftId,selectedId);
  checks.push('The same list selects a simulation gift without modifying any action mapping');
  await q.send('resolution',{width:800,height:600});await sleep(500);await q.send('catalog-open',{index});await drawn();await snap('action-picker-compact');
  await wheel(300);await snap('compact-scrolled');
  assert.equal(q.state().hudError,'');assert.equal(q.state().failed,false);
  await restore();
  assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8')),saved);
  fs.writeFileSync('catalog-list-result.json',JSON.stringify({passed:true,checks,captures,settingsPreserved:true},null,2));
  console.log(JSON.stringify({passed:true,checks,captures}));
}
main().catch(async e=>{fs.writeFileSync('catalog-list-result.json',JSON.stringify({passed:false,error:e.stack,checks,captures,state:q.state()},null,2));try{await restore();}catch{}console.error(e);process.exitCode=1;});
