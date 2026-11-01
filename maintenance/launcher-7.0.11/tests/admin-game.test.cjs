'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createPlatform } = require('../lib/platform.cjs');
const os = require('node:os');

test('Snake appears only in preview, carries real assets, refuses pending downloads and persists announcement dismissal', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-admin-game-'));
    let platform;
    t.after(() => { platform?.close(); fs.rmSync(root, { recursive: true, force: true }); });
    const values = new Map(), handlers = new Map();
    const manifest = require('../lib/admin-games.json').games[0];
    const originalPackage = manifest.package;
    manifest.package = null;
    t.after(() => { manifest.package = originalPackage; });
    const context = { app: { getPath: name => path.join(root, name), getVersion: () => 'qa' },
        store: { get: (key, fallback) => values.has(key) ? values.get(key) : fallback, set: (key, value) => values.set(key, value) },
        ipcMain: { handle: (name, fn) => handlers.set(name, fn) }, dialog: {}, getWindow: () => null,
        definitions: { [manifest.id]: { ...manifest.definition, ad: manifest.title } },
        getChannel: () => 'synthetic-qa', serverURL: () => 'https://qa.invalid', accessKey: 'test', port: 12345,
        validate: () => false, extract: () => assert.fail('No install expected') };
    platform = createPlatform(context);
    assert.deepEqual(platform.snapshot().games, []);
    assert.deepEqual(platform.snapshot().gameAnnouncements, []);
    assert.equal((await handlers.get('workspace-install')({}, { id: manifest.id })).basarili, false);
    platform.close(); handlers.clear(); context.app.isTikMNGPreview = true;
    platform = createPlatform(context);
    const snapshot = platform.snapshot(), game = snapshot.games[0];
    assert.equal(game.id, manifest.id);
    assert.equal(game.minecraft, true);
    assert.equal(game.cover, 'minecraft-yilan-cover-v2');
    assert.equal(game.giftGuide.sha256, 'f39ea8825a25daf60a4b984ffc7dd5078838f3d580622dd8bf240b9b930f42f5');
    assert.equal(game.downloadReady, false);
    assert.equal((await handlers.get('workspace-install')({}, { id: manifest.id })).basarili, false);
    assert.equal(snapshot.gameAnnouncements.length, 1);
    assert.deepEqual(await handlers.get('workspace-announcement-dismiss')({}, { id: manifest.announcementId }), { ok: true });
    assert.deepEqual(platform.snapshot().gameAnnouncements, []);
});

test('fresh preview uses one archive; an existing installation uses verified content repair',async t=>{
    const http=require('node:http'),crypto=require('node:crypto');
    const {buildPreviewContent}=require('../tools/build-preview-content.cjs');
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-first-package-'));
    const stage=path.join(root,'stage');fs.mkdirSync(stage);fs.writeFileSync(path.join(stage,'run.txt'),'game');
    const archive=stage+'.zip';
    await new Promise((resolve,reject)=>{const out=fs.createWriteStream(archive),zip=require('archiver')('zip');out.on('close',resolve);out.on('error',reject);zip.on('error',reject);zip.pipe(out);zip.directory(stage,false);zip.finalize();});
    const game=require('../lib/admin-games.json').games[0],oldPackage=game.package,oldVersion=game.version;
    game.version='0.0.1';game.package={localArchive:archive,bytes:fs.statSync(archive).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),...await buildPreviewContent(stage,game.id,game.version)};
    let platform;const requests=[],handlers=new Map(),values=new Map([['media_root_v1',path.join(root,'media')],['library_root_v1',path.join(root,'games')]]);
    const server=http.createServer((req,res)=>{requests.push(req.url);if(!platform.handleRequest(req,res,new URL(req.url,'http://localhost')))res.writeHead(404).end();});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(async()=>{platform?.close();game.package=oldPackage;game.version=oldVersion;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));assert.equal(path.dirname(root),os.tmpdir());fs.rmSync(root,{recursive:true,force:true});});
    platform=createPlatform({app:{isTikMNGPreview:true,getPath:name=>path.join(root,name),getVersion:()=> 'qa'},store:{get:(key,fallback)=>values.has(key)?values.get(key):fallback,set:(key,value)=>values.set(key,value)},ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},dialog:{},getWindow:()=>null,definitions:{[game.id]:{...game.definition,ad:game.title}},getChannel:()=>'',serverURL:()=> 'https://qa.invalid',accessKey:'fixture-key',port:server.address().port,validate:dir=>fs.existsSync(path.join(dir,'run.txt'))});
    let result=await handlers.get('workspace-install')({}, {id:game.id});assert.equal(result.basarili,true,result.hata);
    assert.equal(requests.filter(url=>url.includes('.zip?')).length,1);
    assert.equal(requests.filter(url=>url.includes('/manifest?')).length,0);
    const before=requests.length;
    result=await handlers.get('workspace-install')({}, {id:game.id,repair:true});assert.equal(result.basarili,true,result.hata);
    assert.equal(requests.slice(before).filter(url=>url.includes('.zip?')).length,0);
    assert.equal(requests.slice(before).filter(url=>url.includes('/manifest?')).length,1);
    assert.equal(requests.slice(before).filter(url=>url.includes('/file/')).length,0,'unchanged files reused');
});

test('preview-only package overrides keep existing public game artwork and instructions metadata', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-admin-existing-'));
    const manifest = require('../lib/admin-games.json');
    const original = manifest.games;
    manifest.games = [{ id: 'snow-war', version: '7.0.2-preview.1', adminOnly: true, package: null }];
    let platform;
    t.after(() => { platform?.close(); manifest.games = original; fs.rmSync(root, { recursive: true, force: true }); });
    platform = createPlatform({ app: { isTikMNGPreview: true, getPath: name => path.join(root, name), getVersion: () => 'qa' },
        store: { get: (_, fallback) => fallback, set() {} }, ipcMain: { handle() {} }, dialog: {}, getWindow: () => null,
        definitions: { 'snow-war': { id: 'snow-war', klasor: 'snow-war', ad: 'Snow War', minecraft: true, paketSurumu: '6.5.16' } },
        getChannel: () => 'synthetic-qa', serverURL: () => 'https://qa.invalid', accessKey: 'test', port: 12345,
        validate: () => false, extract: () => assert.fail('No install expected') });
    const game = platform.snapshot().games[0];
    const published = require('../lib/catalog-defaults.json').games.find(game => game.id === 'snow-war');
    assert.equal(game.description, published.description);
    assert.equal(game.cover, published.cover || '');
    assert.deepEqual(platform.snapshot().gameAnnouncements, []);
});
