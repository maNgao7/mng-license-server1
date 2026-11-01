'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const sharp=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../renderer/gift-assets'),output='D:/TikMnG-Widget-Preview11-20261026';
const names=['tikmng-champion-100-v1','tikmng-champion-500-v1','tikmng-champion-wings-v1','tikmng-champion-5000-v1','tikmng-champion-10000-v1','tikmng-alert-frame-v1'];
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const visiblePixels=buffer=>{for(let i=0;i<buffer.length;i+=4)if(buffer[i+3]===0)buffer.fill(0,i,i+3);return buffer;};
(async()=>{
    const report=[];
    for(const name of names){
        const source=path.join(root,name+'.png'),target=path.join(root,name+'-runtime.webp');
        await sharp(source).webp({lossless:true,effort:6}).toFile(target);
        const before=await sharp(source).ensureAlpha().raw().toBuffer(),after=await sharp(target).ensureAlpha().raw().toBuffer();
        assert.equal(hash(visiblePixels(before)),hash(visiblePixels(after)),'Runtime asset must preserve every visible pixel and alpha value: '+name);
        report.push({file:path.basename(target),sourceBytes:fs.statSync(source).size,runtimeBytes:fs.statSync(target).size,visiblePixelsAndAlphaIdentical:true});
    }
    fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'asset-optimization.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(error=>{console.error(error);process.exitCode=1;});
