'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),archiver=require('archiver');
const launcher=path.resolve(__dirname,'..'),apps=path.join(launcher,'../apps');
const {buildPreviewContent}=require('./build-preview-content.cjs');
const version='7.0.2-preview.6';
const definitions=[
    ['tiktok-vs',['vs','puanlama'],['TikTok VS Profil','Profil Puanlama']],
    ['mng-orbit',['orbit'],['MNG Orbit']],['crowd-control',['crowd-control'],['MNG Crowd Control']],
    ['battle-game',['battle-game'],['Şövalye Savaşı']],['duck-hunt',['duck-hunt'],['MNG Dodge Hunter']],
    ['pony-life',['pony-life'],['Pony Katırı']],['penalty-kick',['penalty-kick'],['Süper Lig (Penaltı)']],
    ['tightrope-balance',['tightrope-balance'],['Dengesiz Yayıncı']]
];
const forbidden=/(?:^|\/)(?:\.avatar-cache|\.cache|\.git|\.bin|\.env(?:\.[^/]*)?|euler-api-key\.txt|token|settings\.json|config\.json|state\.json|\.coin-data\.json|\.gift-slots\.json|\.gift-catalog\.json|logs?|saves?|data)(?:\/|$)|(?:\.log|\.bak|\.backup[^/]*|\.map)$/i;
function copy(source,destination){
    fs.cpSync(source,destination,{recursive:true,dereference:true,filter:file=>!forbidden.test(path.relative(source,file).split(path.sep).join('/'))});
}
async function build([directory,ids,titles]){
    const source=path.join(apps,directory),stage=`D:/TikMnG-${directory}-Widgets-${version}`;
    if(fs.existsSync(stage))throw new Error('Refusing to overwrite an existing package stage: '+stage);
    fs.mkdirSync(stage);
    for(const name of ['server.js','live-events.js','package.json','package-lock.json','launcher-widget-links.cjs','public','dist','server','shared']){
        const from=path.join(source,name);if(fs.existsSync(from))copy(from,path.join(stage,name));
    }
    const modules=fs.existsSync(path.join(source,'node_modules'))?path.join(source,'node_modules'):path.join(apps,'node_modules');
    copy(modules,path.join(stage,'node_modules'));
    fs.writeFileSync(path.join(stage,'.tikmng-package.json'),JSON.stringify({id:directory,version})+'\n');
    const archive=stage+'.zip';
    await new Promise((resolve,reject)=>{const out=fs.createWriteStream(archive),zip=archiver('zip',{zlib:{level:1}});out.once('close',resolve);out.once('error',reject);zip.once('error',reject);zip.pipe(out);zip.directory(stage,false);zip.finalize();});
    const hash=crypto.createHash('sha256');for await(const b of fs.createReadStream(archive))hash.update(b);
    const descriptor={packageId:directory,localArchive:archive,bytes:fs.statSync(archive).size,sha256:hash.digest('hex'),...await buildPreviewContent(stage,directory,version)};
    const manifestFile=path.join(launcher,'lib/admin-games.json'),manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
    ids.forEach((id,index)=>{const entry={id,title:titles[index],version,adminOnly:true,package:descriptor};const at=manifest.games.findIndex(g=>g.id===id);if(at<0)manifest.games.push(entry);else manifest.games[at]={...manifest.games[at],...entry};});
    fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
    const report={ids,version,stage,bytes:descriptor.bytes,sha256:descriptor.sha256,privateLocalPreview:true,userSettingsExcluded:true};
    console.log(JSON.stringify(report));return report;
}
(async()=>{
    const only=process.argv.includes('--only')?process.argv[process.argv.indexOf('--only')+1]:null;
    if(only&&!definitions.some(([directory])=>directory===only))throw new Error('Unknown package');
    const reportFile='D:/TikMnG-Widget-QA-20261025/packages.json';
    const reports=only&&fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile,'utf8')).filter(report=>!report.ids.includes(only==='tiktok-vs'?'vs':only)):[];
    for(const def of definitions.filter(([directory])=>!only||directory===only)){
        if(only&&process.argv.includes('--restage')){
            const stage=path.resolve(`D:/TikMnG-${def[0]}-Widgets-${version}`);
            if(path.dirname(stage)!==path.resolve('D:/')||!path.basename(stage).startsWith('TikMnG-'))throw new Error('Unexpected staging path');
            for(const file of [stage,stage+'.zip'])if(fs.existsSync(file))fs.renameSync(file,file+'.before-'+Date.now());
        }
        reports.push(await build(def));
    }
    fs.writeFileSync(reportFile,JSON.stringify(reports,null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
