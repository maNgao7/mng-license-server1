'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const launcher='C:/Users/User/Documents/Codex/2026-09-29/imdi-bizim-bir-projemiz-vard-bir-2/outputs/launcher-update-7.0.15';
const {createGameLibrary}=require(launcher+'/lib/game-library.cjs'),{parseContentManifest}=require(launcher+'/lib/game-content.cjs');
const release='D:/TikMnG-Orbit-7.0.3-release',base='D:/TikMnG-mng-orbit-Widgets-7.0.2-preview.6',qa='D:/TikMnG-Orbit703QA-'+Date.now();
const descriptor=JSON.parse(fs.readFileSync(release+'/package-descriptor.json')),manifest=JSON.parse(fs.readFileSync(release+'/game-content-mng-orbit-7.0.3.json'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
parseContentManifest(manifest,{packageId:'mng-orbit',version:'7.0.3'});
for(const f of manifest.files){const bytes=fs.readFileSync(path.join(release,'package',f.path));assert.equal(hash(bytes),f.sha256,f.path);assert.equal(bytes.length,f.bytes);}
const paths=new Map(manifest.files.map(f=>['/'+f.sha256,path.join(release,'package',f.path)])),requests=[];
let localManifest;
const server=http.createServer((req,res)=>{
 requests.push(req.url);if(req.url==='/manifest'){res.end(localManifest);return;}
 const file=req.url==='/archive'?release+'/mng-orbit-7.0.3.zip':paths.get(req.url);
 if(!file){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Length':fs.statSync(file).size});fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 localManifest=Buffer.from(JSON.stringify({...manifest,files:manifest.files.map(f=>({...f,url:origin+'/'+f.sha256}))}));
 const progress=[];
 const library=createGameLibrary({root:qa+'/upgrade',definitions:{orbit:{klasor:'mng-orbit',paketSurumu:'7.0.3'}},
  resolveLegacy:()=>({path:base,version:'7.0.2'}),validate:directory=>fs.existsSync(path.join(directory,'server.js')),
  getPackage:()=>({...descriptor,url:origin+'/archive',files:[{path:'.tikmng-content.json',url:origin+'/manifest',bytes:localManifest.length,sha256:hash(localManifest)}]}),onProgress:p=>progress.push(p)});
 await library.install('orbit');const installed=library.pathFor('orbit'),done=progress.filter(p=>p.phase==='complete').at(-1);
 assert.equal(requests.filter(p=>p!=='/manifest').length,5);assert.ok(!requests.includes('/archive'));
 assert.equal(done.transferredBytes,descriptor.changedFileBytes);assert.ok(done.reusedBytes>400000000);
 for(const f of manifest.files)assert.equal(hash(fs.readFileSync(path.join(installed,f.path))),f.sha256,f.path);
 const fresh=createGameLibrary({root:qa+'/fresh',definitions:{orbit:{klasor:'mng-orbit',paketSurumu:'7.0.3'}},resolveLegacy:()=>null,
  validate:directory=>fs.existsSync(path.join(directory,'server.js')),getPackage:()=>({...descriptor,url:origin+'/archive',files:undefined})});
 await fresh.install('orbit');const freshDirectory=fresh.pathFor('orbit');
 assert.equal(JSON.parse(fs.readFileSync(path.join(freshDirectory,'.tikmng-package.json'))).version,'7.0.3');
 assert.ok(fs.existsSync(path.join(freshDirectory,'public/panel-visibility.js')));
 const result={passed:true,verifiedAt:new Date().toISOString(),manifestFiles:manifest.files.length,changedDownloads:5,
 transferredFileBytes:done.transferredBytes,reusedBytes:done.reusedBytes,productionUpdateTransferBytes:descriptor.updateTransferBytes,installed,freshDirectory,renderTransferBytes:0};
 fs.writeFileSync(release+'/INSTALL-VERIFICATION.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{server.closeAllConnections();server.close();});
