'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const version='0.15.3',tag='game-snake-0.15.3',id='minecraft-snake-arena';
const stage=`D:/TikMnG-Snake-Admin-Package-${version}`,output=`D:/TikMnG-Release-Snake-${version}`;
const base=`https://github.com/maNgao7/mng-license-server1/releases/download/${tag}/`;
async function hash(file){const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');}
async function main(){
    const old=JSON.parse(fs.readFileSync('D:/TikMnG-Release-7.0.2-games/game-content-minecraft-snake-arena-0.15.2.json','utf8'));
    const current=JSON.parse(fs.readFileSync(stage+'.content.json','utf8'));
    assert.equal(current.version,version);assert.equal(current.package,id);
    assert.deepEqual(fs.readdirSync(path.join(stage,'game-instance/mods')).filter(n=>n.includes('snake')),['tikmng_snake_arena-0.15.3.jar']);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(stage,'game-instance/config/tikmng-snake-arena.json'),'utf8')),{});
    const urls=new Map(old.files.map(f=>[f.sha256,f.url]));fs.mkdirSync(output,{recursive:true});let reused=0,changed=0,changedBytes=0;
    for(const file of current.files){
        assert.equal(await hash(path.join(stage,file.path)),file.sha256);
        if(urls.has(file.sha256)){file.url=urls.get(file.sha256);reused++;}
        else{const name=file.sha256+'.bin';fs.copyFileSync(path.join(stage,file.path),path.join(output,name));file.url=base+name;changed++;changedBytes+=file.bytes;}
    }
    const name=`game-content-${id}-${version}.json`,manifestFile=path.join(output,name);
    fs.writeFileSync(manifestFile,JSON.stringify(current));
    const zipName=`${id}-${version}.zip`,zip=path.join(output,zipName);fs.copyFileSync(stage+'.zip',zip);
    const descriptor={version,url:base+zipName,bytes:fs.statSync(zip).size,sha256:await hash(zip),files:[{path:'.tikmng-content.json',url:base+name,bytes:fs.statSync(manifestFile).size,sha256:await hash(manifestFile)}]};
    for(const catalogFile of [path.resolve(__dirname,'../lib/catalog-defaults.json'),'D:/TikMnG-Release-7.0.0-source/content-defaults.json']){
        const catalog=JSON.parse(fs.readFileSync(catalogFile,'utf8')),game=catalog.games.find(g=>g.id===id);assert.ok(game);
        Object.assign(game,descriptor);catalog.revision=4;catalog.publishedAt=new Date().toISOString();fs.writeFileSync(catalogFile,JSON.stringify(catalog,null,2)+'\n');
    }
    const publishedFile=path.resolve(__dirname,'../lib/published-games.json'),published=JSON.parse(fs.readFileSync(publishedFile,'utf8'));
    const game=published.games.find(g=>g.id===id);game.definition.paketSurumu=version;game.definition.modFile='tikmng_snake_arena-0.15.3.jar';game.definition.boyut=`${Math.ceil(descriptor.bytes/1024/1024)} MB`;
    fs.writeFileSync(publishedFile,JSON.stringify(published,null,2)+'\n');
    const report={tag,version,reusedFiles:reused,changedFiles:changed,changedBytes,fullBytes:descriptor.bytes,oneModOnly:true,cleanDefaults:true};
    fs.writeFileSync('D:/TikMnG-QA-Delivery/7.0.2/snake-0153-content.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
