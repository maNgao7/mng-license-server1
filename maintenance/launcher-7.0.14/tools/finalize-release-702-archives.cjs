'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),yauzl=require('yauzl');
const root='D:/TikMnG-Release-7.0.2-content',directory='D:/TikMnG-Release-7.0.2-installers',tag='game-installers-7.0.2';
const plan=JSON.parse(fs.readFileSync(path.join(root,'plan.json'))),catalog=require('../lib/catalog-defaults.json');
async function marker(file){return new Promise((resolve,reject)=>yauzl.open(file,{lazyEntries:true},(error,zip)=>{
    if(error)return reject(error);let result;zip.on('error',reject);zip.on('end',()=>resolve(result));zip.on('entry',entry=>{
        if(entry.fileName!=='.tikmng-package.json')return zip.readEntry();
        zip.openReadStream(entry,(error,stream)=>{if(error)return reject(error);let text='';stream.on('data',b=>text+=b);stream.on('end',()=>{result=JSON.parse(text);zip.readEntry();});});
    });zip.readEntry();
}));}
async function digest(file){const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');}
async function main(){
    fs.mkdirSync(directory,{recursive:true});const archives=[];
    for(const pkg of plan.packages){
        const original=path.join('D:/TikMnG-Release-7.0.2-games',pkg.archiveName),old=await marker(original);
        assert.ok(old?.version);if(old.version===pkg.version)continue;
        const work=path.join(root,'archive-metadata',pkg.id);fs.mkdirSync(work,{recursive:true});
        fs.writeFileSync(path.join(work,'.tikmng-package.json'),JSON.stringify({id:pkg.id,version:pkg.version})+'\n');
        const target=path.join(directory,pkg.archiveName);
        if(!fs.existsSync(target))fs.copyFileSync(original,target);
        execFileSync(path.resolve(__dirname,'../node_modules/7zip-bin/win/x64/7za.exe'),['u','-tzip','-mx=9',target,'.tikmng-package.json'],{cwd:work,stdio:'ignore',windowsHide:true});
        assert.deepEqual(await marker(target),{id:pkg.id,version:pkg.version});
        const bytes=fs.statSync(target).size,sha256=await digest(target),url=`https://github.com/maNgao7/mng-license-server1/releases/download/${tag}/${pkg.archiveName}`;
        for(const game of catalog.games)if(pkg.aliasIds.includes(game.id))Object.assign(game,{url,bytes,sha256});
        archives.push({name:pkg.archiveName,bytes,sha256});console.log('PREPARED',pkg.id,bytes);
    }
    catalog.revision=3;catalog.publishedAt=new Date().toISOString();const data=JSON.stringify(catalog,null,2)+'\n';
    fs.writeFileSync(path.resolve(__dirname,'../lib/catalog-defaults.json'),data);fs.writeFileSync('D:/TikMnG-Release-7.0.0-source/content-defaults.json',data);
    fs.writeFileSync(path.join(root,'final-archives.json'),JSON.stringify({tag,directory,archives},null,2));
    console.log(JSON.stringify({prepared:archives.length,catalogRevision:catalog.revision}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
