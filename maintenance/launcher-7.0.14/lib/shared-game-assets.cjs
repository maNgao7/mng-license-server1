'use strict';
const fs=require('node:fs');
const path=require('node:path');
const { assertSafePath } = require('./download.cjs');

function validCatalog(catalog) {
    return Array.isArray(catalog) && catalog.length > 0 &&
        catalog.every(gift => gift && typeof gift.id === 'string' && /^[1-9][0-9]*$/.test(gift.id) &&
            Number.isSafeInteger(Number(gift.id)) && gift.file === gift.id + '.png' &&
            typeof gift.name === 'string' && gift.name.trim().length > 0 &&
            Number.isSafeInteger(gift.coins) && gift.coins >= 0) &&
        new Set(catalog.map(gift => gift.id)).size === catalog.length;
}

async function authoritativeAssetFiles(bundledAssets) {
    const files = new Set();
    try {
        const catalog = JSON.parse((await fs.promises.readFile(path.join(bundledAssets, 'katalog_tam.json'), 'utf8')).replace(/^\uFEFF/, ''));
        if (!validCatalog(catalog)) return files;
        files.add('katalog_tam.json');
        for (const gift of catalog) files.add(gift.file);
        try {
            const presentation=JSON.parse(await fs.promises.readFile(path.join(bundledAssets,'visual-groups.json'),'utf8'));
            const validGroups=Array.isArray(presentation.groups)&&presentation.groups.every(group=>group&&typeof group.id==='string'&&Array.isArray(group.ids)&&group.ids.length&&group.ids.includes(group.id)&&group.ids.every(id=>typeof id==='string'));
            const ids=validGroups?presentation.groups.flatMap(group=>group.ids):[];
            const expected=new Set(catalog.map(gift=>gift.id));
            if(presentation.schemaVersion===1&&ids.length===expected.size&&new Set(ids).size===ids.length&&ids.every(id=>expected.has(id)))files.add('visual-groups.json');
        } catch(error) { if(error.code&&error.code!=='ENOENT')throw error; }
        try {
            const library = JSON.parse((await fs.promises.readFile(path.join(bundledAssets, '_kutuphane.json'), 'utf8')).replace(/^\uFEFF/, ''));
            const byId = new Map(catalog.map(gift => [gift.id, gift]));
            if (validCatalog(library) && library.length === catalog.length && library.every(gift => {
                const row = byId.get(gift.id);
                return row && row.file === gift.file && row.coins === gift.coins && row.name === gift.name;
            })) files.add('_kutuphane.json');
        } catch (error) { if (error.code && error.code !== 'ENOENT') throw error; }
    } catch (error) { if (error.code && error.code !== 'ENOENT') throw error; }
    return files;
}

async function prepareSharedGameAssets({gameDirectory,libraryRoot,bundledAssets}) {
    const root=path.resolve(libraryRoot),game=path.resolve(gameDirectory);
    const relative=path.relative(root,game);
    if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))return;
    const target=path.join(path.dirname(game),'tiktok-vs','public','assets','gift-images');
    assertSafePath(target);
    await fs.promises.mkdir(target,{recursive:true});
    const authoritativeFiles = await authoritativeAssetFiles(bundledAssets);
    // Old standalone games resolve gifts relative to their sibling VS assets.
    // Copy only public artwork, never another game's code or user settings.
    // readdir/readFile work for ASAR sources; native recursive cp/opendir do not.
    for(const entry of await fs.promises.readdir(bundledAssets,{withFileTypes:true})){
        if(!entry.isFile())continue;
        if (!authoritativeFiles.has(entry.name) && !/\.(png|webp|jpe?g|gif)$/i.test(entry.name)) continue;
        const destination=path.join(target,entry.name);
        if (authoritativeFiles.has(entry.name)) {
            assertSafePath(destination);
            const data = await fs.promises.readFile(path.join(bundledAssets, entry.name));
            let existing;
            try { existing = await fs.promises.readFile(destination); } catch(error) { if(error.code !== 'ENOENT')throw error; }
            if (!existing?.equals(data)) await fs.promises.writeFile(destination, data);
            continue;
        }
        if(fs.existsSync(destination))continue;
        assertSafePath(destination);
        try{await fs.promises.writeFile(destination,await fs.promises.readFile(path.join(bundledAssets,entry.name)),{flag:'wx'});}
        catch(error){if(error.code!=='EEXIST')throw error;}
    }
    const fallback=path.join(path.dirname(target),'gift-catalog','balon-hediyesi.png');
    assertSafePath(fallback);
    if(!fs.existsSync(fallback)){
        await fs.promises.mkdir(path.dirname(fallback),{recursive:true});
        try { await fs.promises.writeFile(fallback,await fs.promises.readFile(path.join(bundledAssets,'5655.png')),{flag:'wx'}); }
        catch(error) { if(error.code !== 'EEXIST')throw error; }
    }
}
module.exports={prepareSharedGameAssets};
