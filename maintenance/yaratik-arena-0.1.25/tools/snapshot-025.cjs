'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),previous='D:/TikMnG-Release-7.0.0-source/maintenance/yaratik-arena-0.1.24';
const destination='D:/TikMnG-Release-7.0.0-source/maintenance/yaratik-arena-0.1.25';
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
for(const file of ['combat025-native-tests.cjs','migration025-native-tests.cjs','run-combat025.cjs','balance-native-tests.cjs','ammo-native-tests.cjs','pursuit-tests.cjs','final-event-tests.cjs','death-reset-hotfix-tests.cjs','startup-exit-native-tests.cjs','connection-menu-hotfix-tests.cjs','commands.cjs','install-hotfix.cjs'])copy('qa/'+file);
for(const file of ['prepare-launcher-package.cjs','snapshot-025.cjs','record-025-verification.cjs'])copy('tools/'+file);
copy('README.md');
fs.copyFileSync('D:/TikMnG-Yaratik-Arena-0.1.25-release/package-descriptor.json',path.join(destination,'package-descriptor.json'));
console.log(destination);
