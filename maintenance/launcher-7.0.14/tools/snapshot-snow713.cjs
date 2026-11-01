'use strict';
const fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'../../snow-war-update-713'),destination='D:/TikMnG-Release-7.0.0-source/maintenance/snow-war-7.0.6';
for(const name of ['build.gradle','settings.gradle','gradle.properties','gradlew','gradlew.bat','gradle','src']){
    const from=path.join(source,'mod',name);if(fs.existsSync(from))fs.cpSync(from,path.join(destination,'mod',name),{recursive:true});
}
fs.cpSync(path.join(source,'live-bridge'),path.join(destination,'live-bridge'),{recursive:true,filter(file){
    return !file.split(path.sep).some(part=>['node_modules','.git','logs','cache'].includes(part))&&!/\.(?:log|env)$/.test(file);
}});
console.log(JSON.stringify({source:destination,compiledGameExcluded:true}));
