'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const version='0.16.0',tag='game-snake-0.16.0',id='minecraft-snake-arena';
const stage='D:/TikMnG-Snake-Admin-Package-'+version,output='D:/TikMnG-Release-Snake-'+version;
const repo='D:/TikMnG-Release-7.0.0-source',catalogFile=path.resolve(__dirname,'../lib/catalog-defaults.json');
const hash=async file=>{const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');};
async function main(){
    assert.ok(!fs.existsSync(output),'Use a fresh release stage');
    const catalog=JSON.parse(fs.readFileSync(catalogFile,'utf8')),game=catalog.games.find(g=>g.id===id);
    assert.equal(game.version,'0.15.3');
    const baseline=path.join(repo,'content-bootstrap-7.0.5.json');assert.ok(!fs.existsSync(baseline));fs.copyFileSync(path.join(repo,'content-defaults.json'),baseline);
    const response=await fetch(game.files[0].url);assert.ok(response.ok);const raw=Buffer.from(await response.arrayBuffer());
    assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),game.files[0].sha256);
    const old=JSON.parse(raw),current=JSON.parse(fs.readFileSync(stage+'.content.json','utf8'));
    assert.equal(current.version,version);assert.equal(current.package,id);
    assert.deepEqual(fs.readdirSync(path.join(stage,'game-instance/mods')).filter(n=>n.includes('snake')),['tikmng_snake_arena-0.16.0.jar']);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(stage,'game-instance/config/tikmng-snake-arena.json'),'utf8')),{});
    const urls=new Map(old.files.map(f=>[f.sha256,f.url])),base='https://github.com/maNgao7/mng-license-server1/releases/download/'+tag+'/';
    fs.mkdirSync(output);let reused=0,changedBytes=0,changed=0;
    for(const file of current.files){
        assert.equal(await hash(path.join(stage,file.path)),file.sha256);
        if(urls.has(file.sha256)){file.url=urls.get(file.sha256);reused++;}
        else{const name=file.sha256+'.bin';fs.copyFileSync(path.join(stage,file.path),path.join(output,name));file.url=base+name;changed++;changedBytes+=file.bytes;}
    }
    const name='game-content-'+id+'-'+version+'.json',manifest=path.join(output,name);fs.writeFileSync(manifest,JSON.stringify(current));
    const zipName=id+'-'+version+'.zip',zip=path.join(output,zipName);fs.copyFileSync(stage+'.zip',zip);
    const descriptor={version,url:base+zipName,bytes:fs.statSync(zip).size,sha256:await hash(zip),files:[{path:'.tikmng-content.json',url:base+name,bytes:fs.statSync(manifest).size,sha256:await hash(manifest)}]};
    Object.assign(game,descriptor);catalog.revision++;catalog.publishedAt=new Date().toISOString();
    for(const target of [catalogFile,path.join(repo,'content-defaults.json')])fs.writeFileSync(target,JSON.stringify(catalog,null,2)+'\n');
    const publishedFile=path.resolve(__dirname,'../lib/published-games.json'),published=JSON.parse(fs.readFileSync(publishedFile,'utf8'));
    Object.assign(published.games.find(g=>g.id===id).definition,{paketSurumu:version,modFile:'tikmng_snake_arena-0.16.0.jar',boyut:Math.ceil(descriptor.bytes/1048576)+' MB'});
    fs.writeFileSync(publishedFile,JSON.stringify(published,null,2)+'\n');
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({tag,version,reusedFiles:reused,changedFiles:changed,changedBytes,fullBytes:descriptor.bytes,oneModOnly:true,cleanDefaults:true},null,2));
    console.log(JSON.stringify({tag,version,reused,changed,changedBytes,fullBytes:descriptor.bytes,revision:catalog.revision}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
