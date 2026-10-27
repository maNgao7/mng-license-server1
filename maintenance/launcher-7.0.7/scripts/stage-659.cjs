const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const base = path.resolve(__dirname, '../..');
const release = path.join(base, 'release-v6.5.9');
const staging = path.join(release, 'staging');
const zombieSource = path.join(path.dirname(base), 'MNG-Zombie-Strike');
const copy = (from, to, filter) => { fs.mkdirSync(path.dirname(to), {recursive:true}); fs.cpSync(from,to,{recursive:true,filter}); };
const marker = dir => fs.writeFileSync(path.join(dir,'.tikmng-package.json'),JSON.stringify({version:'6.5.9'},null,2));
const excluded = /(^|[\\/])(?:logs|crash-reports|\.git|\.gradle|\.map-import|video-frames)(?:[\\/]|$)|\.(?:log|tmp)$/i;
const filter = src => !excluded.test(src);
fs.mkdirSync(staging,{recursive:true});
for (const id of ['tightrope-balance','mng-orbit','penalty-kick']) {
  const source=path.join(base,'apps',id), dest=path.join(staging,id);
  copy(source,dest,p=>filter(p)&&!/[\\/](?:latest-|audience-check|finish-plaza-check|voice-hud|responsive-hud|character-|lava-jars)/.test(p));
  const shared=path.join(base,'apps','tiktok-vs');
  for(const file of ['.gift-catalog.json','.gorunen-hediyeler.json']){if(fs.existsSync(path.join(shared,file)))copy(path.join(shared,file),path.join(dest,'shared',file));}
  for(const folder of ['gift-images','gift-catalog','gifts'])copy(path.join(shared,'public','assets',folder),path.join(dest,'shared','public','assets',folder));
  execFileSync('cmd.exe',['/d','/s','/c','npm install --omit=dev --ignore-scripts --no-audit --no-fund'],{cwd:dest,stdio:'inherit',windowsHide:true});
  marker(dest); console.log('Staged '+id);
}
const zombie=path.join(staging,'zombie-war');
copy(path.join(zombieSource,'launch-game.cjs'),path.join(zombie,'launch-game.cjs'));
copy(path.join(zombieSource,'live-bridge'),path.join(zombie,'live-bridge'),p=>filter(p)&&!p.endsWith('probe-live.js'));
for(const part of ['config','tacz','resourcepacks','defaultconfigs']){
 const p=path.join(zombieSource,'game-instance',part);if(fs.existsSync(p))copy(p,path.join(zombie,'game-instance',part),filter);
}
for(const map of ['dust2','office','fighting_arena','romanya']) {
 copy(path.join(zombieSource,'game-instance','saves',map),path.join(zombie,'game-instance','saves',map),p=>filter(p)&&!/[\\/](?:playerdata|stats|advancements)(?:[\\/]|$)/.test(p)&&!p.endsWith('session.lock'));
}
copy(path.join(zombieSource,'game-instance','options.txt'),path.join(zombie,'game-instance','options.txt'));
copy(path.join(zombieSource,'bundled-mods'),path.join(zombie,'game-instance','mods'));
copy(path.join(zombieSource,'forge-mod','build','libs','mng_zombie_strike-1.0.0.jar'),path.join(zombie,'game-instance','mods','mng-zombie-strike-1.0.0.jar'));
const mc=path.join(process.env.APPDATA,'.minecraft'), version=path.join(mc,'versions','Forge 1.20.1');
const profile=JSON.parse(fs.readFileSync(path.join(version,'Forge 1.20.1.json'),'utf8'));
profile.libraries=profile.libraries.filter(item=>!item.rules?.length||item.rules.reduce((allowed,rule)=>(!rule.os?.name||rule.os.name==='windows')?rule.action==='allow':allowed,false));
const runtime=path.join(zombie,'runtime');fs.mkdirSync(runtime,{recursive:true});
fs.writeFileSync(path.join(runtime,'profile.json'),JSON.stringify(profile,null,2));
for(const item of profile.libraries){const artifact=item.artifact||item.downloads?.artifact;if(!artifact?.path)continue;const rel=artifact.path.replace(/^libraries[\\/]/,'');copy(path.join(mc,'libraries',rel),path.join(runtime,'libraries',rel));}
for(const rel of ['net/minecraft/client','net/minecraftforge'])copy(path.join(mc,'libraries',rel),path.join(runtime,'libraries',rel));
copy(path.join(version,'Forge 1.20.1.jar'),path.join(runtime,'client.jar'));
copy(path.join(version,'natives'),path.join(runtime,'natives'));
const javaBase=path.join(mc,'runtime','java-runtime-gamma');
function findJava(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.isDirectory()){const p=path.join(dir,e.name);if(fs.existsSync(path.join(p,'bin','java.exe')))return p;const found=findJava(p);if(found)return found;}}}
copy(findJava(javaBase),path.join(runtime,'java'));
const index=JSON.parse(fs.readFileSync(path.join(mc,'assets','indexes',profile.assetIndex.id+'.json'),'utf8'));
copy(path.join(mc,'assets','indexes',profile.assetIndex.id+'.json'),path.join(runtime,'assets','indexes',profile.assetIndex.id+'.json'));
for(const {hash}of Object.values(index.objects))copy(path.join(mc,'assets','objects',hash.slice(0,2),hash),path.join(runtime,'assets','objects',hash.slice(0,2),hash));
marker(zombie);console.log('Staged zombie-war runtime, maps, mods and Java');
execFileSync(process.execPath,[path.join(zombie,'launch-game.cjs'),'--check'],{stdio:'inherit'});
console.log(release);
