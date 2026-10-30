'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const gh=args=>JSON.parse(execFileSync('gh',args,{encoding:'utf8',maxBuffer:16*1024*1024}));
async function main(){
    const repo='maNgao7/mng-license-server1',releases=gh(['api',`repos/${repo}/releases?per_page=100`]);
    const release=releases.find(r=>r.tag_name==='media-7.0.0');assert.ok(release&&!release.draft);
    const assets=gh(['api',`repos/${repo}/releases/${release.id}/assets?per_page=100`,'--paginate','--slurp']).flat();
    const byName=new Map(assets.map(a=>[a.name,a])),media=require('../lib/catalog-defaults.json').media;
    for(const item of media){const asset=byName.get(decodeURIComponent(new URL(item.url).pathname.split('/').pop()));assert.ok(asset,item.id);assert.equal(asset.size,item.bytes,item.id);assert.equal(asset.digest,'sha256:'+item.sha256,item.id);}
    const audio=media.filter(m=>/\.(?:mp3|wav|ogg)$/i.test(new URL(m.url).pathname)),video=media.filter(m=>/\.(?:mp4|webm)$/i.test(new URL(m.url).pathname));
    const probes=[audio[0],audio.at(-1),video[0],video.at(-1)];
    for(const item of probes){const response=await fetch(item.url,{signal:AbortSignal.timeout(60000)});assert.equal(response.status,200);const b=Buffer.from(await response.arrayBuffer());assert.equal(b.length,item.bytes);assert.equal(sha(b),item.sha256);}
    const gifts=require('../renderer/gift-assets/katalog_tam.json');assert.equal(new Set(gifts.map(g=>g.id)).size,gifts.length);
    const grouped=require('../renderer/gift-catalog-view.js').group(gifts.map(g=>({...g,visualGroup:require('../renderer/gift-assets/visual-groups.json').groups.find(group=>group.ids.includes(g.id))?.id})));
    const result={passed:true,media:media.length,audio:audio.length,video:video.length,githubStoredDigestsVerified:media.length,fullPublicDownloads:probes.length,giftIds:gifts.length,visualCards:grouped.length,uniqueIds:true};
    fs.writeFileSync('D:/TikMnG-QA-Delivery/7.0.2/media-and-gifts.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
