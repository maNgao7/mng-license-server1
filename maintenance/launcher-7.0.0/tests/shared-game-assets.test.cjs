'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {prepareSharedGameAssets}=require('../lib/shared-game-assets.cjs');
test('managed games receive public shared gifts without copying game code or overwriting user files',async t=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-shared-'));t.after(()=>{assert.equal(path.dirname(root),os.tmpdir());fs.rmSync(root,{recursive:true,force:true});});
    const libraryRoot=path.join(root,'games'),gameDirectory=path.join(libraryRoot,'.game-library','cc','versions','one'),bundledAssets=path.join(root,'public-gifts');
    fs.mkdirSync(gameDirectory,{recursive:true});fs.mkdirSync(bundledAssets);fs.writeFileSync(path.join(bundledAssets,'5655.png'),'fixture');
    fs.writeFileSync(path.join(bundledAssets,'server.js'),'game code');
    fs.writeFileSync(path.join(bundledAssets,'settings.json'),'private settings');
    await prepareSharedGameAssets({gameDirectory,libraryRoot,bundledAssets});
    const sibling=path.join(path.dirname(gameDirectory),'tiktok-vs');assert.equal(fs.existsSync(path.join(sibling,'server.js')),false);
    const gift=path.join(sibling,'public/assets/gift-images/5655.png');assert.equal(fs.readFileSync(gift,'utf8'),'fixture');
    assert.equal(fs.existsSync(path.join(path.dirname(gift),'server.js')),false);
    assert.equal(fs.existsSync(path.join(path.dirname(gift),'settings.json')),false);
    fs.writeFileSync(gift,'user version');await prepareSharedGameAssets({gameDirectory,libraryRoot,bundledAssets});assert.equal(fs.readFileSync(gift,'utf8'),'user version');
    const outside=path.join(root,'external');await prepareSharedGameAssets({gameDirectory:outside,libraryRoot,bundledAssets});assert.equal(fs.existsSync(path.join(root,'tiktok-vs')),false);
});

test('verified union public metadata and PNGs replace stale shared copies while mappings stay intact', async t => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-shared-797-'));
    t.after(()=>{assert.equal(path.dirname(root),os.tmpdir());fs.rmSync(root,{recursive:true,force:true});});
    const libraryRoot=path.join(root,'games'),gameDirectory=path.join(libraryRoot,'one'),bundledAssets=path.join(root,'source');
    fs.mkdirSync(gameDirectory,{recursive:true});fs.mkdirSync(bundledAssets);
    const rows=Array.from({length:905},(_,i)=>({id:String(5655+i),name:'Fixture '+i,file:String(5655+i)+'.png',coins:1}));
    fs.writeFileSync(path.join(bundledAssets,'katalog_tam.json'),JSON.stringify(rows));
    fs.writeFileSync(path.join(bundledAssets,'5655.png'),'new source PNG');
    const target=path.join(libraryRoot,'tiktok-vs/public/assets/gift-images');fs.mkdirSync(target,{recursive:true});
    fs.writeFileSync(path.join(target,'katalog_tam.json'),'old catalog');fs.writeFileSync(path.join(target,'5655.png'),'old artwork');
    const assignments=path.join(libraryRoot,'tiktok-vs/.gift-slots.json');fs.writeFileSync(assignments,'saved assignments');
    await prepareSharedGameAssets({gameDirectory,libraryRoot,bundledAssets});
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(target,'katalog_tam.json'),'utf8')),rows);
    assert.equal(fs.readFileSync(path.join(target,'5655.png'),'utf8'),'new source PNG');
    assert.equal(fs.readFileSync(assignments,'utf8'),'saved assignments');
    const external=path.join(root,'outside.json');fs.writeFileSync(external,'outside data');
    const catalogFile=path.join(target,'katalog_tam.json');fs.unlinkSync(catalogFile);
    try { fs.symlinkSync(external,catalogFile,'file'); } catch(error) { if(error.code==='EPERM')return; throw error; }
    await assert.rejects(prepareSharedGameAssets({gameDirectory,libraryRoot,bundledAssets}));
    assert.equal(fs.readFileSync(external,'utf8'),'outside data');
});

test('authority depends on numeric IDs and valid metadata, independent of catalog size', async t => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-catalog-authority-'));
    t.after(()=>{assert.equal(path.dirname(root),os.tmpdir());fs.rmSync(root,{recursive:true,force:true});});
    const libraryRoot=path.join(root,'games'),gameDirectory=path.join(libraryRoot,'one'),bundledAssets=path.join(root,'source');
    fs.mkdirSync(gameDirectory,{recursive:true});fs.mkdirSync(bundledAssets);
    fs.writeFileSync(path.join(bundledAssets,'5655.png'),'new artwork');
    const target=path.join(libraryRoot,'tiktok-vs/public/assets/gift-images');fs.mkdirSync(target,{recursive:true});
    const row={id:'5655',name:'Same name',file:'5655.png',coins:1};
    for (const invalid of [[],null,[row,row],[{...row,id:5655}],[{...row,id:'05655'}],[{...row,id:'9007199254740992'}],
        [{...row,file:'../5655.png'}],[{...row,coins:-1}],[{...row,coins:1.5}],[{...row,coins:'1'}],[{...row,name:''}]]) {
        fs.writeFileSync(path.join(bundledAssets,'katalog_tam.json'),JSON.stringify(invalid));
        fs.writeFileSync(path.join(target,'katalog_tam.json'),'saved catalog');
        fs.writeFileSync(path.join(target,'5655.png'),'saved artwork');
        await prepareSharedGameAssets({gameDirectory,libraryRoot,bundledAssets});
        assert.equal(fs.readFileSync(path.join(target,'katalog_tam.json'),'utf8'),'saved catalog');
        assert.equal(fs.readFileSync(path.join(target,'5655.png'),'utf8'),'saved artwork');
    }
    for (const count of [1,2,797,906]) {
        const rows=Array.from({length:count},(_,i)=>({...row,id:String(5655+i),file:String(5655+i)+'.png'}));
        fs.writeFileSync(path.join(bundledAssets,'katalog_tam.json'),'\uFEFF'+JSON.stringify(rows));
        fs.writeFileSync(path.join(bundledAssets,'_kutuphane.json'),JSON.stringify(rows.slice().reverse()));
        fs.writeFileSync(path.join(target,'_kutuphane.json'),'old library');
        await prepareSharedGameAssets({gameDirectory,libraryRoot,bundledAssets});
        assert.equal(fs.readFileSync(path.join(target,'5655.png'),'utf8'),'new artwork');
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(target,'_kutuphane.json'),'utf8')),rows.slice().reverse());
    }
    fs.writeFileSync(path.join(bundledAssets,'_kutuphane.json'),JSON.stringify([{...row,coins:99}]));
    fs.writeFileSync(path.join(target,'_kutuphane.json'),'preserve inconsistent library');
    await prepareSharedGameAssets({gameDirectory,libraryRoot,bundledAssets});
    assert.equal(fs.readFileSync(path.join(target,'_kutuphane.json'),'utf8'),'preserve inconsistent library');
});

test('shared artwork and fallback directory junctions cannot write outside the library', async t => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-shared-links-'));
    t.after(()=>{assert.equal(path.dirname(root),os.tmpdir());fs.rmSync(root,{recursive:true,force:true});});
    const libraryRoot=path.join(root,'games'),gameDirectory=path.join(libraryRoot,'one'),bundledAssets=path.join(root,'source'),external=path.join(root,'outside');
    for(const directory of [gameDirectory,bundledAssets,external])fs.mkdirSync(directory,{recursive:true});
    fs.writeFileSync(path.join(bundledAssets,'5655.png'),'fixture');
    const publicAssets=path.join(libraryRoot,'tiktok-vs/public/assets');fs.mkdirSync(publicAssets,{recursive:true});
    const junction=path.join(publicAssets,'gift-catalog');fs.symlinkSync(external,junction,'junction');
    await assert.rejects(prepareSharedGameAssets({gameDirectory,libraryRoot,bundledAssets}),{code:'EUNSAFEPATH'});
    assert.deepEqual(fs.readdirSync(external),[]);
    fs.unlinkSync(junction);
    const art=path.join(publicAssets,'gift-images');fs.rmSync(art,{recursive:true});fs.symlinkSync(external,art,'junction');
    await assert.rejects(prepareSharedGameAssets({gameDirectory,libraryRoot,bundledAssets}),{code:'EUNSAFEPATH'});
    assert.deepEqual(fs.readdirSync(external),[]);
});
