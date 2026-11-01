const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createGameLibrary}=require('../lib/game-library.cjs');
const {validatePackageDirectory,verifyPackage}=require('../lib/voice-driving-package.cjs');
const root='D:/TikMnG-Hotfix-7.0.5-final/public-install-qa';
(async()=>{
    assert.equal(fs.existsSync(root),false,'Fresh QA root required');fs.mkdirSync(root,{recursive:true});
    const legacy=path.join(root,'legacy-frog');fs.mkdirSync(legacy);fs.writeFileSync(path.join(legacy,'server.js'),'// previous executable');
    const settings=JSON.stringify({followDistance:50,likeThreshold:100,likeDistance:50,followEnabled:true,likeEnabled:true,customGift:'kept'});
    fs.writeFileSync(path.join(legacy,'settings.json'),settings);
    const byId=Object.fromEntries(require('../lib/catalog-defaults.json').games.map(game=>[game.id,game]));
    const options={root:path.join(root,'games'),definitions:{'frog-river':{id:'frog-river',klasor:'frog-river'},caahr:{id:'caahr',klasor:'caahr'}},
        resolveLegacy:id=>id==='frog-river'?legacy:null,
        validate:(directory,id)=>id==='caahr'?validatePackageDirectory(directory):fs.existsSync(path.join(directory,'server.js')),
        getPackage:id=>byId[id]};
    const library=createGameLibrary(options);
    assert.equal(library.state('frog-river').updateAvailable,true);
    await library.install('frog-river');
    const frog=library.state('frog-river');assert.equal(frog.installedVersion,'7.0.5');assert.equal(frog.updateAvailable,false);
    assert.equal(fs.readFileSync(path.join(frog.path,'settings.json'),'utf8'),settings);
    const pointer=fs.readFileSync(path.join(root,'games/.game-library/frog-river/active.json'));
    await library.install('caahr');const voice=library.state('caahr');assert.equal(voice.installedVersion,'0.6.12');
    const verified=await verifyPackage({packageDirectory:voice.path});assert.equal(verified.manifest.version,'0.6.12');
    assert.deepEqual(fs.readFileSync(path.join(root,'games/.game-library/frog-river/active.json')),pointer);
    assert.equal(fs.readFileSync(path.join(frog.path,'settings.json'),'utf8'),settings);
    const restarted=createGameLibrary(options);assert.equal(restarted.pathFor('frog-river'),frog.path);assert.equal(restarted.pathFor('caahr'),voice.path);
    const report={passed:true,publicGitHubDownloads:true,sha256Verified:true,frogVersion:frog.installedVersion,voiceVersion:voice.installedVersion,savedSettingsPreserved:true,otherGamePointerPreserved:true,restartPreserved:true,frogPath:frog.path,voicePath:voice.path};
    fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
