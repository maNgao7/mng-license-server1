'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {createPreviewPackages}=require('../lib/preview-package.cjs');
test('preview archive is authenticated, range capable and never exposed in stable',async()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-preview-package-'));
    const file=path.join(root,'snake.zip'),bytes=Buffer.from('PK-test-verified-package-bytes');fs.writeFileSync(file,bytes);
    const game={id:'minecraft-snake-arena',adminOnly:true,version:'0.15.0',package:{localArchive:file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}};
    let packages;const key='isolated-local-test-key';
    const server=http.createServer((req,res)=>{if(!packages.handleRequest(req,res,new URL(req.url,'http://localhost'))){res.writeHead(404);res.end();}});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
    try{
        packages=createPreviewPackages({enabled:true,games:[game],port,accessKey:key});
        const descriptor=packages.descriptor(game.id);assert.equal(descriptor.sha256,game.package.sha256);assert.equal(descriptor.bytes,bytes.length);assert.equal(descriptor.version,'0.15.0');
        assert.equal((await fetch(descriptor.url.replace(key,'wrong'))).status,403);
        assert.equal((await fetch(descriptor.url,{method:'POST'})).status,405);
        const normal=await fetch(descriptor.url);assert.equal(normal.status,200);assert.deepEqual(Buffer.from(await normal.arrayBuffer()),bytes);
        const head=await fetch(descriptor.url,{method:'HEAD'});assert.equal(head.headers.get('content-length'),String(bytes.length));assert.equal((await head.arrayBuffer()).byteLength,0);
        const partial=await fetch(descriptor.url,{headers:{Range:'bytes=3-8'}});assert.equal(partial.status,206);assert.deepEqual(Buffer.from(await partial.arrayBuffer()),bytes.subarray(3,9));
        assert.equal((await fetch(descriptor.url,{headers:{Range:'bytes=999-'}})).status,416);
        assert.equal((await fetch(descriptor.url,{headers:{Range:'bytes=0-1,4-5'}})).status,416);
        fs.appendFileSync(file,'changed');assert.equal((await fetch(descriptor.url)).status,409);
        assert.equal(createPreviewPackages({enabled:true,games:[game],port,accessKey:key}).descriptor(game.id),null);
        fs.writeFileSync(file,bytes);
        packages=createPreviewPackages({enabled:false,games:[game],port,accessKey:key});assert.equal(packages.descriptor(game.id),null);assert.equal((await fetch(descriptor.url)).status,403);
        assert.equal(createPreviewPackages({enabled:true,games:[{...game,adminOnly:false}],port,accessKey:key}).descriptor(game.id),null);
        for(const p of [{...game.package,sha256:'bad'},{...game.package,bytes:-1},{...game.package,localArchive:'relative.zip'}])assert.equal(createPreviewPackages({enabled:true,games:[{...game,package:p}],port,accessKey:key}).descriptor(game.id),null);
    }finally{server.closeAllConnections();await new Promise(r=>server.close(r));assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('tikmng-preview-package-'));fs.rmSync(root,{recursive:true,force:true});}
});

test('preview content updates transfer only changed files while preserving another game and settings',async t=>{
    const {buildPreviewContent}=require('../tools/build-preview-content.cjs');
    const {createGameLibrary}=require('../lib/game-library.cjs');
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-preview-content-'));
    const key='test-content-key',requests=[];let packages;
    const server=http.createServer((req,res)=>{requests.push(new URL(req.url,'http://localhost').pathname);if(!packages.handleRequest(req,res,new URL(req.url,'http://localhost')))res.writeHead(404).end();});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const port=server.address().port,games=[];
    t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));assert.equal(path.dirname(root),os.tmpdir());assert.ok(path.basename(root).startsWith('tikmng-preview-content-'));fs.rmSync(root,{recursive:true,force:true});});
    async function publish(id,version,text){
        const stage=path.join(root,id+'-'+version);fs.mkdirSync(stage);
        fs.writeFileSync(path.join(stage,'run.txt'),text);fs.writeFileSync(path.join(stage,'runtime.bin'),Buffer.alloc(8192,7));fs.writeFileSync(path.join(stage,'empty.txt'),'');
        const file=stage+'.zip',bytes=Buffer.from('PK-unused-fallback');fs.writeFileSync(file,bytes);
        const entry={id,version,adminOnly:true,package:{localArchive:file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),...await buildPreviewContent(stage,id,version)}};
        const index=games.findIndex(g=>g.id===id);if(index<0)games.push(entry);else games[index]=entry;
        packages=createPreviewPackages({enabled:true,games,port,accessKey:key});return entry;
    }
    const alpha=await publish('alpha','1.0.0','old');await publish('beta','1.0.0','untouched');
    const progress=[];
    const installContexts=[];
    const options={root:path.join(root,'library'),definitions:{alpha:{id:'alpha',klasor:'alpha'},beta:{id:'beta',klasor:'beta'}},getPackage:(id,context)=>{if(context)installContexts.push({id,...context});return packages.descriptor(id);},validate:directory=>fs.existsSync(path.join(directory,'run.txt')),preservePaths:()=>['settings.json'],onProgress:p=>progress.push(p)};
    const library=createGameLibrary(options);await library.install('alpha');await library.install('beta');
    const old=library.pathFor('alpha'),beta=library.pathFor('beta');fs.writeFileSync(path.join(old,'settings.json'),'{"gift":"5655"}');
    const before=requests.length;await publish('alpha','1.0.1','new');await library.install('alpha');
    assert.equal(library.pathFor('beta'),beta);assert.equal(fs.readFileSync(path.join(beta,'run.txt'),'utf8'),'untouched');
    const next=library.pathFor('alpha');assert.equal(fs.readFileSync(path.join(next,'settings.json'),'utf8'),'{"gift":"5655"}');assert.equal(fs.readFileSync(path.join(next,'run.txt'),'utf8'),'new');
    const transfers=requests.slice(before).filter(p=>p.includes('/file/'));assert.equal(transfers.length,1,'only changed executable bytes requested');
    assert.deepEqual(installContexts,[{id:'alpha',hasExisting:false},{id:'beta',hasExisting:false},{id:'alpha',hasExisting:true}]);
    assert.ok(!requests.some(p=>p.endsWith('.zip')),'content route never downloads full archive');
    assert.ok(progress.some(p=>p.updateMode==='content'&&p.reusedBytes>=8192&&p.totalBytes===3));
    const descriptor=packages.descriptor('alpha');const response=await fetch(descriptor.files[0].url);assert.equal(response.status,200);
    const manifest=await response.json();assert.ok(manifest.files.every(f=>f.url.startsWith(`http://127.0.0.1:${port}/tikmng/admin-package/alpha/file/`)));
    assert.equal((await fetch(manifest.files[0].url.replace(key,'bad'))).status,403);
    assert.equal((await fetch(manifest.files[0].url,{method:'POST'})).status,405);
    assert.equal((await fetch(`http://127.0.0.1:${port}/tikmng/admin-package/alpha/file/${'0'.repeat(64)}?key=${key}`)).status,404);
    const bytes=fs.readFileSync(alpha.package.localContentManifest);fs.appendFileSync(alpha.package.localContentManifest,' ');
    assert.equal(createPreviewPackages({enabled:true,games:[alpha],port,accessKey:key}).descriptor('alpha'),null,'index tampering fails closed');
    fs.writeFileSync(alpha.package.localContentManifest,bytes);
});

test('trusted aliases keep a common physical package identity in their content manifest',async()=>{
    const {buildPreviewContent}=require('../tools/build-preview-content.cjs');
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-preview-alias-'));
    try{
        fs.writeFileSync(path.join(root,'run.txt'),'alias fixture');
        const zip=root+'.zip';fs.writeFileSync(zip,'PK-fixture');
        const descriptor={packageId:'shared-game',localArchive:zip,bytes:10,sha256:crypto.createHash('sha256').update('PK-fixture').digest('hex'),...await buildPreviewContent(root,'shared-game','1.0.0')};
        const entries=['first','second'].map(id=>({id,adminOnly:true,version:'1.0.0',package:descriptor}));
        const packages=createPreviewPackages({enabled:true,games:entries,port:5000,accessKey:'synthetic-key'});
        assert.ok(packages.descriptor('first')?.files);assert.ok(packages.descriptor('second')?.files);
        assert.equal(createPreviewPackages({enabled:true,games:[{...entries[0],package:{...descriptor,packageId:'wrong-package'}}],port:5000,accessKey:'synthetic-key'}).descriptor('first'),null);
    }finally{
        assert.equal(path.dirname(root),os.tmpdir());assert.ok(path.basename(root).startsWith('tikmng-preview-alias-'));
        fs.rmSync(root,{recursive:true,force:true});fs.rmSync(root+'.zip',{force:true});fs.rmSync(root+'.content.json',{force:true});
    }
});

test('content indexing does not traverse every leaf at startup, but linked reads still fail closed',async t=>{
    const {buildPreviewContent}=require('../tools/build-preview-content.cjs');
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-preview-lazy-')),stage=path.join(root,'stage');fs.mkdirSync(stage);
    t.after(()=>{assert.equal(path.dirname(root),os.tmpdir());assert.ok(path.basename(root).startsWith('tikmng-preview-lazy-'));fs.rmSync(root,{recursive:true,force:true});});
    fs.mkdirSync(path.join(stage,'nested'));fs.writeFileSync(path.join(stage,'nested','run.txt'),'trusted');
    const archive=path.join(root,'fixture.zip');fs.writeFileSync(archive,'PK-fixture');
    const item={id:'alpha',adminOnly:true,version:'1.0.0',package:{localArchive:archive,bytes:10,sha256:crypto.createHash('sha256').update('PK-fixture').digest('hex'),...await buildPreviewContent(stage,'alpha','1.0.0')}};
    const key='lazy-path-key';let packages;
    const server=http.createServer((req,res)=>{if(!packages.handleRequest(req,res,new URL(req.url,'http://qa')))res.writeHead(404).end();});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
    const leaf=path.resolve(stage,'nested/run.txt'),original=fs.lstatSync;let leafChecks=0;
    fs.lstatSync=function(file,...rest){if(path.resolve(String(file))===leaf)leafChecks++;return original.call(this,file,...rest);};
    try{packages=createPreviewPackages({enabled:true,games:[item],port:server.address().port,accessKey:key});}finally{fs.lstatSync=original;}
    assert.ok(packages.descriptor('alpha'));assert.equal(leafChecks,0,'No filesystem leaf walk while building the trusted index');
    const manifest=await fetch(packages.descriptor('alpha').files[0].url).then(response=>response.json()),url=manifest.files.find(file=>file.path==='nested/run.txt').url;
    assert.equal(await fetch(url).then(response=>response.text()),'trusted');
    fs.renameSync(path.join(stage,'nested'),path.join(stage,'before-nested'));
    const outside=path.join(root,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'run.txt'),'outside');
    fs.symlinkSync(outside,path.join(stage,'nested'),process.platform==='win32'?'junction':'dir');
    assert.equal((await fetch(url)).status,404,'A changed ancestor junction is refused at the actual read');
});
