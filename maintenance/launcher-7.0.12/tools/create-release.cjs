'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),yaml=require('js-yaml');
const version=require('../package.json').version,root=process.env.MNG_RELEASE_DIR;
if(!root)throw Error('Explicit MNG_RELEASE_DIR required');
for(const[from,to]of [[`TikMnG Setup ${version}.exe`,`TikMnG-Setup-${version}.exe`],[`TikMnG Setup ${version}.exe.blockmap`,`TikMnG-Setup-${version}.exe.blockmap`],[`TikMnG ${version}.exe`,`TikMnG-${version}-Portable.exe`]]){
    if(fs.existsSync(path.join(root,from))){assert.ok(!fs.existsSync(path.join(root,to)));fs.renameSync(path.join(root,from),path.join(root,to));}
}
const feedFile=path.join(root,'latest.yml'),feed=yaml.load(fs.readFileSync(feedFile,'utf8'));
const names=[`TikMnG-Setup-${version}.exe`,`TikMnG-Setup-${version}.exe.blockmap`,`TikMnG-${version}-Portable.exe`];
const files=names.map(name=>{const b=fs.readFileSync(path.join(root,name));return{name,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),sha512:crypto.createHash('sha512').update(b).digest('base64')};});
const installer=files[0];feed.path=installer.name;for(const f of feed.files)if(f.sha512===installer.sha512)f.url=installer.name;
assert.equal(feed.version,version);assert.equal(feed.sha512,installer.sha512);assert.ok(feed.files.some(f=>f.url===installer.name&&f.size===installer.bytes));
fs.writeFileSync(feedFile,yaml.dump(feed,{lineWidth:-1}));
const catalog=require('../lib/catalog-defaults.json');
const videos=catalog.media.filter(m=>/\.(?:mp4|webm|mov|m4v)$/i.test(new URL(m.url).pathname)).length;
const sounds=catalog.media.filter(m=>/\.(?:mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(new URL(m.url).pathname)).length;
assert.equal(videos+sounds,catalog.media.length,'Every catalog media row must have a known media extension');
const manifest={version,createdAt:new Date().toISOString(),files,games:catalog.games.length,media:{videos,sounds,download:'separate-background'},installation:'per-user-one-click',signedPublisher:false};
fs.writeFileSync(path.join(root,`manifest-${version}.json`),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(root,'YUKLEME-TALIMATI.txt'),`TikMnG ${version}\n\nTikMnG-Setup-${version}.exe dosyasini acin. Kullanici hesabiniza tek tikla kurulur.\nMevcut oyunlar, lisans ve hediye/medya eslestirmeleri korunur.\nKurulum: ${(installer.bytes/1e6).toFixed(1)} MB (${(installer.bytes/1048576).toFixed(1)} MiB).\nRacon Krali, Yayin Guzeli, Yayin Yakisiklisi ve Ozel Giris Videolari eklendi.\nViral Benim gorunumu ve Sesli Yorumlarin kuyruk/yeniden deneme davranisi duzeltildi.\nYalnizca MNG Crowd Control listeden kaldirildi. Kalan ${catalog.games.length} oyunun paketleri degismedi; kurulu oyunlar yeniden indirilmez.\nEski surumde guncelleme bildirimi yoksa bu kurulumu bir defaya mahsus calistirin.\nVideo ve ses arsivi ayrica indirilir. Guncellemeden sonra yayin kaynaklarini bir kez yenileyin.\nWindows 10/11 64 bit. Imzalama sertifikasi olmadigindan SmartScreen uyarisi gorulebilir.\n`);
console.log(JSON.stringify({version,files:files.map(({name,bytes,sha256})=>({name,bytes,sha256})),games:manifest.games}));
