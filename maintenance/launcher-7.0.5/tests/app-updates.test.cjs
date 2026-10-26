const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createAppUpdates}=require('../lib/app-updates.cjs');
const {releaseInfo,newer}=require('../lib/update-release.cjs');
const release={version:'7.0.5',url:'https://github.com/maNgao7/mng-license-server1/releases/download/v7.0.5/TikMnG-Setup-7.0.5.exe',name:'TikMnG-Setup-7.0.5.exe',bytes:123,sha256:'a'.repeat(64),notes:'Hotfix'};
const app={getVersion:()=> '7.0.1',isPackaged:true,getPath:()=>require('node:os').tmpdir()};
test('missing updater dependency still detects the official update',async()=>{
  const updates=createAppUpdates({app,notify(){},loadUpdater(){throw Error('MODULE_NOT_FOUND');},readRelease:async()=>release});
  const result=await updates.check();assert.equal(result.guncellemeVar,true);assert.equal(result.latestVersion,'7.0.5');assert.equal(result.fallback,true);
});
test('network failure is not reported as confirmed up-to-date',async()=>{
  const updates=createAppUpdates({app,notify(){},loadUpdater(){throw Error('offline');},readRelease:async()=>{throw Error('offline');}});
  const result=await updates.check();assert.equal(result.checkFailed,true);assert.ok(result.hata);
});
test('fallback installer requires the official digest before launch, preserves user paths',async()=>{
  let launched=0,quit=0,downloads=0;
  const updates=createAppUpdates({app:{...app,quit(){quit++;}},notify(){},loadUpdater(){throw Error('missing');},readRelease:async()=>release,
    download:async(url,file,options)=>{assert.equal(url,release.url);assert.equal(options.sha256,release.sha256);assert.equal(options.bytes,123);downloads++;},launchInstaller:async file=>{assert.ok(file.endsWith(release.name));launched++;}});
  assert.equal((await updates.install()).basarili,true);assert.equal(launched,1);assert.equal(quit,1);assert.equal(downloads,1);
  const unsafe=createAppUpdates({app,notify(){},loadUpdater(){throw Error('missing');},readRelease:async()=>({...release,sha256:null}),download:async()=>assert.fail(),launchInstaller:async()=>assert.fail()});
  assert.equal((await unsafe.install()).basarili,false);
});
test('normal updater remains preferred and requires download completion',async()=>{
  const updater=new EventEmitter();updater.setFeedURL=()=>{};updater.checkForUpdates=async()=>({updateInfo:{version:'7.0.5'}});
  updater.downloadUpdate=async()=>updater.emit('update-downloaded');let installed=false;
  updater.quitAndInstall=()=>{installed=true;};
  const updates=createAppUpdates({app,notify(){},loadUpdater:()=>updater,readRelease:async()=>assert.fail(),schedule:fn=>fn()});
  assert.equal((await updates.install()).basarili,true);assert.equal(installed,true);
});
test('stable release and executable URL are constrained to the owned GitHub repository',()=>{
  const valid={tag_name:'v7.0.5',assets:[{name:release.name,browser_download_url:release.url,size:123,digest:'sha256:'+release.sha256}]};
  assert.equal(releaseInfo(valid).sha256,release.sha256);
  for(const bad of [{...valid,draft:true},{...valid,prerelease:true},{...valid,assets:[{...valid.assets[0],browser_download_url:'https://evil.invalid/setup.exe'}]}])assert.throws(()=>releaseInfo(bad));
  assert.equal(newer('7.0.5','7.0.1'),true);assert.equal(newer('7.0.5','7.0.5'),false);assert.equal(newer('7.0.5-beta','7.0.1'),false);
});
