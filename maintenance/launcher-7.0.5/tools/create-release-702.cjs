'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),yaml=require('js-yaml');
const root=process.env.MNG_RELEASE_DIR||'D:/TikMnG-Release-7.0.2-candidate',version='7.0.2';
for(const[from,to]of [[`TikMnG Setup ${version}.exe`,`TikMnG-Setup-${version}.exe`],[`TikMnG Setup ${version}.exe.blockmap`,`TikMnG-Setup-${version}.exe.blockmap`],[`TikMnG ${version}.exe`,`TikMnG-${version}-Portable.exe`]]){
    if(fs.existsSync(path.join(root,from))){assert.ok(!fs.existsSync(path.join(root,to)));fs.renameSync(path.join(root,from),path.join(root,to));}
}
const feedFile=path.join(root,'latest.yml'),feed=yaml.load(fs.readFileSync(feedFile,'utf8'));
const names=[`TikMnG-Setup-${version}.exe`,`TikMnG-Setup-${version}.exe.blockmap`,`TikMnG-${version}-Portable.exe`];
const files=names.map(name=>{const b=fs.readFileSync(path.join(root,name));return{name,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),sha512:crypto.createHash('sha512').update(b).digest('base64')};});
const installer=files[0];feed.path=installer.name;for(const f of feed.files)if(f.sha512===installer.sha512)f.url=installer.name;
assert.equal(feed.version,version);assert.equal(feed.sha512,installer.sha512);assert.ok(feed.files.some(f=>f.url===installer.name&&f.size===installer.bytes));
fs.writeFileSync(feedFile,yaml.dump(feed,{lineWidth:-1}));
const media=require('../lib/catalog-defaults.json').media;
const manifest={version,createdAt:new Date().toISOString(),files,games:16,media:{videos:165,sounds:120,bytes:media.reduce((n,m)=>n+m.bytes,0),download:'separate-background'},installation:'per-user-one-click',signedPublisher:false,renderDeployment:'pending-user'};
fs.writeFileSync(path.join(root,'manifest-7.0.2.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(root,'YUKLEME-TALIMATI.txt'),`TikMnG 7.0.2\n\nTikMnG-Setup-7.0.2.exe dosyasini acin. Kullanici hesabiniza tek tikla kurulur.\nMevcut oyunlar, lisans ve hediye/medya eslestirmeleri korunur.\nKurulum: ${(installer.bytes/1e6).toFixed(1)} MB (${(installer.bytes/1048576).toFixed(1)} MiB).\n16 oyun launcher icinden ayrica indirilir. Video ve ses arsivi arka planda ayrica iner, duraklatilabilir.\nSes paketleri ayri ve istege baglidir. Sesli Surus icin Steam CAAAHR Demo gerekir.\nWindows 10/11 64 bit. Yayinci imzalama sertifikasi olmadigindan SmartScreen uyarisi gorulebilir.\nOyun klasorlerinizi ve kayitli ayarlarinizi silmeyin.\n`);
console.log(JSON.stringify(manifest));
