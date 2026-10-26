'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const project='C:/Users/User/Desktop/MNG-TikTok-Game';
const launcher=path.join(project,'launcher');
const version='0.15.3',modVersion='0.15.3';
const stage=`D:/TikMnG-Snake-Admin-Package-${version}`;
const archive=stage+'.zip';
function copy(from,to){fs.mkdirSync(path.dirname(to),{recursive:true});fs.cpSync(from,to,{recursive:true,dereference:true});}
async function main(){
    fs.mkdirSync(stage,{recursive:true});
    const runtime=path.join(stage,'runtime'),bridge=path.join(stage,'live-bridge');
    if(!fs.existsSync(path.join(runtime,'profile.json'))){
        copy(path.join(project,'apps/battle-royale/prototype/runtime'),runtime);
        console.log('Local runtime copied.');
    }
    const sourceBridge=path.join(project,'apps/battle-royale/prototype/live-bridge');
    fs.mkdirSync(bridge,{recursive:true});
    for(const name of ['server.js','events.js','profiles.js','live-session.js','package.json','package-lock.json','node_modules'])copy(path.join(sourceBridge,name),path.join(bridge,name));
    if(process.argv.includes('--prepare-only'))return;
    for(const name of ['launch-game.cjs','widget-server.cjs','widget.html'])copy(path.join(root,name),path.join(stage,name));
    copy(path.join(launcher,'lib/overlay-bridge.cjs'),path.join(stage,'lib/overlay-bridge.cjs'));
    copy(path.join(launcher,'license-server.txt'),path.join(stage,'license-server.txt'));
    copy(path.join(launcher,'node_modules/ws'),path.join(stage,'node_modules/ws'));
    copy(path.join(root,'assets/snake-gift-guide.png'),path.join(stage,'snake-gift-guide.png'));
    copy(path.join(root,`mod/build/libs/tikmng_snake_arena-${modVersion}.jar`),path.join(stage,`game-instance/mods/tikmng_snake_arena-${modVersion}.jar`));
    // Distribution contains no personal configuration, license, session, world or widget identity.
    fs.mkdirSync(path.join(stage,'game-instance/config'),{recursive:true});
    fs.writeFileSync(path.join(stage,'game-instance/config/tikmng-snake-arena.json'),'{}\n');
    fs.writeFileSync(path.join(stage,'.tikmng-package.json'),JSON.stringify({id:'minecraft-snake-arena',version},null,2));
    const archiver=require(path.join(launcher,'node_modules/archiver'));
    await new Promise((resolve,reject)=>{
        const output=fs.createWriteStream(archive),zip=archiver('zip',{zlib:{level:1}});
        output.on('close',resolve);output.on('error',reject);zip.on('error',reject);zip.pipe(output);zip.directory(stage,false);zip.finalize();
    });
    const hash=crypto.createHash('sha256');for await(const b of fs.createReadStream(archive))hash.update(b);
    const descriptor={localArchive:archive,bytes:fs.statSync(archive).size,sha256:hash.digest('hex'),
        ...await require(path.join(launcher,'tools/build-preview-content.cjs')).buildPreviewContent(stage,'minecraft-snake-arena',version)};
    const manifestFile=path.join(launcher,'lib/admin-games.json'),manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
    const game=manifest.games.find(g=>g.id==='minecraft-snake-arena');if(!game)throw Error('Admin game missing');
    game.package=descriptor;game.definition.boyut=`${Math.ceil(descriptor.bytes/1024/1024)} MB`;game.version=game.definition.paketSurumu=version;game.definition.modFile=`tikmng_snake_arena-${modVersion}.jar`;
    fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
    const report={version,stage,archive,...descriptor,sourceOnly:true,publicRelease:false};
    fs.writeFileSync(path.join(root,`qa/admin-package-${version}.json`),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
