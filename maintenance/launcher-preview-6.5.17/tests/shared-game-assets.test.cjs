'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {prepareSharedGameAssets}=require('../lib/shared-game-assets.cjs');
test('managed games receive public shared gifts without copying game code or overwriting user files',async t=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-shared-'));t.after(()=>{assert.equal(path.dirname(root),os.tmpdir());fs.rmSync(root,{recursive:true,force:true});});
    const libraryRoot=path.join(root,'games'),gameDirectory=path.join(libraryRoot,'.game-library','cc','versions','one'),bundledAssets=path.join(root,'public-gifts');
    fs.mkdirSync(gameDirectory,{recursive:true});fs.mkdirSync(bundledAssets);fs.writeFileSync(path.join(bundledAssets,'5655.png'),'fixture');
    await prepareSharedGameAssets({gameDirectory,libraryRoot,bundledAssets});
    const sibling=path.join(path.dirname(gameDirectory),'tiktok-vs');assert.equal(fs.existsSync(path.join(sibling,'server.js')),false);
    const gift=path.join(sibling,'public/assets/gift-images/5655.png');assert.equal(fs.readFileSync(gift,'utf8'),'fixture');
    fs.writeFileSync(gift,'user version');await prepareSharedGameAssets({gameDirectory,libraryRoot,bundledAssets});assert.equal(fs.readFileSync(gift,'utf8'),'user version');
    const outside=path.join(root,'external');await prepareSharedGameAssets({gameDirectory:outside,libraryRoot,bundledAssets});assert.equal(fs.existsSync(path.join(root,'tiktok-vs')),false);
});
