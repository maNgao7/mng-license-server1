'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../qa');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const profile=fs.mkdtempSync(path.join(out,'profile-'));
 const source=path.join(process.env.APPDATA,'mng-tiktok-game/mng-config.json');
 fs.copyFileSync(source,path.join(profile,'mng-config.json'));
 const Store=require('electron-store');const store=new Store({cwd:profile,name:'mng-config',projectVersion:'7.0.25',encryptionKey:'mng-electron-secret-key-2024'});
 store.set('preview_initialized_v1',true);store.set('library_root_v1',path.join(profile,'games'));store.set('library_previous_paths_v1',{});store.set('media_root_v1',path.join(profile,'media'));store.set('media_studio_v1',{version:1,items:[]});store.set('tiktok_active_account','');store.set('tiktok_accounts',[]);store.delete('widget_access_key');store.delete('overlay_installation_v1');
 const env={...process.env,MNG_TEST_PROFILE:profile,MNG_WIDGET_PORT:'31986',MNG_QA_STARTUP_FILE:path.join(out,'startup.json')};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:process.env.MNG_QA_EXE||'D:/TikMnG-Genel-Guncelleme-20261112/launcher-release/node_modules/electron/dist/electron.exe',args:[...(process.env.MNG_QA_EXE?[]:[root]),'--tikmng-preview'],env,timeout:60000});
 try{
  const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.waitForFunction(()=>window.mngAPI?.workspace,null,{timeout:45000});
  await page.waitForFunction(async()=>{try{return (await window.mngAPI.workspace('snapshot')).games.length>0}catch{return false}},null,{timeout:45000});
  const snapshot=await page.evaluate(async()=>{const s=await window.mngAPI.workspace('snapshot');return {version:s.version,games:s.games.map(g=>({id:g.id,cover:g.cover,steamDemo:g.steamDemo,guide:!!g.giftGuide}))}});
  assert.ok(snapshot.games.some(g=>g.id==='hapisten-kac'));for(const id of ['battle-game','penalty-kick','tightrope-balance'])assert.ok(!snapshot.games.some(g=>g.id===id));
  await page.locator('.library-card').first().waitFor();await page.waitForTimeout(1000);
  for(let i=0;i<12;i++){const close=page.locator('[data-announcement-close]:visible');if(!await close.count())break;await close.first().click();await page.waitForTimeout(120);}
  await page.screenshot({path:path.join(out,'launcher.png')});
  const card=page.locator('[data-open="hapisten-kac"]');
  if(await card.count()){await card.first().click();await page.waitForTimeout(300);}
  else await page.evaluate(()=>document.querySelector('[data-game-id="hapisten-kac"]')?.click());
  await page.locator('.game-detail-info h2').waitFor();await page.waitForFunction(async()=>!(await window.mngAPI.workspace('snapshot')).games.find(g=>g.id==='hapisten-kac').steamDemo.checking);
  await page.locator('[data-action="arena-demo-refresh"]').click();
  await page.waitForFunction(async()=>!(await window.mngAPI.workspace('snapshot')).games.find(g=>g.id==='hapisten-kac').steamDemo.checking);
  await page.waitForFunction(()=>document.querySelector('.game-detail-info')?.textContent.includes('Steam demosu kurulu.'),null,{timeout:15000});
  await page.screenshot({path:path.join(out,'hapisten-kac-detail.png')});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'launcher-result.json'),JSON.stringify({passed:true,isolatedProfile:true,snapshot,errors},null,2));
  console.log(JSON.stringify({passed:true,version:snapshot.version,games:snapshot.games.length,errors}));
 }finally{await app.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
