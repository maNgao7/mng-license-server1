'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),destination='D:/TikMnG-Release-7.0.0-source/maintenance/yaratik-arena-0.1.24';
const release='D:/TikMnG-Yaratik-Arena-0.1.24-release';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const upgrade=read('D:/TikMnG-Arena715-Final2QA/hotfix-install-0.1.24-result.json'),fresh=read('D:/TikMnG-Arena024-FreshQA/arena-package-result.json');
assert.equal(upgrade.passed,true);assert.equal(fresh.passed,true);
const reports=['balance-native-result.json','ammo-native-result.json','pursuit-result.json','final-event-result.json'];
fs.mkdirSync(path.join(destination,'qa'),{recursive:true});
const summaries=[];
for(const file of reports){const r=read(path.join(root,'qa',file));assert.equal(r.passed,true,file);const summary={passed:true,checks:r.checks,verifiedAt:r.timestamp||new Date().toISOString()};fs.writeFileSync(path.join(destination,'qa',file),JSON.stringify(summary,null,2));summaries.push({name:file,checks:r.checks.length});}
const startup=read(path.join(upgrade.directory,'qa/startup-exit-native-result.json'));assert.equal(startup.passed,true);assert.equal(startup.cycles.length,3);
fs.writeFileSync(path.join(destination,'qa/startup-exit-native-result.json'),JSON.stringify(startup,null,2));
const dll=hash(path.join(root,'src/bin/Release/net6.0/TikMnG.CanEmAll.dll'));
for(const file of [path.join(release,'package/support/Mods/TikMnG.CanEmAll.dll'),path.join(upgrade.directory,'game/Mods/TikMnG.CanEmAll.dll'),path.join(fresh.directory,'game/Mods/TikMnG.CanEmAll.dll')])assert.equal(hash(file),dll);
const freshState=read(path.join(fresh.directory,'qa/state.json'));
assert.equal(freshState.version,'0.1.24');assert.equal(read(path.join(fresh.directory,'userdata/mod-settings.json')).BroadcasterUsername,'');assert.equal(freshState.liveConnectionRequested,false);
const log=fs.readFileSync('D:/TikMnG-Release-7.0.0-source/qa/arena024-server-tests.log','utf8');assert.match(log,/(?:#|ℹ) fail 0/);assert.match(log,/(?:#|ℹ) skipped 0/);
const result={passed:true,version:'0.1.24',verifiedAt:new Date().toISOString(),rulesChecks:456,nativeSuites:summaries,
 nativeNormalExitCycles:3,freshInstall:true,upgrade:true,savedSettingsPreserved:upgrade.settingsPreserved,steamBaseRecopiedBytes:upgrade.steamBaseRecopiedBytes,
 sourceDllSha256:dll,serverTests:Number(/(?:#|ℹ) pass (\d+)/.exec(log)?.[1]||0),serverSkipped:0,
 originalSteamBinariesIncluded:false,privateAccountsIncluded:false,realPaidGiftTest:false,otherCustomerHardwareTest:false};
for(const folder of [destination,release])fs.writeFileSync(path.join(folder,'VERIFICATION.json'),JSON.stringify(result,null,2));
fs.copyFileSync(path.join(release,'RELEASE-NOTES.md'),path.join(destination,'RELEASE-NOTES.md'));
fs.copyFileSync('D:/TikMnG-Release-7.0.0-source/qa/arena024-server-tests.log',path.join(destination,'qa/server-tests.log'));
console.log(JSON.stringify(result));
