'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {zipPackage}=require('./build-voice-driving-package.cjs');
const root=process.env.MNG_HOTFIX_DIR||'D:/TikMnG-Hotfix-7.0.5-final',stage=path.join(root,'frog-river'),source=path.resolve(__dirname,'../../apps/frog-river');
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
(async()=>{
  if(fs.existsSync(stage))throw Error('Use a fresh staging directory.');
  fs.mkdirSync(stage,{recursive:true});
  for(const name of ['server.js','live-events.js','launcher-widget-links.cjs','package.json','package-lock.json','gift-catalog.json','public'])fs.cpSync(path.join(source,name),path.join(stage,name),{recursive:true});
  const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
  execFileSync(process.execPath,[npm,'ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],{cwd:stage,stdio:'pipe',windowsHide:true,timeout:180000});
  const archive=path.join(root,'frog-river-7.0.5.zip');await zipPackage(stage,archive);
  const report={id:'frog-river',version:'7.0.5',archive,bytes:fs.statSync(archive).size,sha256:digest(archive),privateSettingsIncluded:false};
  fs.writeFileSync(path.join(root,'frog-river-report.json'),JSON.stringify(report,null,2));
  const voice=JSON.parse(fs.readFileSync('D:/TikMnG-Voice-Driving-Package/voice-driving-0.6.12-final.hash-report.json','utf8'));
  const filename=path.join(__dirname,'../lib/catalog-defaults.json'),catalog=JSON.parse(fs.readFileSync(filename,'utf8'));
  catalog.revision=5;catalog.publishedAt=new Date().toISOString();
  for(const [id,version,url,bytes,sha256] of [
    ['frog-river','7.0.5','https://github.com/maNgao7/mng-license-server1/releases/download/game-hotfix-7.0.5/frog-river-7.0.5.zip',report.bytes,report.sha256],
    ['caahr','0.6.12','https://github.com/maNgao7/mng-license-server1/releases/download/game-hotfix-7.0.5/voice-driving-0.6.12.zip',voice.archiveBytes,voice.archiveSha256]
  ]){
    const game=catalog.games.find(game=>game.id===id);Object.assign(game,{version,url,bytes,sha256});
    // Full verified archives are used for this narrow repair, not stale incremental manifests.
    delete game.files;
  }
  fs.writeFileSync(filename,JSON.stringify(catalog,null,2)+'\n');
  console.log(JSON.stringify({frog:report,voice:{version:'0.6.12',bytes:voice.archiveBytes,sha256:voice.archiveSha256},catalogRevision:catalog.revision}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
