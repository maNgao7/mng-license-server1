const fs=require('node:fs'),path=require('node:path');
const repo='D:/TikMnG-Release-7.0.0-source';
for(const [name,version,files,folders] of [
    ['frog-river','7.0.5',['server.js','live-events.js','launcher-widget-links.cjs','package.json','package-lock.json'],['public','test']],
    ['caaahr-voice','0.6.12',['server.mjs','package.json','package-lock.json'],['plugin','lib','test','public']]
]){
    const source=path.resolve(__dirname,'../../apps',name),target=path.join(repo,'maintenance',name+'-'+version);
    const copy=file=>{const relative=path.relative(source,file).split(path.sep).join('/');const destination=path.join(target,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(file,destination);};
    for(const name of files)copy(path.join(source,name));
    const visit=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){if(['node_modules','deps','build','qa'].includes(entry.name))continue;const file=path.join(directory,entry.name);if(entry.isDirectory())visit(file);else if(/\.(?:js|cjs|mjs|json|css|html|cs|ps1)$/.test(entry.name)&&!/settings|secret|api-key/i.test(entry.name))copy(file);else if(file.endsWith('lib/settings.mjs'))copy(file);}};
    for(const folder of folders)visit(path.join(source,folder));
    // settings.mjs is source code, not the private runtime settings.json.
    if(name==='caaahr-voice')copy(path.join(source,'lib/settings.mjs'));
    console.log(target);
}
