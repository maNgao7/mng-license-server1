'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const dependencies=require('node:module').createRequire('C:/Users/User/Desktop/MNG-TikTok-Game/launcher/package.json');
const asar=dependencies('@electron/asar'),yaml=dependencies('js-yaml');
const source=path.resolve(__dirname,'..'),stage='D:/TikMnG-Release-7.0.13-build',root='D:/TikMnG-Release-7.0.13-delta-ready';
const hash=(data,algorithm='sha256',encoding='hex')=>crypto.createHash(algorithm).update(data).digest(encoding);
const archive=path.join(root,'win-unpacked/resources/app.asar');
function suite(file,minimum){
    const text=fs.readFileSync(file,'utf8').replaceAll('\r','');
    const count=Number(/^.*\bpass (\d+)$/m.exec(text)?.[1]);
    assert.ok(count>=minimum,file);assert.match(text,/^.*\bfail 0$/m);assert.match(text,/^.*\bskipped 0$/m);
    return {passed:count,failed:0,skipped:0};
}
const launcherTests=suite(path.join(source,'test-713-delta-final.log'),1107);
const serverTests=suite('D:/TikMnG-Release-7.0.0-source/qa/traffic-wire/server-tests.log',89);
const packaged=JSON.parse(fs.readFileSync(path.join(source,'qa-packaged713-delta-stable.log'),'utf8'));
assert.ok(packaged.passed&&packaged.exactDeltaProtocol&&packaged.originalProfileUnchanged);
const speech=JSON.parse(fs.readFileSync(path.join(source,'qa/713/packaged-speech.json'),'utf8'));assert.ok(speech.passed);
const delta=JSON.parse(fs.readFileSync(path.join(source,'qa/713/delta-result.json'),'utf8'));
assert.ok(delta.passed&&delta.chrome?.giftVisible&&delta.httpRecovery?.reconnectFullResync);
assert.equal(JSON.parse(asar.extractFile(archive,'package.json')).version,'7.0.13');
for(const file of ['main.js','preload.js','lib/widget-changes.cjs','lib/widget-delta.cjs','lib/widget-snapshot.cjs','lib/game-widget-host.cjs','lib/widget-studio.cjs','lib/entry-videos.cjs','renderer/widgets/state-patch.js','renderer/widgets/change-transport.js','renderer/widgets/game.html','renderer/widgets/reference-widgets.html','renderer/widgets/royal-widgets.html','renderer/widgets/live-score-widgets.html']){
    const digest=hash(asar.extractFile(archive,path.normalize(file)));
    assert.equal(digest,hash(fs.readFileSync(path.join(stage,file))),file+' stage');
    assert.equal(digest,hash(fs.readFileSync(path.join(source,file))),file+' source');
}
const files=[];
for(const [from,to] of [['TikMnG Setup 7.0.13.exe','TikMnG-Setup-7.0.13.exe'],['TikMnG Setup 7.0.13.exe.blockmap','TikMnG-Setup-7.0.13.exe.blockmap'],['TikMnG 7.0.13.exe','TikMnG-7.0.13-Portable.exe']]){
    const data=fs.readFileSync(path.join(root,from));fs.copyFileSync(path.join(root,from),path.join(root,to));
    files.push({name:to,bytes:data.length,sha256:hash(data),sha512:hash(data,'sha512','base64')});
}
const feed=yaml.load(fs.readFileSync(path.join(root,'latest.yml'),'utf8'));
assert.equal(feed.version,'7.0.13');assert.equal(feed.sha512,files[0].sha512);assert.equal(feed.files[0].size,files[0].bytes);
feed.path=files[0].name;feed.files[0].url=files[0].name;
fs.writeFileSync(path.join(root,'latest.yml'),yaml.dump(feed,{lineWidth:-1}));
const report={passed:true,version:'7.0.13',createdAt:new Date().toISOString(),launcherTests,serverTests,packaged,
    speech,traffic:delta.traffic,realChrome:delta.chrome,settingsPreserved:true,qualityUnchanged:true,
    invoiceReductionGuaranteed:false,realPaidGiftTest:false,otherCustomerHardwareTest:false,signedPublisher:false};
fs.writeFileSync(path.join(root,'KONTROL-RAPORU.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(root,'manifest-7.0.13.json'),JSON.stringify({version:'7.0.13',createdAt:new Date().toISOString(),files},null,2)+'\n');
fs.copyFileSync(path.join(source,'RELEASE-NOTES-7.0.13.md'),path.join(root,'RELEASE-NOTES-7.0.13.md'));
const instructions='TikMnG 7.0.13 - Dusuk trafik guncellemesi\r\n\r\n'+
    'Bu klasordeki dort dosyayi mevcut Google Drive klasorune yukleyin. Ayni adli varsa Mevcut ogeyi degistir secin. Eski EXE dosyalarini silmeyin.\r\n\r\n'+
    'GitHub ana indirme/guncelleme kaynagidir; Drive yedektir.\r\n'+
    'Render: Manual Deploy > Deploy latest commit. /api/version sonucu 7.0.13 olmali.\r\n'+
    'Kullanicilar launcher 7.0.13 guncellemesini uygulamali; kaldirma veya lisansi silme yok.\r\n'+
    'Live Studio/OBS icindeki mevcut widget baglanti kaynaklarini bir kez yenileyin. URL degismez.\r\n'+
    'Tam tasarruf icin yeni launcher ve kaynagin yenilenmesi gerekir. Eski acik HTML yalniz sikistirmadan yararlanabilir.\r\n'+
    'Kullanilmayan/duble baglanti kaynaklarini yayin sahnesinden kaldirin veya devre disi birakin.\r\n'+
    'Yerel olcum yuzdesi fatura garantisi degildir; yayindan sonra gercek sayac tekrar kontrol edilir.\r\n'+
    'Windows yayinci sertifikasi yoktur; SmartScreen uyarisi gorulebilir.\r\n';
fs.writeFileSync(path.join(root,'YUKLEME-TALIMATI.txt'),instructions);
const folder=path.join(process.env.USERPROFILE,'Desktop/TikMnG-Drive-7.0.13');fs.mkdirSync(folder,{recursive:true});
for(const file of [files[0].name,'latest.yml','manifest-7.0.13.json','YUKLEME-TALIMATI.txt']){
    fs.copyFileSync(path.join(root,file),path.join(folder,file));
    assert.equal(hash(fs.readFileSync(path.join(folder,file))),hash(fs.readFileSync(path.join(root,file))));
}
console.log(JSON.stringify({passed:true,folder,root,launcherTests,serverTests,files}));
