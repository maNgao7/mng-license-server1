'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const yaml=require('C:/Users/User/Desktop/MNG-TikTok-Game/launcher/node_modules/js-yaml');
const root='D:/TikMnG-Release-7.0.8-ready',repo='D:/TikMnG-Release-7.0.0-source',version='7.0.8';
for(const file of ['package.json','package-lock.json']){
  const location=path.join(repo,file),data=JSON.parse(fs.readFileSync(location,'utf8'));
  data.version=version;if(data.packages?.[''])data.packages[''].version=version;
  fs.writeFileSync(location,JSON.stringify(data,null,2)+'\n');
}
for(const [from,to] of [[`TikMnG Setup ${version}.exe`,`TikMnG-Setup-${version}.exe`],[`TikMnG Setup ${version}.exe.blockmap`,`TikMnG-Setup-${version}.exe.blockmap`],[`TikMnG ${version}.exe`,`TikMnG-${version}-Portable.exe`]]){
  if(fs.existsSync(path.join(root,from))){assert.ok(!fs.existsSync(path.join(root,to)));fs.renameSync(path.join(root,from),path.join(root,to));}
}
const names=[`TikMnG-Setup-${version}.exe`,`TikMnG-Setup-${version}.exe.blockmap`,`TikMnG-${version}-Portable.exe`];
const files=names.map(name=>{const bytes=fs.readFileSync(path.join(root,name));return {name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),sha512:crypto.createHash('sha512').update(bytes).digest('base64')};});
const feedPath=path.join(root,'latest.yml'),feed=yaml.load(fs.readFileSync(feedPath,'utf8')),installer=files[0];
assert.equal(feed.version,version);assert.equal(feed.sha512,installer.sha512);
feed.path=installer.name;
for(const file of feed.files)if(file.sha512===installer.sha512)file.url=installer.name;
assert.ok(feed.files.some(file=>file.url===installer.name&&file.size===installer.bytes));
feed.releaseName='TikMnG 7.0.8';feed.releaseNotes=fs.readFileSync(path.join(repo,'RELEASE-7.0.8.md'),'utf8');
fs.writeFileSync(feedPath,yaml.dump(feed,{lineWidth:-1}));
const manifest={version,createdAt:new Date().toISOString(),files,games:15,widgets:20,media:{videos:165,sounds:120,download:'separate-background'},installation:'per-user-one-click',signedPublisher:false};
fs.writeFileSync(path.join(root,'manifest-7.0.8.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(root,'YUKLEME-TALIMATI.txt'),`TikMnG 7.0.8\n\nTikMnG-Setup-7.0.8.exe dosyasini acin. Mevcut uygulamanin uzerine kurulur.\nOyunlar, lisans, videolar, sesler ve hediye eslestirmeleri korunur.\nUc yeni widget ve Ozel Giris Videolari eklendi; Sesli Yorumlar guclendirildi.\nYalnizca MNG Crowd Control listeden kaldirildi. Diger 15 oyun paketi degismedi.\nGuncellemeden sonra yayin kaynaklarini bir kez yenileyin; URL degistirmek gerekmez.\nDrive yedegi: EXE, latest.yml, manifest-7.0.8.json ve bu dosya. Ayni adlarda mevcut ogeyi degistirin; eski EXE dosyalarini silmeyin.\nWindows 10/11 64 bit. Imzalama sertifikasi bulunmadigindan SmartScreen uyarisi gorulebilir.\n`);
console.log(JSON.stringify({version,files:files.map(({name,bytes,sha256})=>({name,bytes,sha256}))},null,2));
