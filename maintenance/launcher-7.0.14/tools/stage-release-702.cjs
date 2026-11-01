'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {manifestFiles}=require('../lib/game-content.cjs');
const root='D:/TikMnG-Release-7.0.2-content',objects=path.join(root,'repository/objects'),assets='D:/TikMnG-Release-7.0.2-games';
const games=require('../lib/admin-games.json').games;
const digest=async file=>{const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');};
const forbidden=/(?:^|\/)(?:\.env(?:\.[^/]*)?|euler-api-key\.txt|launcher_accounts\.json|usercache\.json|mng-config\.json|lisanslar\.json|\.git|logs?|crash-reports|screenshots)(?:\/|$)|\.(?:log|bak|backup)$/i;
async function main(){
    fs.mkdirSync(objects,{recursive:true});fs.mkdirSync(assets,{recursive:true});
    const packages=[],unique=new Map(),seen=new Set();
    for(const game of games){
        const p=game.package;if(seen.has(p.localArchive))continue;seen.add(p.localArchive);
        assert.equal(fs.statSync(p.localArchive).size,p.bytes);assert.equal(await digest(p.localArchive),p.sha256,'Archive checksum '+game.id);
        const bytes=fs.readFileSync(p.localContentManifest);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),p.contentSha256);
        const manifest=JSON.parse(bytes),files=manifestFiles(manifest.files),version=game.id==='minecraft-snake-arena'?game.version:'7.0.2',id=p.packageId||game.id;
        const aliasIds=games.filter(g=>g.package.localArchive===p.localArchive).map(g=>g.id);
        for(const file of files){
            assert.ok(!forbidden.test(file.path),'Private/runtime file '+file.path);
            const local=path.resolve(p.localRoot,file.path),relative=path.relative(path.resolve(p.localRoot),local);
            assert.ok(!relative.startsWith('..')&&!path.isAbsolute(relative));
            assert.equal(fs.statSync(local).size,file.bytes,'Size '+file.path);
            if(!unique.has(file.sha256)){
                assert.equal(await digest(local),file.sha256,'Content checksum '+file.path);
                if(file.bytes<4*1024*1024&&/\.(?:js|cjs|json|txt|properties|xml|yml)$/i.test(file.path)){
                    const text=fs.readFileSync(local,'utf8');assert.ok(!/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{40,})\b/.test(text),'Credential-shaped content '+file.path);
                }
                const large=file.bytes>262144,destination=path.join(large?assets:objects,file.sha256+'.bin');
                if(!fs.existsSync(destination))fs.copyFileSync(local,destination);
                assert.equal(fs.statSync(destination).size,file.bytes);
                unique.set(file.sha256,{sha256:file.sha256,bytes:file.bytes,large,local:destination});
            }else assert.equal(unique.get(file.sha256).bytes,file.bytes);
        }
        const archiveName=`${id}-${version}.zip`,destination=path.join(assets,archiveName);
        if(!fs.existsSync(destination))fs.copyFileSync(p.localArchive,destination);
        assert.equal(await digest(destination),p.sha256);
        packages.push({id,aliasIds,version,archiveName,bytes:p.bytes,sha256:p.sha256,files});
        console.log(JSON.stringify({verified:id,version,files:files.length,archiveBytes:p.bytes}));
    }
    const plan={schemaVersion:1,version:'7.0.2',tag:'games-7.0.2',packages,objects:[...unique.values()]};
    fs.writeFileSync(path.join(root,'plan.json'),JSON.stringify(plan));
    fs.writeFileSync(path.join(root,'repository/README.md'),'# TikMnG 7.0.2 Content Objects\n\nContent-addressed small game files for verified incremental updates. Large objects and complete installation archives are release assets. Original bundled third-party license files are retained as content objects. No user profiles, API credentials or saved games are included.\n');
    const summary={packages:packages.length,gameEntries:games.length,objects:unique.size,smallObjects:[...unique.values()].filter(x=>!x.large).length,releaseObjects:[...unique.values()].filter(x=>x.large).length,archiveBytes:packages.reduce((n,p)=>n+p.bytes,0),contentBytes:[...unique.values()].reduce((n,p)=>n+p.bytes,0),verified:true};
    fs.writeFileSync(path.join(root,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
