const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),destination='D:/TikMnG-Release-7.0.0-source/maintenance/orbit-7.0.3';
const files=['server.js','package.json','public/index.html','public/style.css','public/app.js','public/collision.js','public/panel-visibility.js','public/panel-visibility.css','public/icons/panels-top-left.svg','public/icons/lucide-LICENSE.txt','collision.test.js','orbit-round.integration.cjs','qa/panel-visibility.integration.cjs','qa/panel-visibility-design.md','qa/package-7.0.3.cjs','qa/package-install-7.0.3.cjs','qa/prepare-panel-icon.cjs','qa/snapshot-7.0.3.cjs'];
for(const relative of files){const target=path.join(destination,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,relative),target);}
for(const file of ['package-descriptor.json','INSTALL-VERIFICATION.json'])fs.copyFileSync('D:/TikMnG-Orbit-7.0.3-release/'+file,path.join(destination,file));
const result=JSON.parse(fs.readFileSync(path.join(root,'qa/panel-visibility-result.json')));
if(!result.passed)throw new Error('Panel checks did not pass');
fs.writeFileSync(path.join(destination,'qa/panel-visibility-result.json'),JSON.stringify(result,null,2));
console.log(destination);
