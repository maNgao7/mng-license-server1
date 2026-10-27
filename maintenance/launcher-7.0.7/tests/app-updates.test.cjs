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

test('release notes remain separate readable Turkish items for HTML and fallback Markdown',async()=>{
  const updater=new EventEmitter();updater.setFeedURL=()=>{};
  updater.checkForUpdates=async()=>({updateInfo:{version:'7.0.7',releaseNotes:'<h2>Yenilikler</h2><ul><li>Sesli Sürüş daha hızlı açılır.</li><li>Ayarlarınız korunur.</li></ul>'}});
  const normal=createAppUpdates({app,notify(){},loadUpdater:()=>updater,record(){}});
  assert.deepEqual((await normal.check()).changelog,['Yenilikler','Sesli Sürüş daha hızlı açılır.','Ayarlarınız korunur.']);
  const fallback=createAppUpdates({app,notify(){},loadUpdater(){throw Error('offline');},readRelease:async()=>({...release,notes:'# Yenilikler\n\n- Hızlı açılış\n- Kayıtlar korunur'}),record(){}});
  assert.deepEqual((await fallback.check()).changelog,['Hızlı açılış','Kayıtlar korunur']);
});

test('update timings distinguish differential fallback without persisting signed URLs or secrets',async()=>{
  const updater=new EventEmitter();updater.setFeedURL=()=>{};const records=[];
  updater.checkForUpdates=async()=>({updateInfo:{version:'7.0.7'}});
  updater.downloadUpdate=async()=>{
    updater.logger.info('Differential download: https://signed.invalid/?token=private');
    updater.logger.error('Cannot download differentially, fallback to full download: private-error');
    updater.emit('download-progress',{percent:8.964021423268356,transferred:100,total:1000,bytesPerSecond:100});
    updater.emit('update-downloaded');
  };
  updater.quitAndInstall=()=>{};
  const updates=createAppUpdates({app,notify(){},loadUpdater:()=>updater,record:event=>records.push(event),schedule:fn=>fn()});
  assert.equal((await updates.install()).basarili,true);
  assert.ok(records.some(event=>event.phase==='download-mode'&&event.mode==='differential'));
  assert.ok(records.some(event=>event.phase==='download-mode'&&event.mode==='full-fallback'));
  assert.ok(records.some(event=>event.phase==='download-verified'&&event.finalizationMs>=0));
  assert.equal(records.at(-1).phase,'installer-start');
  assert.doesNotMatch(JSON.stringify(records),/signed\.invalid|token=private|private-error/);
});

test('renderer shows bounded Turkish update percentages without long decimals',async()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const source=fs.readFileSync(path.join(__dirname,'../renderer/app.js'),'utf8');
  const start=source.indexOf('async function guncellemeBaslat()'),end=source.indexOf('\n// ===',start);
  assert.ok(start>0&&end>start);const elements=new Map();let progress;
  const context=vm.createContext({guncellemeBilgisi:null,document:{getElementById:id=>{
    if(!elements.has(id))elements.set(id,{style:{},textContent:''});return elements.get(id);
  }},API:{guncellemeIlerlemeDinle:callback=>{progress=callback;},guncellemeBittiDinle(){},guncellemeIndirVeKur:async()=>({basarili:true})}});
  vm.runInContext(source.slice(start,end),context);await context.guncellemeBaslat();
  for(const [percent,expected] of [[8.964021423268356,'%9'],[9.123456789,'%9,1'],[110,'%100'],[-1,'%0'],[NaN,'%0']]){
    progress({percent});assert.equal(elements.get('updatePercent').textContent,expected);
  }
});
