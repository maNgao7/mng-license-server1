const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),{Readable}=require('node:stream');
const root=path.resolve(__dirname,'../..'),releaseDir=path.join(root,'release-v6.5.9');
const repo='maNgao7/mng-license-server1',tag='v6.5.9';
const credential=cp.spawnSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}});
const token=credential.stdout?.split('\n').find(line=>line.startsWith('password='))?.slice(9);
if(!token)throw Error('GitHub kimlik doğrulaması gerekli.');
const headers={Authorization:'Bearer '+token,'User-Agent':'TikMnG-release',Accept:'application/vnd.github+json'};
async function api(url,method='GET',data){const r=await fetch('https://api.github.com/repos/'+repo+url,{method,headers:{...headers,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});if(!r.ok)throw Error(`GitHub ${r.status}: ${await r.text()}`);return r.status===204?null:r.json()}
(async()=>{
 const releases=await api('/releases?per_page=25');let release=releases.find(r=>r.tag_name===tag);
 if(process.argv.includes('--publish')){
  if(!release)throw Error('Taslak bulunamadı');
  const expected=[['TikMnG-Setup-6.5.9.exe',path.join(root,'launcher/dist/TikMnG Setup 6.5.9.exe')],['TikMnG-6.5.9-Portable.exe',path.join(root,'launcher/dist/TikMnG 6.5.9.exe')],...['tightrope-balance','mng-orbit','penalty-kick','zombie-war'].map(id=>[id+'.zip',path.join(releaseDir,id+'.zip')]),['KONTROL-RAPORU.md',path.join(releaseDir,'KONTROL-RAPORU.md')],['manifest-6.5.9.json',path.join(releaseDir,'manifest-6.5.9.json')]];
  for(const[name,file]of expected){const asset=release.assets.find(a=>a.name===name);if(!asset||asset.state!=='uploaded'||asset.size!==fs.statSync(file).size)throw Error(name+' son paketle eşleşmiyor.');}
  release=await api('/releases/'+release.id,'PATCH',{target_commitish:'release/tikmng-6.5.9',draft:false,make_latest:'true'});console.log(release.html_url);return;
 }
 if(!release)release=await api('/releases','POST',{tag_name:tag,name:'TikMnG 6.5.9',draft:true,body:'Zombie War bağlantı köprüsü kalıcı olarak yenilendi; her oyun oturumu artık ayrı servis kapısı kullanır. Dengesiz Yayıncı sesli kontrolü ve denge ayarları düzeltildi. Süper Lig hediye eşleşmeleri, cüce kaleci ve ses düğmesi güncellendi. Launcher kartları, dönen başlıklar ve yayın widgetları yenilendi.\n\nOyunlar launcher içindeki KUR / OYNA düğmelerinden açılır. Yayıncı ayarları güncellemelerde korunur.'});
 let files=[['TikMnG-Setup-6.5.9.exe',path.join(root,'launcher/dist/TikMnG Setup 6.5.9.exe')],['TikMnG-6.5.9-Portable.exe',path.join(root,'launcher/dist/TikMnG 6.5.9.exe')],...['tightrope-balance','mng-orbit','penalty-kick','zombie-war'].map(id=>[id+'.zip',path.join(releaseDir,id+'.zip')]),['KONTROL-RAPORU.md',path.join(releaseDir,'KONTROL-RAPORU.md')],['manifest-6.5.9.json',path.join(releaseDir,'manifest-6.5.9.json')]];
 if(process.argv.includes('--refresh-launcher')){
  if(!release.draft)throw Error('Yayımlanmış sürümün dosyaları değiştirilmez.');
  files=files.slice(0,2);
  for(const [name]of files){const old=release.assets.find(a=>a.name===name);if(old)await api('/releases/assets/'+old.id,'DELETE');}
  release.assets=release.assets.filter(a=>!files.some(([name])=>name===a.name));
 }
 for(const[name,file]of files){const size=fs.statSync(file).size;const existing=release.assets.find(a=>a.name===name);if(existing&&existing.size===size){console.log('Already uploaded '+name);continue}if(existing)throw Error(name+' var fakat farklı boyutta; dosya sürümünü kontrol edin.');const url=release.upload_url.split('{')[0]+'?name='+encodeURIComponent(name);const response=await fetch(url,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream','Content-Length':String(size)},body:Readable.toWeb(fs.createReadStream(file)),duplex:'half'});if(!response.ok)throw Error(name+': '+response.status+' '+await response.text());console.log('Uploaded '+name+' '+size)}
 console.log('Draft ready '+release.html_url);
})().catch(error=>{console.error(error.message);process.exitCode=1});
