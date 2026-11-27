'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const HASH='9132d5631f59661f8bde912d6b1e5b9788c24fd7031bb1aa81d16b298b293e67';
const root=path.resolve(__dirname,'..');
function gamePath(env=process.env){return env.TIKMNG_RING_NATIVE_GAME||'D:/TikMnG/Hediye-Box-Private/native-game/boxing.exe';}
function pythonPath(){const file=path.join(root,'runtime/python/python.exe');return fs.existsSync(file)?file:'C:/Python314/python.exe';}
function sourceDirectory(env=process.env){
 if(env.TIKMNG_RING_GAME_SOURCE)return path.resolve(env.TIKMNG_RING_GAME_SOURCE);
 const roots=[env['ProgramFiles(x86)']&&path.join(env['ProgramFiles(x86)'],'Steam'),env.ProgramFiles&&path.join(env.ProgramFiles,'Steam'),'C:/Program Files (x86)/Steam','D:/SteamLibrary'];
 for(const directory of [...roots].filter(Boolean)){
  try{const text=fs.readFileSync(path.join(directory,'steamapps/libraryfolders.vdf'),'utf8');for(const match of text.matchAll(/"path"\s+"([^"]+)"/g))roots.push(match[1].replaceAll('\\\\','\\'));}catch{}
 }
 return [...new Set(roots.filter(Boolean))].map(directory=>path.join(directory,'steamapps/common/OnlineBoxing3DDemo')).find(directory=>fs.existsSync(path.join(directory,'boxing.exe')));
}
async function prepareNative({dataDirectory,appRoot=root,source=sourceDirectory(),expectedHash=HASH}={}){
 const patch=path.join(appRoot,'runtime/native-patch');
 if(!fs.existsSync(path.join(patch,'manifest.json')))return gamePath();
 if(!dataDirectory)throw Error('Ring kayıt klasörü belirlenemedi.');
 const destination=path.resolve(dataDirectory,'native-game');
 const manifest=JSON.parse(await fs.promises.readFile(path.join(patch,'manifest.json'),'utf8'));
 const valid=async file=>{try{return crypto.createHash('sha256').update(await fs.promises.readFile(file)).digest('hex')===expectedHash;}catch{return false;}};
 const executable=path.join(destination,'boxing.exe');
 if(!await valid(executable)){
  let sourceHash='';try{sourceHash=crypto.createHash('sha256').update(await fs.promises.readFile(path.join(source,'boxing.exe'))).digest('hex');}catch{}
  const compatibility=manifest.compatibility?.find(item=>item.sourceHash===sourceHash);
  if(!source||sourceHash!==expectedHash&&!compatibility)throw Error('Ring için uyumlu Steam Online Boxing 3D Demo kurulmalı. Launcher’daki Demo indir bağlantısını açın; kuruluysa oyun klasörünü seçin.');
  const temp=path.resolve(dataDirectory,'native-game-installing');
  if(temp===path.resolve(source)||destination===path.resolve(source))throw Error('Kaynak ve Ring klasörü aynı olamaz.');
  await fs.promises.mkdir(dataDirectory,{recursive:true});
  await fs.promises.cp(source,temp,{recursive:true,force:true,filter:file=>!['MUJOCO_LOG.TXT','.tikmng-ring.json'].includes(path.basename(file))});
  if(compatibility){
   const delta=path.join(patch,compatibility.file);
   if(crypto.createHash('sha256').update(await fs.promises.readFile(delta)).digest('hex')!==compatibility.sha256)throw Error('Uyumluluk paketi doğrulanamadı.');
   const target=path.join(temp,'boxing-compatible.exe');
   await require('node:util').promisify(require('node:child_process').execFile)(pythonPath(),[path.join(appRoot,'tools/native-delta.py'),'apply-chunks',path.join(temp,'boxing.exe'),delta,target,sourceHash],{windowsHide:true,timeout:90000,maxBuffer:1048576});
   if(!await valid(target))throw Error('Uyumlu demo doğrulanamadı.');
   await fs.promises.rename(target,path.join(temp,'boxing.exe'));
  }
  if(!await valid(path.join(temp,'boxing.exe')))throw Error('Demo kopyası doğrulanamadı.');
  if(fs.existsSync(destination))await fs.promises.rename(destination,destination+'-previous-'+Date.now());
  await fs.promises.rename(temp,destination);
 }
 for(const item of manifest.files){
  if(!item.path||path.isAbsolute(item.path)||item.path.split(/[\\/]/).includes('..'))throw Error('Geçersiz Ring dosya yolu.');
  const input=path.join(patch,item.path),output=path.join(destination,item.path),bytes=await fs.promises.readFile(input);
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('Ring dosyası doğrulanamadı: '+item.path);
  await fs.promises.mkdir(path.dirname(output),{recursive:true});await fs.promises.writeFile(output,bytes);
 }
 const marker=path.join(destination,'.tikmng-ring.json'),tempMarker=marker+'.tmp';await fs.promises.writeFile(tempMarker,JSON.stringify({version:manifest.version,sourceHash:expectedHash}));await fs.promises.rename(tempMarker,marker);
 return executable;
}
module.exports={gamePath,pythonPath,sourceDirectory,prepareNative,HASH};
