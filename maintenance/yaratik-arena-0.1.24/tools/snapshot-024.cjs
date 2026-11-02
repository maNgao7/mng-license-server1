'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),previous='D:/TikMnG-Release-7.0.0-source/maintenance/yaratik-arena-0.1.23';
const destination='D:/TikMnG-Release-7.0.0-source/maintenance/yaratik-arena-0.1.24';
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?['bin','obj','node_modules'].includes(e.name)?[]:walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function copy(relative){const target=path.join(destination,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,relative),target);}
for(const folder of ['src','tests','bridge','catalog','defaults','assets','bootstrap']){
 const current=['src','tests'].includes(folder),inventory=path.join(current?root:previous,folder);
 for(const file of walk(inventory)){
  const relative=path.relative(current?root:previous,file);
  if(/\.(?:exe|dll|zip|pdb|log)$/i.test(relative))continue;
  if(fs.existsSync(path.join(root,relative)))copy(relative);
 }
}
for(const file of ['balance-native-tests.cjs','run-balance-release.cjs','ammo-native-tests.cjs','pursuit-tests.cjs','final-event-tests.cjs','startup-exit-native-tests.cjs','connection-menu-hotfix-tests.cjs','commands.cjs','install-hotfix.cjs'])copy('qa/'+file);
for(const file of ['prepare-launcher-package.cjs','snapshot-024.cjs','record-024-verification.cjs'])if(fs.existsSync(path.join(root,'tools',file)))copy('tools/'+file);
copy('README.md');
fs.copyFileSync('D:/TikMnG-Yaratik-Arena-0.1.24-release/package-descriptor.json',path.join(destination,'package-descriptor.json'));
console.log(destination);
