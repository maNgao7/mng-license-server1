'use strict';
const fs=require('node:fs');
const path=require('node:path');

async function prepareSharedGameAssets({gameDirectory,libraryRoot,bundledAssets}) {
    const root=path.resolve(libraryRoot),game=path.resolve(gameDirectory);
    const relative=path.relative(root,game);
    if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))return;
    const target=path.join(path.dirname(game),'tiktok-vs','public','assets','gift-images');
    let cursor=root;
    for(const part of path.relative(root,target).split(path.sep)){
        cursor=path.join(cursor,part);
        try{if(fs.lstatSync(cursor).isSymbolicLink())throw new Error('Paylaşılan görsel klasöründe bağlantı kullanılamaz.');}
        catch(error){if(error.code!=='ENOENT')throw error;}
    }
    await fs.promises.mkdir(target,{recursive:true});
    // Old standalone games resolve gifts relative to their sibling VS assets.
    // Copy only public artwork, never another game's code or user settings.
    // readdir/readFile work for ASAR sources; native recursive cp/opendir do not.
    for(const entry of await fs.promises.readdir(bundledAssets,{withFileTypes:true})){
        if(!entry.isFile())continue;
        const destination=path.join(target,entry.name);
        if(fs.existsSync(destination))continue;
        try{await fs.promises.writeFile(destination,await fs.promises.readFile(path.join(bundledAssets,entry.name)),{flag:'wx'});}
        catch(error){if(error.code!=='EEXIST')throw error;}
    }
    const fallback=path.join(path.dirname(target),'gift-catalog','balon-hediyesi.png');
    if(!fs.existsSync(fallback)){
        await fs.promises.mkdir(path.dirname(fallback),{recursive:true});
        await fs.promises.writeFile(fallback,await fs.promises.readFile(path.join(bundledAssets,'5655.png')),{flag:'wx'});
    }
}
module.exports={prepareSharedGameAssets};
