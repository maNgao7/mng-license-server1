'use strict';
const REPO='https://github.com/maNgao7/mng-license-server1';
const API='https://api.github.com/repos/maNgao7/mng-license-server1/releases/latest';
function newer(a,b){
    const parse=value=>/^(\d+)\.(\d+)\.(\d+)$/.test(value)?value.split('.').map(Number):null;
    const left=parse(a),right=parse(b);if(!left||!right)return false;
    for(let i=0;i<3;i++)if(left[i]!==right[i])return left[i]>right[i];
    return false;
}
function releaseInfo(release){
    const version=String(release?.tag_name||'').replace(/^v/,'');
    if(!/^\d+\.\d+\.\d+$/.test(version)||release.draft||release.prerelease)throw Error('Stable release metadata required.');
    const name=`TikMnG-Setup-${version}.exe`;
    const asset=release.assets?.find(asset=>asset.name===name);
    const url=`${REPO}/releases/download/v${version}/${name}`;
    if(!asset||asset.browser_download_url!==url||!Number.isSafeInteger(asset.size)||asset.size<1)throw Error('Official installer is missing.');
    const digest=/^sha256:([a-f0-9]{64})$/.exec(asset.digest||'');
    return {version,url,name,bytes:asset.size,sha256:digest?.[1]||null,
        notes:String(release.body||'').replace(/<[^>]*>/g,'').slice(0,2000)};
}
async function readRelease(){
    const response=await fetch(API,{headers:{Accept:'application/vnd.github+json','User-Agent':'TikMnG-Updater'},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('Official release metadata unavailable.');
    const body=await response.text();if(body.length>2*1024*1024)throw Error('Release metadata too large.');
    return releaseInfo(JSON.parse(body));
}
module.exports={newer,releaseInfo,readRelease};
