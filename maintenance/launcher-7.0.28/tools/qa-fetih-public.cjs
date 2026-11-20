'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {_electron}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const Conf=require('conf');
const root=path.resolve(__dirname,'..'),qa=path.resolve(root,'../qa'),profile=path.join(qa,'public-launcher-profile');
fs.mkdirSync(profile,{recursive:true});
const descriptor=require('../lib/catalog-defaults.json').games.find(g=>g.id==='fetih');
const definition=require('../lib/published-games.json').games.find(g=>g.id==='fetih').definition;
const {createGameLibrary}=require('../lib/game-library.cjs');
const {validatePackageDirectory}=require('../lib/fetih-package.cjs');
const zip=path.resolve(root,'../release/Fetih-Windows-x64.zip');
const store=new Conf({cwd:profile,configName:'mng-config',projectVersion:'7.0.28',encryptionKey:'mng-electron-secret-key-2024'});
const libraryRoot=path.join(profile,'games');
store.set({lisans_kod:'LOCAL-FETIH-QA',preview_initialized_v1:true,library_root_v1:libraryRoot,media_root_v1:path.join(profile,'media'),tiktok_active_account:'',tiktok_accounts:[],widget_announcements_v1:{'royal-widgets-20261028':true},game_announcements_v1:Object.fromEntries(require('../lib/published-games.json').games.map(g=>['game:'+g.id,true]))});
const server=http.createServer((req,res)=>{
 req.resume();
 if(req.url==='/fetih.zip'){res.writeHead(200,{'Content-Length':fs.statSync(zip).size});return fs.createReadStream(zip).pipe(res);}
 res.setHeader('Content-Type','application/json');
 if(req.url==='/api/license/check')return res.end(JSON.stringify({valid:true,isUnlimited:false,expiresAt:Date.now()+7200000,remainingSeconds:7200}));
 if(req.url==='/api/version')return res.end(JSON.stringify({latestVersion:'7.0.28',minVersion:'1.0.0'}));
 res.writeHead(404).end('{}');
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let app;
 try{
 const library=createGameLibrary({root:libraryRoot,definitions:{fetih:definition},validate:validatePackageDirectory,getPackage:()=>({...descriptor,url:'http://127.0.0.1:'+server.address().port+'/fetih.zip'})});
 const installed=await library.install('fetih');
 assert.equal(installed.installedVersion,'0.1.0');
 assert.ok(validatePackageDirectory(library.pathFor('fetih')));
 const env={...process.env,MNG_TEST_PROFILE:profile,MNG_WIDGET_PORT:'31987',MNG_LICENSE_SERVER:'http://127.0.0.1:'+server.address().port};delete env.ELECTRON_RUN_AS_NODE;
 const executable=process.env.MNG_QA_EXE||'D:/TikMnG-Genel-Guncelleme-20261112/launcher-release/node_modules/electron/dist/electron.exe';
 app=await _electron.launch({executablePath:executable,args:process.env.MNG_QA_EXE?[]:[root],env,timeout:60000});
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForFunction(()=>window.mngAPI?.workspace,null,{timeout:40000});
 await page.waitForFunction(async()=>{try{return (await window.mngAPI.workspace('snapshot')).games.some(g=>g.id==='fetih')}catch{return false}},null,{timeout:40000});
 const game=await page.evaluate(async()=> (await window.mngAPI.workspace('snapshot')).games.find(g=>g.id==='fetih'));
 assert.equal(game.installed,true);assert.equal(game.downloadReady,true);assert.equal(game.availableVersion,'0.1.0');assert.ok(game.giftGuide);assert.equal(game.cover,'fetih-v1');
 for(let i=0;i<15;i++){const close=page.locator('[data-announcement-close]:visible');if(!await close.count())break;await close.first().click();}
 await page.locator('[data-open="fetih"]').first().click();
 await page.locator('.game-detail-info h2').waitFor();
 assert.equal(await page.locator('link[href*="launcher-theme.css"]').count(),0,'Keep the released launcher palette');
 assert.ok((await page.locator('img').evaluateAll(images=>images.map(img=>img.getAttribute('src')||''))).every(src=>!src.includes('icon-v5')),'Keep the released brand icon');
 assert.equal((await page.locator('.game-setup li').allTextContents()).length,6);
 const steps=await page.locator('.game-setup').innerText();assert.ok(steps.includes('rehberini mutlaka'));assert.ok(steps.includes('500'));assert.ok(steps.includes('1.000'));assert.ok(steps.includes('saldır'));
 const png=path.join(qa,'saved-fetih-guide.png');
 await app.evaluate(({dialog},savePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:savePath});},png);
 const saved=await page.evaluate(()=>window.mngAPI.workspace('gift-guide-save',{id:'fetih'}));assert.equal(saved.saved,true);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(png)).digest('hex'),'9364b48c5fc83da761e47a7ee2e9ccf0e30cba0ac3d42b8a5482c73da561ce8f');
 await page.screenshot({path:path.join(qa,'fetih-launcher-detail.png'),fullPage:true});
 const first=await page.evaluate(()=>window.mngAPI.uygulamaAc('fetih',{tiktokUser:''}));assert.equal(first.basarili,true,JSON.stringify(first));
 const second=await page.evaluate(()=>window.mngAPI.uygulamaAc('fetih',{tiktokUser:''}));assert.equal(second.basarili,true,JSON.stringify(second));
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(qa,'public-launcher-result.json'),JSON.stringify({passed:true,mode:process.env.MNG_QA_EXE?'packaged':'source',publicNotAdminPreview:true,localArchiveTransport:true,gameVersion:game.availableVersion,steps:6,giftPngByteVerified:true,nativeStartup:true,repeatedPlayReusesSession:true,errors},null,2));
 console.log('FETIH_PUBLIC_LAUNCHER_OK: public entry, real ZIP install, six instructions, byte-matched gift download, native startup and repeat Play');
 }finally{await app?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
