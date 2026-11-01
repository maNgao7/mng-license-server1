'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const buildRequire=require('node:module').createRequire('C:/Users/User/Desktop/MNG-TikTok-Game/launcher/package.json');
const asar=buildRequire('@electron/asar'),yaml=buildRequire('js-yaml');
const source=path.resolve(__dirname,'..'),root='D:/TikMnG-Release-7.0.10-ready',stage='D:/TikMnG-Release-7.0.10-build';
const hash=(data,algorithm='sha256',encoding='hex')=>crypto.createHash(algorithm).update(data).digest(encoding);
const archive=path.join(root,'win-unpacked/resources/app.asar');
assert.equal(JSON.parse(asar.extractFile(archive,'package.json')).version,'7.0.10');
for(const file of ['main.js','preload.js','lib/platform.cjs','lib/widget-portraits.cjs','lib/portrait-engine.cjs','lib/profile-contest-launch.cjs','lib/admin-games.json','renderer/workspace.js','renderer/widgets/royal-widgets.html','renderer/widgets/reference-widgets.html','renderer/widgets/live-score-widgets.html'])assert.equal(hash(asar.extractFile(archive,path.normalize(file))),hash(fs.readFileSync(path.join(stage,file))),file);
assert.equal(hash(asar.extractFile(archive,'lib/admin-games.json')),hash(fs.readFileSync('D:/TikMnG-Release-7.0.9-build/lib/admin-games.json')));
for(const report of ['widget-refresh','profile-contest-native','profile-https','fast-speech','packaged-result'])assert.equal(JSON.parse(fs.readFileSync(path.join(source,'qa/710',report+'.json'))).passed,true,report);
const xml=fs.readFileSync(path.join(source,'qa/710/all-tests-verified.xml'),'utf8');assert.equal(/<failure\b/.test(xml),false);assert.equal(/<skipped\b/.test(xml),false);
const tests=(xml.match(/<testcase\b/g)||[]).length;assert.ok(tests>=990);
const files=[];
for(const [from,name] of [['TikMnG Setup 7.0.10.exe','TikMnG-Setup-7.0.10.exe'],['TikMnG Setup 7.0.10.exe.blockmap','TikMnG-Setup-7.0.10.exe.blockmap'],['TikMnG 7.0.10.exe','TikMnG-7.0.10-Portable.exe']]){
 const data=fs.readFileSync(path.join(root,from));fs.copyFileSync(path.join(root,from),path.join(root,name));files.push({name,bytes:data.length,sha256:hash(data),sha512:hash(data,'sha512','base64')});
}
const game=fs.readFileSync(path.join(root,'games/profile-contest-0.3.0.zip'));assert.equal(hash(game),'bfea65a15399612a8cfea4a74bc6e0718b757e220544451aa4ab583d02dca7ab');
fs.copyFileSync(path.join(root,'games/profile-contest-0.3.0.zip'),path.join(root,'profile-contest-0.3.0.zip'));files.push({name:'profile-contest-0.3.0.zip',bytes:game.length,sha256:hash(game)});
const feed=yaml.load(fs.readFileSync(path.join(root,'latest.yml'),'utf8'));assert.equal(feed.version,'7.0.10');assert.equal(feed.path,files[0].name);assert.equal(feed.sha512,files[0].sha512);assert.equal(feed.files[0].size,files[0].bytes);
const report={passed:true,version:'7.0.10',createdAt:new Date().toISOString(),launcherTests:{passed:tests,failed:0,skipped:0},packagedIPC:true,actualHTTPSWidget:true,original1080Bytes:true,royalFrameVariants:18,notificationFrames:6,realPaidGiftTest:false,signedPublisher:false,publicAdminMetadataPreserved:true};
fs.writeFileSync(path.join(root,'KONTROL-RAPORU.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(root,'manifest-7.0.10.json'),JSON.stringify({version:'7.0.10',createdAt:new Date().toISOString(),files},null,2)+'\n');
fs.copyFileSync(path.join(source,'RELEASE-NOTES-7.0.10.md'),path.join(root,'RELEASE-NOTES-7.0.10.md'));
fs.writeFileSync(path.join(root,'YUKLEME-TALIMATI.txt'),'TikMnG 7.0.10\r\n\r\nBu klasordeki dort dosyayi mevcut Drive klasorune yukleyin. Ayni adlilarda mevcut dosyayi degistirin. Eski EXE ve kayitlari silmeyin.\r\n\r\nGitHub ana guncelleme kaynagidir; Drive yedektir. Profil Yarismasi oyun ZIP dosyasi GitHub uzerinden ayri indirilir.\r\n\r\nDrive tamamlaninca Render > Manual Deploy > Deploy latest commit. Surum 7.0.10 olmali. Uygulamayi kaldirmayin.\r\nWindows yayinci sertifikasi yoktur; SmartScreen uyarisi gorulebilir.\r\n');
const folders=['D:/TikMnG-Drive-7.0.10-Hazir',path.join(process.env.USERPROFILE,'Desktop/TikMnG-Drive-7.0.10')];
for(const folder of folders){fs.mkdirSync(folder,{recursive:true});for(const name of [files[0].name,'latest.yml','manifest-7.0.10.json','YUKLEME-TALIMATI.txt']){fs.copyFileSync(path.join(root,name),path.join(folder,name));assert.equal(hash(fs.readFileSync(path.join(folder,name))),hash(fs.readFileSync(path.join(root,name))));}}
console.log(JSON.stringify({report,folders,files}));
