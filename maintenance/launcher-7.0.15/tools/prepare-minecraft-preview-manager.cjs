'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),{Readable}=require('node:stream');
const asar=require('@electron/asar');
const root=path.resolve(__dirname,'..');
const output='D:/TikMnG-Minecraft-Admin-Test-20261027';
const installed='D:/TikMnG-Manager-7.0.0/win-unpacked/resources/app.asar';
const targets=['snow-war','battle-royale'];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function hashFile(file){const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');}
async function main(){
    fs.mkdirSync(output,{recursive:true});
    const original=JSON.parse(asar.extractFile(installed,'lib/admin-games.json'));
    const current=JSON.parse(fs.readFileSync(path.join(root,'lib/admin-games.json'),'utf8'));
    const next=structuredClone(original);
    for(const id of targets){
        const entry=current.games.find(g=>g.id===id);
        assert.equal(entry?.version,'7.0.3-preview.1');assert.equal(entry.adminOnly,true);
        assert.equal(await hashFile(entry.package.localArchive),entry.package.sha256);
        const index=next.games.findIndex(g=>g.id===id);assert.ok(index>=0);next.games[index]=entry;
    }
    assert.deepEqual(next.games.filter(g=>!targets.includes(g.id)),original.games.filter(g=>!targets.includes(g.id)));
    const replacement=Buffer.from(JSON.stringify(next,null,2)+'\n');
    const header=asar.getRawHeader(installed).header;
    const streams=[],leaves=[];
    function walk(node,parent=''){
        for(const [name,entry] of Object.entries(node.files||{})){
            const relative=parent?parent+'/'+name:name;
            assert.ok(!entry.link,'Unexpected archive link');
            if(entry.files){streams.push({path:relative,type:'directory',unpacked:Boolean(entry.unpacked)});walk(entry,relative);}
            else{
                const changed=relative==='lib/admin-games.json';
                streams.push({path:relative,type:'file',unpacked:Boolean(entry.unpacked),
                    stat:{size:changed?replacement.length:entry.size,mode:entry.executable?0o100755:0o100644},
                    streamGenerator:()=>Readable.from([changed?replacement:asar.extractFile(installed,path.normalize(relative))])});
                leaves.push(relative);
            }
        }
    }
    walk(header);
    const candidate=path.join(output,'app-minecraft-preview.asar');
    assert.equal(fs.existsSync(candidate),false,'Candidate already exists; do not overwrite');
    await asar.createPackageFromStreams(candidate,streams);
    let unchanged=0;
    for(const file of leaves){
        if(file==='lib/admin-games.json')assert.deepEqual(asar.extractFile(candidate,path.normalize(file)),replacement);
        else{assert.equal(hash(asar.extractFile(candidate,path.normalize(file))),hash(asar.extractFile(installed,path.normalize(file))),file);unchanged++;}
    }
    const report={prepared:true,installed:false,candidate,installedTarget:installed,
        originalSha256:await hashFile(installed),candidateSha256:await hashFile(candidate),
        changedFiles:['lib/admin-games.json'],unchangedFiles:unchanged,
        launcherVersionUnchanged:JSON.parse(asar.extractFile(installed,'package.json')).version,
        games:targets.map(id=>({id,version:next.games.find(g=>g.id===id).version})),publicRelease:false};
    fs.writeFileSync(path.join(output,'manager-package.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
