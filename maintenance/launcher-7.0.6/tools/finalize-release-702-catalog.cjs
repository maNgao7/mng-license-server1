'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {parseContentManifest,CONTENT_PATH}=require('../lib/game-content.cjs');
const {validateCatalog}=require('../lib/content-catalog.cjs');
const root=path.resolve(__dirname,'..'),directory='D:/TikMnG-Release-7.0.2-games',plan=JSON.parse(fs.readFileSync('D:/TikMnG-Release-7.0.2-content/plan.json'));
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:'D:/TikMnG-Release-7.0.2-content/repository',encoding:'utf8'}).trim();
assert.match(commit,/^[a-f0-9]{40}$/);
const releaseBase='https://github.com/maNgao7/mng-license-server1/releases/download/games-7.0.2/';
const smallBase=`https://raw.githubusercontent.com/maNgao7/mng-license-server1/${commit}/objects/`;
const large=new Set(plan.objects.filter(file=>file.large).map(file=>file.sha256)),descriptors=new Map();
for(const pkg of plan.packages){
    const manifest={schemaVersion:1,type:'tikmng-game-content',package:pkg.id,version:pkg.version,files:pkg.files.map(file=>({...file,url:(large.has(file.sha256)?releaseBase:smallBase)+file.sha256+'.bin'}))};
    parseContentManifest(manifest,{packageId:pkg.id,version:pkg.version});
    const bytes=Buffer.from(JSON.stringify(manifest)),name=`game-content-${pkg.id}-${pkg.version}.json`;
    fs.writeFileSync(path.join(directory,name),bytes);
    const files=[{path:CONTENT_PATH,url:releaseBase+name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}];
    for(const id of pkg.aliasIds)descriptors.set(id,{version:pkg.version,url:releaseBase+pkg.archiveName,bytes:pkg.bytes,sha256:pkg.sha256,files});
}
const catalog=JSON.parse(fs.readFileSync(path.join(root,'lib/catalog-defaults.json')));
catalog.revision=2;catalog.publishedAt=new Date().toISOString();delete catalog.launcher;
for(const game of catalog.games)if(descriptors.has(game.id))Object.assign(game,descriptors.get(game.id));
const snake=require('../lib/admin-games.json').games.find(game=>game.id==='minecraft-snake-arena');
if(!catalog.games.some(game=>game.id===snake.id))catalog.games.push({id:snake.id,title:snake.title,description:snake.description,requirements:snake.requirements,resources:[],...descriptors.get(snake.id)});
validateCatalog(catalog,{serverURL:'https://mng-license-server1.onrender.com'});
assert.equal(catalog.games.length,16);
const data=JSON.stringify(catalog,null,2)+'\n';
fs.writeFileSync(path.join(root,'lib/catalog-defaults.json'),data);fs.writeFileSync('D:/TikMnG-Release-7.0.0-source/content-defaults.json',data);
fs.writeFileSync('D:/TikMnG-Release-7.0.2-content/catalog-verification.json',JSON.stringify({passed:true,commit,games:16,media:catalog.media.length,packages:plan.packages.length,contentFiles:plan.objects.length,manifests:descriptors.size},null,2));
console.log(JSON.stringify({passed:true,commit,games:16,media:catalog.media.length,manifests:plan.packages.length}));
