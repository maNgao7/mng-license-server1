'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const catalog=require('../renderer/speech-previews.js');
function createSpeechPreviewResources({root=path.join(__dirname,'../renderer/assets/voice-previews')}={}){
    function get(uri){
        const file=catalog.files[uri];
        if(!Object.hasOwn(catalog.files,uri)||!file)throw Object.assign(new Error('Ses ön izlemesi bulunamadı.'),{code:'PREVIEW_UNAVAILABLE'});
        const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
        const item=manifest.voices?.find(voice=>voice.voiceURI===uri&&voice.file===file);
        if(!item||manifest.text!==catalog.text||!Number.isSafeInteger(item.bytes)||item.bytes<44||item.bytes>2000000)throw new Error('Ses ön izlemesi doğrulanamadı.');
        const data=fs.readFileSync(path.join(root,file));
        if(data.length!==item.bytes||data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WAVE'||crypto.createHash('sha256').update(data).digest('hex')!==item.sha256)throw new Error('Ses ön izlemesi doğrulanamadı.');
        const name=String(item.name||'TikMnG').replace(/[<>:"/\\|?*\x00-\x1f]/g,'').slice(0,60)||'TikMnG';
        return{data,filename:name+' - Tik MNG.wav'};
    }
    return{get};
}
module.exports={createSpeechPreviewResources};
