'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const q=require('./commands.cjs');
const checks=[];
const captured=s=>s.focused&&s.cursorLock==='Locked'&&!s.cursorVisible;
async function main(){
  await q.wait(s=>s.ready&&!s.failed&&'cursorLock' in s,'Mouse build boot',45000);
  await q.send('lock',{enabled:true});await q.send('menu',{open:false});
  await q.wait(captured,'Focused gameplay captures mouse',20000);
  checks.push('Focused gameplay hides and locks the real Unity cursor');
  await q.send('cursor-release');await q.wait(captured,'Cursor recovers after native release',3000);
  checks.push('Gameplay recovers from a cursor state restored by native pause code');
  await q.send('menu',{open:true,tab:3,optionPage:1});
  await q.wait(s=>s.menu&&s.cursorLock==='None'&&s.cursorVisible,'B releases mouse');
  checks.push('B settings release the mouse for controls');
  await q.send('menu',{open:false});await q.wait(captured,'Closing B recaptures mouse');
  await q.send('escape');await q.wait(s=>s.nativeMenu&&s.cursorLock==='None'&&s.cursorVisible,'ESC releases mouse');
  checks.push('ESC releases the mouse for the original settings');
  await q.send('native-resume');await q.wait(captured,'Original Resume recaptures mouse');
  checks.push('Original Resume returns to captured gameplay');
  await q.send('lock',{enabled:false});
  fs.writeFileSync('mouse-result.json',JSON.stringify({passed:true,checks,state:q.state()},null,2));
  console.log(JSON.stringify({passed:true,checks}));
}
main().catch(async error=>{fs.writeFileSync('mouse-result.json',JSON.stringify({passed:false,error:error.stack,checks,state:q.state()},null,2));try{await q.send('menu',{open:false});await q.send('native-resume');await q.send('lock',{enabled:false});}catch{}console.error(error);process.exitCode=1;});
