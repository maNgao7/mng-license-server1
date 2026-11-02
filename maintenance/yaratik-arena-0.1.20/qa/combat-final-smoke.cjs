'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),q=require('./commands.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let before;
async function main(){
 await q.wait(s=>s.ready&&s.version==='0.1.18'&&s.processId===Number(process.argv[2]),'final build ready',40000);
 before=JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8'));
 await q.send('lock',{enabled:true});await q.send('live-events-pause',{enabled:true});await q.send('menu',{open:false});await q.send('auto-play',{enabled:false});await q.send('reset');await q.send('reset');
 await q.send('combat-settings',{enabled:false});await q.send('view',{x:0,z:0,yaw:0,pitch:0});
 await q.send('auto-fixture',{level:0,count:50,distance:10});await sleep(350);
 let s=await q.send('capture');const capture='capture-'+s.seq+'.png';assert.equal(s.Alive,50);assert.ok(s.drawnCreatureBars>0);assert.equal(s.failed,false);assert.equal(s.hudError,'');
 await q.send('performance',{label:'0.1.18-50-creatures-healthbars',seconds:6});
 s=await q.wait(s=>!s.performanceRunning&&s.frameCount>0,'performance done',12000);
 const performance=JSON.parse(fs.readFileSync('performance-'+s.performanceRun+'.json','utf8'));
 fs.writeFileSync('combat-final-smoke-result.json',JSON.stringify({passed:true,version:s.version,capture,drawnCreatureBars:s.drawnCreatureBars,alive:s.Alive,performance},null,2));
 console.log(JSON.stringify({passed:true,alive:s.Alive,bars:s.drawnCreatureBars,meanMs:performance.meanMs,p95Ms:performance.p95Ms,capture}));
}
async function restore(){if(!before)return;await q.send('reset');await q.send('reset');await q.send('combat-settings',{enabled:before.EnemyAttacks,damage:1,playerHealth:500});await q.send('view',{x:14,z:-8,yaw:48,pitch:0});await q.send('lock',{enabled:false});await q.send('live-events-pause',{enabled:false});}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(restore);
