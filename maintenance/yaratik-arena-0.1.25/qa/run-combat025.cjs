'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const directory=path.resolve(process.argv[2]);
if(!directory.toLowerCase().startsWith('d:\\tikmng-arena')||!fs.existsSync(path.join(directory,'manifest.json')))throw new Error('Installed isolated QA directory required');
process.env.TIKMNG_ARENA_QA_ROOT=path.join(directory,'qa');process.env.TIKMNG_QA_VERSION='0.1.25';
const q=require('./commands.cjs');
let game;
async function suite(name){
 await new Promise((resolve,reject)=>{
  const c=spawn(process.execPath,[path.join(__dirname,name)],{cwd:path.join(directory,'qa'),env:process.env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';for(const stream of [c.stdout,c.stderr])stream.on('data',b=>output+=b);
  c.once('error',reject);c.once('exit',code=>{fs.writeFileSync(path.join(directory,'qa',name+'.log'),output);console.log(name+': '+(code===0?'PASS':'FAIL'));code===0?resolve():reject(new Error(output.slice(-6000)));});
 });
}
(async()=>{
 try{
  game=spawn(path.join(directory,"game/Can 'Em All Demo.exe"),[],{cwd:path.join(directory,'game'),stdio:'ignore'});
  game.once('error',e=>{throw e;});
  await q.wait(s=>s.processId===game.pid&&s.ready&&s.version==='0.1.25','New native game process',60000);
  for(const name of process.argv.slice(3).length?process.argv.slice(3):['combat025-native-tests.cjs','balance-native-tests.cjs','ammo-native-tests.cjs','pursuit-tests.cjs','final-event-tests.cjs','death-reset-hotfix-tests.cjs'])await suite(name);
 }finally{
  if(game&&game.exitCode===null){try{await q.send('quit');}catch{}await new Promise((resolve,reject)=>{if(game.exitCode!==null)return resolve();game.once('exit',resolve);setTimeout(()=>reject(new Error('Native game did not exit')),15000).unref();});}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
