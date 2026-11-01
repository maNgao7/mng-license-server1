'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {manifestFiles}=require('../lib/game-content.cjs');
const {assertSafePath}=require('../lib/download.cjs');
async function buildPreviewContent(root,id,version){
    root=assertSafePath(path.resolve(root));
    const files=[];
    async function walk(directory){
        for(const entry of await fs.promises.readdir(directory,{withFileTypes:true})){
            const file=assertSafePath(path.join(directory,entry.name));
            if(entry.isSymbolicLink())throw new Error('Linked package file: '+file);
            if(entry.isDirectory())await walk(file);
            else if(entry.isFile()){
                const relative=path.relative(root,file).split(path.sep).join('/');
                if(relative==='.tikmng-package.json')continue;
                const hash=crypto.createHash('sha256');for await(const bytes of fs.createReadStream(file))hash.update(bytes);
                files.push({path:relative,bytes:(await fs.promises.stat(file)).size,sha256:hash.digest('hex')});
            }else throw new Error('Special package file: '+file);
        }
    }
    await walk(root);files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
    manifestFiles(files);
    const data=Buffer.from(JSON.stringify({schemaVersion:1,type:'tikmng-game-content',package:id,version,files}));
    const file=root+'.content.json';await fs.promises.writeFile(file,data);
    return {localRoot:root,localContentManifest:file,contentSha256:crypto.createHash('sha256').update(data).digest('hex')};
}
module.exports={buildPreviewContent};
