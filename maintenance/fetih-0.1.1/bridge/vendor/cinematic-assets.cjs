'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../renderer/widgets/cinematic');
const files=new Set(['three.module.js','three.core.js','FontLoader.js','TextGeometry.js','RoomEnvironment.js','font.json','THREE-LICENSE.txt','FONT-LICENSE.txt','pk-impact.js','premium-scenes.js','legacy-scenes.js','assets/botanical-crown.png','assets/inferno-crown.png','assets/platinum-crown.png','assets/pk-creatures-atlas.png','assets/pk-gloves-atlas.png','assets/jars-atlas.png']);
let cached=null;
files.add('pk-character-rig.js');files.add('assets/pk-expressions-v2.png');files.add('assets/pk-companions-v1.png');
files.add('assets/pk-dragon-wings-v1.png');
for(const file of ['loot-opening.js','loot-model.js','jar-silhouettes.js'])files.add(file);
files.add('assets/jars-atlas-v2.png');
files.add('assets/jar-mascots-v1.png');
files.add('assets/jar-mascots-animated-v2.png');
files.add('assets/jar-mascots-animated-v3.png');
function manifest(){
    const entries=[...files].filter(file=>fs.existsSync(path.join(root,file))).map(file=>[file,fs.statSync(path.join(root,file))]);
    const signature=entries.map(([name,stat])=>name+':'+stat.size+':'+stat.mtimeMs).join('|');
    if(cached?.signature===signature)return cached;
    const hash=crypto.createHash('sha256');for(const [name]of entries)hash.update(name).update(fs.readFileSync(path.join(root,name)));
    const revision=hash.digest('hex');cached={signature,revision,base:'/widget/cinematic/'+revision+'/'};return cached;
}
function allowedPath(pathname){
    if(typeof pathname!=='string')return false;
    const match=pathname.match(/^\/widget\/cinematic\/(?:[a-f0-9]{64}\/)?(.+)$/);
    return !!match&&(files.has(match[1])||/^posters\/[a-z0-9-]{1,100}\.webp$/.test(match[1]));
}
function handle(req,res,url){
    const local=url.pathname.replace(/^\/overlays\/[A-Za-z0-9_-]{43}(?=\/)/,'');
    if(!local.startsWith('/widget/cinematic/'))return false;
    if(!['GET','HEAD'].includes(req.method)||!allowedPath(local)){res.writeHead(404);res.end();return true;}
    let relative=local.slice('/widget/cinematic/'.length),version='';
    if(/^[a-f0-9]{64}\//.test(relative)){version=relative.slice(0,64);relative=relative.slice(65);}
    if(!files.has(relative)&&!/^posters\/[a-z0-9-]{1,100}\.webp$/.test(relative)){res.writeHead(404);res.end();return true;}
    const file=path.join(root,relative);if(!fs.existsSync(file)){res.writeHead(404);res.end();return true;}
    const current=manifest();if(version&&version!==current.revision){res.writeHead(404,{'Cache-Control':'no-store'});res.end();return true;}
    const body=fs.readFileSync(file),etag='"'+crypto.createHash('sha256').update(body).digest('hex')+'"';
    const mime={'.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.txt':'text/plain; charset=utf-8'}[path.extname(file)];
    const headers={'Content-Type':mime,'Cache-Control':version?'public, max-age=31536000, immutable':'public, no-cache','ETag':etag,'X-Content-Type-Options':'nosniff'};
    if(req.headers['if-none-match']===etag){res.writeHead(304,headers);res.end();return true;}
    res.writeHead(200,{...headers,'Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body);return true;
}
module.exports={manifest,handle,allowedPath};
