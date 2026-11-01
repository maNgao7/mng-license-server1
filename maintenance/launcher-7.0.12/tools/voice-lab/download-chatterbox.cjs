'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { download, hashFile } = require('../../lib/download.cjs');
const revision = '5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18';
const files = [
    { name: 't3_mtl23ls_v3.safetensors', bytes: 2143989928, sha256: '5abca8321ede76f8e61f1cc0d19aea6c946b28871017ce8726f8a69203f05953' },
    { name: 's3gen.pt', bytes: 1057165844, sha256: '9b9ff07e60b20c136e2b1b3d7563a24604e8d2c4c267888d1ee929dd0151d2a3' },
    { name: 've.pt', bytes: 5698626, sha256: '4b16d836bc598509860f6fa068165a8bb5e9ac84f05582dfcf278a5a372879f1' },
    { name: 'conds.pt', bytes: 107374, sha256: '6552d70568833628ba019c6b03459e77fe71ca197d5c560cef9411bee9d87f4e' },
    { name: 'Cangjie5_TC.json', bytes: 1920163, blobId: 'd77891f84ca1db0d6f7058a4ee081d4bb0bfe88e' },
    { name: 'grapheme_mtl_merged_expanded_v1.json', bytes: 69989, blobId: 'd27fb3f2fd38ca39b7bbfbf83a13b3c617e551df' }
];
async function main() {
    const root = path.resolve(process.argv[2] || 'D:/TikMnG-Ses-Laboratuvari/model-v3');
    fs.mkdirSync(root, { recursive: true });
    const controller = new AbortController();process.once('SIGINT', () => controller.abort());
    let last = 0;
    for (const file of files) {
        const destination = path.join(root, file.name);
        const valid = fs.existsSync(destination) && fs.statSync(destination).size === file.bytes && (!file.sha256 || await hashFile(destination) === file.sha256);
        if (!valid) await download(`https://huggingface.co/ResembleAI/chatterbox/resolve/${revision}/${file.name}`, destination, {
            bytes: file.bytes, sha256: file.sha256, signal: controller.signal,
            onProgress: progress => { if (Date.now() - last > 10000) { console.log(file.name + ': ' + (progress.percent || 0) + '%');last = Date.now(); } }
        });
        if (file.blobId) {
            const data = fs.readFileSync(destination);
            const blob = crypto.createHash('sha1').update(Buffer.from(`blob ${data.length}\0`)).update(data).digest('hex');
            if (blob !== file.blobId) throw Error('Model tokenizer verification failed');
        }
        file.sha256 = await hashFile(destination);console.log(file.name + ': verified');
    }
    fs.writeFileSync(path.join(root, 'tikmng-model-manifest.json'), JSON.stringify({ repo: 'ResembleAI/chatterbox', revision, files }, null, 2));
}
main().catch(error => { console.error(error.message);process.exitCode = 1; });
