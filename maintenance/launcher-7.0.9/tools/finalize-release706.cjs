'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root='D:/TikMnG-Release-7.0.6-candidate',repo='D:/TikMnG-Release-7.0.0-source';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest-7.0.6.json'),'utf8'));
assert.equal(manifest.version,'7.0.6');
const report={version:'7.0.6',createdAt:new Date().toISOString(),installerBytes:manifest.files[0].bytes,
    launcherTests:{passed:975,failed:0},serverTests:{passed:60,failed:0,skipped:3},
    snake:{version:'0.16.0',coreSuites:21,pursuitCases:106,nativeCaptureCount:9,realLiveGiftsObserved:true},
    widgets:{transparentSources:17,wingTiers:6,alphaAndMotionVerified:true,settingsGalleryVerified:true,jarOverflowVerified:true},
    preservation:{gameSettings:true,otherGames:5,mediaAndSpeech:true,stableProfileUntouched:true},
    packagedFirstRun:true,httpsWidgetLinks:17,independentAlertScreens:8,packagedSourceHashes:17,
    liveStudioAudiovisualAcceptance:false,renderDeployment:'pending-user',signedPublisher:false};
fs.writeFileSync(path.join(root,'KONTROL-RAPORU.json'),JSON.stringify(report,null,2)+'\n');
const instructions=`TikMnG 7.0.6\n\nDRIVE YUKLEMESI\nBu klasordeki dort dosyayi mevcut TikMnG Drive klasorune surukleyin.\nAyni adli dosyalarda Mevcut ogeyi degistir secin. Dosya adlarini degistirmeyin.\nEski EXE dosyalarini simdilik silmeyin.\n\nTikMnG-Setup-7.0.6.exe: ${(manifest.files[0].bytes/1e6).toFixed(1)} MB.\nKurulum tek tikla kullanici hesabina yapilir; lisanslar, oyunlar ve hediye eslestirmeleri korunur.\nYeni yilan surumu: 0.16.0. O savasi baslatir, Tab yayinciyi oyuna alir.\nMevcut yilan kurulumunda yalnizca yaklasik 44.1 MB degisen dosya indirilir.\nTum yayin widgetlari saydamdir; eski widget baglantilari korunur.\n\nDrive yuklemesi bitince Render Manual Deploy > Deploy latest commit adimina gecilecek.\nGitHub guncelleme kaynagi, Drive yedek indirme kopyasidir.\nWindows yayinci sertifikasi olmadigindan SmartScreen uyarisi gorulebilir.\n`;
fs.writeFileSync(path.join(root,'YUKLEME-TALIMATI.txt'),instructions);
for(const directory of ['D:/TikMnG-Drive-Son-7.0.6',path.join(process.env.USERPROFILE,'Desktop/TikMnG-Drive-7.0.6')]){
    fs.mkdirSync(directory,{recursive:true});
    for(const name of ['TikMnG-Setup-7.0.6.exe','latest.yml','manifest-7.0.6.json','YUKLEME-TALIMATI.txt']){
        const from=path.join(root,name),to=path.join(directory,name);fs.copyFileSync(from,to);
        const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');assert.equal(hash(from),hash(to));
    }
}
const snake='D:/TikMnG-Snake-Arena-Prototype',snapshot=path.join(repo,'maintenance/snake-0.16.0');
for(const relative of ['mod/src','mod/build.gradle','mod/settings.gradle','mod/gradle.properties','mod/gradle','mod/gradlew','mod/gradlew.bat','launch-game.cjs','widget-server.cjs','widget.html','qa/run-core-checks.ps1','qa/TASARIM-0.16.0.md']){
    const to=path.join(snapshot,relative);fs.mkdirSync(path.dirname(to),{recursive:true});fs.cpSync(path.join(snake,relative),to,{recursive:true});
}
for(const name of fs.readdirSync(path.join(snake,'qa')).filter(n=>n.endsWith('.java'))){const to=path.join(snapshot,'qa',name);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(snake,'qa',name),to);}
fs.mkdirSync(path.join(repo,'qa/release-7.0.6'),{recursive:true});
fs.writeFileSync(path.join(repo,'qa/release-7.0.6/verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({version:report.version,installerMB:report.installerBytes/1e6,driveFolders:['D:/TikMnG-Drive-Son-7.0.6',path.join(process.env.USERPROFILE,'Desktop/TikMnG-Drive-7.0.6')]}));
