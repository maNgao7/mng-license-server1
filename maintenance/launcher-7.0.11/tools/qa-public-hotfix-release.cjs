'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const yaml=require('js-yaml');
const {readRelease}=require('../lib/update-release.cjs');
const {downloadFile}=require('../lib/download.cjs');
const directory='D:/TikMnG-Hotfix-7.0.5-final/public-launcher-qa';
(async()=>{
    fs.mkdirSync(directory,{recursive:true});
    const release=await readRelease();
    assert.equal(release.version,'7.0.5');
    assert.equal(release.sha256,'216b94f94da8903b3e65413318e0767af39719fffc4ac4027f03ef79dc6125fa');
    assert.equal(release.bytes,245163489);
    const feedResponse=await fetch(release.url.replace(release.name,'latest.yml'),{signal:AbortSignal.timeout(30000)});
    assert.equal(feedResponse.status,200);
    const feed=yaml.load(await feedResponse.text());
    assert.equal(feed.version,release.version);assert.equal(feed.path,release.name);
    assert.equal(feed.files[0].url,release.name);assert.equal(feed.files[0].size,release.bytes);
    let lastProgress=-1;
    const file=path.join(directory,release.name);
    const downloaded=await downloadFile(release.url,file,{sha256:release.sha256,bytes:release.bytes,onProgress:progress=>{
        const step=Math.floor(progress.percent/25);
        if(step>lastProgress){lastProgress=step;console.log(`Installer download: ${step*25}%`);}
    }});
    const hash=crypto.createHash('sha512');
    for await(const chunk of fs.createReadStream(file))hash.update(chunk);
    assert.equal(hash.digest('base64'),feed.sha512);
    const report={passed:true,version:release.version,publicDownload:true,sha256Verified:true,feedSha512Verified:true,bytes:downloaded.bytes,file};
    fs.writeFileSync(path.join(directory,'report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
