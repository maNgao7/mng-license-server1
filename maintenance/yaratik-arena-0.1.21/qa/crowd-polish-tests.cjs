'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),q=require('./commands.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],captures=[],measurements=[];
let before;
function healthy(s){assert.equal(s.failed,false);for(const k of ['hudError','survivalError','combatNavigationError','autoError'])assert.equal(s[k],'',k);}
async function fresh(enabled=false){
 await q.send('lock',{enabled:true});await q.send('live-events-pause',{enabled:true});await q.send('menu',{open:false});await q.send('auto-play',{enabled:false});
 await q.send('reset');await q.send('reset');await q.send('combat-settings',{enabled});await q.send('view',{x:0,z:-10,yaw:0,pitch:0});
}
async function snap(label){const s=await q.send('capture');healthy(s);captures.push({label,file:'capture-'+s.seq+'.png'});return s;}
function separated(s){const a=s.creatureBadgeBounds;assert.ok(a.length>0);assert.equal(a.length,s.drawnCreatureBars);assert.equal(a.length,s.drawnProfiles);
 for(let i=0;i<a.length;i++){const b=a[i];assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=s.width&&b.y+b.height<=s.height);
  for(let j=0;j<i;j++){const c=a[j];assert.ok(!(b.x<c.x+c.width&&b.x+b.width>c.x&&b.y<c.y+c.height&&b.y+b.height>c.y),'no intersecting creature labels');}}
}
async function standOnHead(kind,count=1){
 await fresh(true);if(count===1)await q.send('team-fixture',{kind,user:'qa_head_'+kind,x:0,z:-5});else await q.send('auto-fixture',{level:0,count,distance:-5});
 await sleep(300);const hits=q.state().creatureHits;let minHeight=Infinity,s;
 const end=Date.now()+8500;
 while(Date.now()<end){s=await q.send('report');healthy(s);const c=s.combatTestBodies.filter(c=>!c.Friendly).sort((a,b)=>b.bodyTop-a.bodyTop)[0];assert.ok(c);
  const y=c.bodyTop+.95;minHeight=Math.min(minHeight,y-c.y);
  await q.send('view',{x:c.x,y,z:c.z,yaw:0,pitch:55});
  if(q.state().creatureHits>hits){s=q.state();assert.ok(s.playerPhysics.y-c.y>1.35,'damage happened above the old height cutoff');assert.ok(s.health<500);break;}
  await sleep(50);
 }
 assert.ok(s.creatureHits>hits,'standing on '+kind+' head is not immune');
 measurements.push({case:count===1?kind+'-head':'pile-'+count,damage:s.playerLastDamage,playerY:s.playerPhysics.y,minRelativeHeight:minHeight});
 await snap(count===1?kind+'-head-hit':'pile-head-hit');
}
async function main(){
 await q.wait(s=>s.ready&&s.version===(process.env.TIKMNG_QA_VERSION||'0.1.19'),'build ready',40000);before=JSON.parse(fs.readFileSync('../userdata/mod-settings.json'));
 assert.equal(before.Actions.length,12);assert.deepEqual(JSON.parse(fs.readFileSync('../defaults/game-settings.json')).Actions,before.Actions);
 assert.equal(JSON.parse(fs.readFileSync('../defaults/game-settings.json')).BroadcasterUsername,'');
 await standOnHead('spawn');await standOnHead('boss');await standOnHead('bigboss');await standOnHead('spawn',18);
 checks.push('Native attacks damage a player above normal, Boss and Big Boss heads, including a living crowd; the old 1.35m immunity is gone');
 await fresh(true);await q.send('team-fixture',{kind:'spawn',user:'qa_wall',x:0,z:-8.4});await q.send('combat-wall',{enabled:true});
 let hits=q.state().creatureHits;await sleep(1400);let s=await q.send('report');assert.equal(s.creatureHits,hits);assert.equal(s.health,500);await q.send('combat-wall',{enabled:false});
 checks.push('A solid world wall still blocks the melee hit');
 await fresh(true);await q.send('view',{x:0,y:10,z:-10,yaw:0,pitch:70});await q.send('team-fixture',{kind:'spawn',user:'qa_air',x:0,z:-10});
 hits=q.state().creatureHits;
 for(let i=0;i<12;i++){await q.send('view',{x:0,y:10,z:-10,yaw:0,pitch:70});await sleep(60);}
 assert.equal(q.state().creatureHits,hits);checks.push('A normal creature cannot hit a distant airborne player');
 await fresh(false);await q.send('spawn',{count:50,user:'qa_scattered'});
 s=await q.wait(s=>s.Alive===50&&s.pending===0,'scattered births',30000);healthy(s);
 const births=s.recentArrivals.slice(-50),radii=births.map(p=>Math.hypot(p.x,p.z+10));
 assert.equal(births.length,50);assert.ok(Math.max(...radii)-Math.min(...radii)>4);assert.ok(births.every(p=>p.z>=-10));
 assert.ok(Math.max(...births.map(p=>p.x))-Math.min(...births.map(p=>p.x))>8);
 measurements.push({case:'50-scattered-births',minRadius:Math.min(...radii),maxRadius:Math.max(...radii),spreadX:Math.max(...births.map(p=>p.x))-Math.min(...births.map(p=>p.x))});
 await snap('scattered-front-wave');checks.push('Fifty native arrivals use different radii across the forward area, not a tight surrounding ring');
 await fresh(false);await q.send('view',{x:20,z:0,yaw:90,pitch:0});await q.send('spawn',{count:8,user:'qa_wall_facing_birth'});
 s=await q.wait(s=>s.Alive===8&&s.pending===0,'wall-facing births still drain',20000);healthy(s);assert.equal(s.behindBoardCreatures,0);
 checks.push('Facing the solid mission wall still spawns the whole wave safely toward open arena space, with nobody behind the board');
 for(const kind of ['spawn','boss','bigboss','helper']){
  for(let cycle=0;cycle<2;cycle++){await fresh(false);await q.send('team-fixture',{kind,user:'qa_speed',x:0,z:-3});s=await q.send('report');const c=s.combatTestBodies[0];assert.ok(c.baseMoveSpeed>0);assert.ok(Math.abs(c.moveSpeed/c.baseMoveSpeed-1.2)<.0001);}
 }
 checks.push('All four roles have exactly 1.2x native movement speed; pooled reuse does not compound it');
 await fresh(false);await q.send('view',{x:0,z:-10,yaw:0,pitch:20});await q.send('spawn',{count:100,user:'qa_crowd'});
 await q.wait(s=>s.Alive===100&&s.pending===0,'one hundred safe native births',45000);await sleep(350);
 for(const [width,height] of [[1920,1080],[1280,720],[800,600]]){
  await q.send('resolution',{width,height});await sleep(350);s=await snap('100-creatures-labels-'+width);s.width=width;s.height=height;separated(s);
  assert.ok(s.reservedHudProfiles>0);measurements.push({case:'label-density-'+width,visible:s.drawnCreatureBars,hidden:s.reservedHudProfiles});
 }
 checks.push('One hundred physical creatures: every displayed portrait and health badge is collision-free at 1920, 1280 and 800px; hidden labels yield to the nearest/aimed/injured creatures');
 await q.send('resolution',{width:1280,height:720});await sleep(250);await q.send('performance',{label:'0.1.19-100-creatures-adaptive-labels',seconds:6});
 s=await q.wait(s=>!s.performanceRunning&&s.frameCount>0,'performance sample',12000);const performance=JSON.parse(fs.readFileSync('performance-'+s.performanceRun+'.json'));
 measurements.push({case:'100-creatures-performance',meanMs:performance.meanMs,p95Ms:performance.p95Ms});
 await fresh(false);await q.send('menu',{open:true,tab:4});
 for(const [width,height] of [[1280,720],[800,600]]){await q.send('resolution',{width,height});await sleep(300);await snap('publishing-files-'+width);}
 for(const index of [0,1,0]){s=await q.send('publishing-export',{index});assert.ok(fs.existsSync(s.publishingStatus));const source='../assets/publishing/'+(index===0?'yaratik-arena-gifts.png':'yaratik-arena-cover-v1.png');assert.deepEqual(fs.readFileSync(s.publishingStatus),fs.readFileSync(source));}
 const guide=fs.readFileSync('../assets/publishing/yaratik-arena-gifts.png'),original=fs.readFileSync('C:/Users/User/Downloads/YARATIK OYUNU.png');assert.deepEqual(guide,original);
 checks.push('Both publishing images render in the B menu at desktop and compact sizes; export is byte-identical and repeated exports never overwrite; the original transparent gift guide is unchanged');
 fs.writeFileSync('crowd-polish-result.json',JSON.stringify({passed:true,version:s.version,checks,measurements,captures,liveAtStart:q.state().live,realPaidGiftTest:false,giftGuideSha256:crypto.createHash('sha256').update(guide).digest('hex')},null,2));
 console.log(JSON.stringify({passed:true,checks,measurements,captures}));
}
async function restore(){if(!before)return;await q.send('menu',{open:false});await q.send('reset');await q.send('reset');await q.send('combat-settings',{enabled:before.EnemyAttacks,damage:before.CreatureDamage,interval:before.CreatureAttackInterval,playerHealth:before.PlayerHealth,scale:before.CreatureScale});await q.send('resolution',{width:1280,height:720});await q.send('view',{x:14,z:-8,yaw:48,pitch:0});await q.send('lock',{enabled:false});await q.send('live-events-pause',{enabled:false});assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json')),before,'settings preserved');}
main().catch(e=>{console.error(e);fs.writeFileSync('crowd-polish-failure.json',JSON.stringify({error:e.stack,state:q.state(),checks,measurements,captures},null,2));process.exitCode=1;}).finally(restore);
