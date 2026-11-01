'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const esbuild=require('esbuild');
const root=path.resolve(__dirname,'..');
const concepts=path.resolve(root,'../widget-preview-7.0.14');
const destination=path.join(root,'renderer/widgets/royal-assets');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
function ffmpeg(args){
    const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error',...args],{maxBuffer:40*1024*1024});
    if(result.status!==0)throw new Error(result.stderr.toString()||'ffmpeg failed');
    return result.stdout;
}
const manifest={frames:{},textures:{}};
let total=0;
for(const [group,key,file] of [
    ['frames','gold','altin-hazine-v2.png'],['frames','crystal','kristal-yorunge.png'],['frames','ember','alev-muhru.png'],
    ['textures','coin','gold-coin.png'],['textures','flame','flame-plume-v2.png']
]){
    const source=path.join(concepts,'assets',file),temporary=path.join(destination,'viral-'+key+'-build.webp');
    // Tiny 3D ornaments never occupy the full frame; keep portrait/frame art untouched.
    const filter=group==='textures'?['-vf','scale=512:512:flags=lanczos']:[];
    ffmpeg(['-y','-i',source,...filter,'-c:v','libwebp','-lossless','1','-compression_level','6',temporary]);
    const original=ffmpeg(['-i',source,...filter,'-f','rawvideo','-pix_fmt','rgba','-']);
    const decoded=ffmpeg(['-i',temporary,'-f','rawvideo','-pix_fmt','rgba','-']);
    if(original.length!==decoded.length)throw new Error(key+': dimensions changed');
    for(let i=0;i<original.length;i+=4){
        if(original[i+3]!==decoded[i+3]||original[i+3]&&(original[i]!==decoded[i]||original[i+1]!==decoded[i+1]||original[i+2]!==decoded[i+2]))throw new Error(key+': visible pixels changed');
    }
    const bytes=fs.readFileSync(temporary),name='viral-'+key+'-'+sha(bytes)+'.webp';
    fs.renameSync(temporary,path.join(destination,name));manifest[group][key]=name;total+=bytes.length;
    console.log(key,bytes.length,'bytes, visible RGBA verified lossless');
}
const output=path.join(root,'renderer/widgets/champion-motion.js');
esbuild.buildSync({entryPoints:[path.join(__dirname,'champion-motion-source.mjs')],outfile:output,bundle:true,minify:true,format:'iife',globalName:'TikMnGChampionMotion',target:'chrome100',legalComments:'eof',nodePaths:[path.join(concepts,'node_modules')]});
const moduleBytes=fs.readFileSync(output);manifest.moduleHash=sha(moduleBytes);total+=moduleBytes.length;
fs.copyFileSync(path.join(concepts,'node_modules/three/LICENSE'),path.join(root,'renderer/widgets/champion-motion.LICENSE.txt'));
fs.writeFileSync(path.join(root,'lib/champion-art.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Module',moduleBytes.length,'bytes; total',total,'bytes; module hash',manifest.moduleHash);
