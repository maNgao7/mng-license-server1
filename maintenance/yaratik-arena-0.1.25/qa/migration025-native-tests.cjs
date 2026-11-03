'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const directory=path.resolve(process.argv[2]),file=path.join(directory,'userdata/mod-settings.json');
assert.ok(directory.toLowerCase().startsWith('d:\\tikmng-arena'));
const original=fs.readFileSync(file),settings=JSON.parse(original),checks=[];
process.env.TIKMNG_ARENA_QA_ROOT=path.join(directory,'qa');const q=require('./commands.cjs');
let game;
async function stop(){
 if(!game||game.exitCode!==null)return;
 try{await q.send('quit');}catch{}
 await new Promise((resolve,reject)=>{if(game.exitCode!==null)return resolve();game.once('exit',resolve);setTimeout(()=>reject(new Error('Migration test game did not quit')),15000).unref();});
}
(async()=>{
 let error;
 try{
  for(const test of [{value:1,flag:false,expected:3},{value:7,flag:false,expected:7},{value:1,flag:true,expected:1}]){
   const fixture={...settings,BroadcasterUsername:'qa_migration',AutoConnect:false,CreatureDamage:test.value};
   if(test.flag)fixture.NormalCombatV2Added=true;else delete fixture.NormalCombatV2Added;
   fs.writeFileSync(file,JSON.stringify(fixture,null,2));
   game=spawn(path.join(directory,"game/Can 'Em All Demo.exe"),[],{cwd:path.join(directory,'game'),stdio:'ignore'});
   await q.wait(s=>s.processId===game.pid&&s.version==='0.1.25'&&s.ready,'Migration boot',60000);
   const after=JSON.parse(fs.readFileSync(file));
   assert.equal(after.CreatureDamage,test.expected);assert.equal(after.NormalCombatV2Added,true);
   assert.deepEqual(after,{...fixture,CreatureDamage:test.expected,NormalCombatV2Added:true});
   checks.push('Old damage '+test.value+', migrated '+test.flag+' -> '+test.expected+'; every other saved field preserved');
   await stop();
  }
 }catch(e){error=e.stack;process.exitCode=1;}
 finally{
  try{await stop();}catch(e){error=error||e.stack;process.exitCode=1;}
  fs.writeFileSync(file,original);
  const result={passed:!error,timestamp:new Date().toISOString(),checks,error};
  fs.writeFileSync(path.join(directory,'qa/migration025-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }
})();
