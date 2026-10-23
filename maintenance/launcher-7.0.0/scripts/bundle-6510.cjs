const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const base=path.resolve(__dirname,'../..'),release=path.join(base,'release-v6.5.10');
const zip=path.join(__dirname,'../node_modules/7zip-bin/win/x64/7za.exe');
for(const id of ['tightrope-balance','mng-orbit','penalty-kick','zombie-war']){
 const dir=path.join(release,'staging',id);
 execFileSync(zip,['a','-tzip','-mx=3',path.join(release,id+'.zip'),'.','-xr!*.log','-xr!session.lock','-xr!launch-args.txt','-xr!crash-reports','-xr!logs','-xr!playerdata','-xr!stats','-xr!advancements','-xr!euler-api-key.txt','-xr!.env','-xr!bridge-error.log','-xr!bridge.log'],{cwd:dir,windowsHide:true,stdio:'ignore'});
 execFileSync(zip,['t',path.join(release,id+'.zip')],{windowsHide:true,stdio:'ignore'});
 console.log(id+': '+(fs.statSync(path.join(release,id+'.zip')).size/1048576).toFixed(1)+' MB verified');
}
