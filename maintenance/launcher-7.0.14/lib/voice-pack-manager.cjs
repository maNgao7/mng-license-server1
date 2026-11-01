'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { download, assertSafePath, hashFile, throwIfAborted } = require('./download.cjs');

const CATALOG = Object.freeze([{
    id: 'okur-tr-v1', version: '1.0.0', name: 'Okur', language: 'tr-TR', gender: 'neutral',
    description: 'Hızlı, cihaz içinde çalışan Türkçe yapay ses', size: 23205524,
    license: 'CC BY 4.0', attribution: 'Okur v1.0 - Ahmet Hakan Beşel ve belirtilen eğitim veri kümeleri',
    voiceURI: 'offline:okur-tr-v1:default',
    files: [
        { name: 'config.json', bytes: 742, sha256: '7b62f4383f4d0ed0fd5f0087bdb078e9cfb9516e36a4e3e61530bf037b663860', url: 'https://huggingface.co/ahakan/okur-tts/resolve/main/onnx/config.json' },
        { name: 'decoder.8f42fa31155e.onnx', bytes: 7102508, sha256: '8f42fa31155e459e62f3cb2830d53c7c014e5c614b583b17440120d7fa7120c4', url: 'https://huggingface.co/ahakan/okur-tts/resolve/main/onnx/decoder.8f42fa31155e.onnx' },
        { name: 'sample.3c2a91ee5faa.onnx', bytes: 10987695, sha256: '3c2a91ee5faa5601ae53193c203fa558a28f7e031b82103af28ee3cf366a6c63', url: 'https://huggingface.co/ahakan/okur-tts/resolve/main/onnx/sample.3c2a91ee5faa.onnx' },
        { name: 'text.6a21984ac693.onnx', bytes: 5114579, sha256: '6a21984ac693d07ec0096fcfbc0bffebe23255891523090eaf24f232782a94c2', url: 'https://huggingface.co/ahakan/okur-tts/resolve/main/onnx/text.6a21984ac693.onnx' }
    ]
}, {
    id: 'ema-tr-v1', version: '1.0.1', name: 'EMA', language: 'tr-TR', gender: 'neutral',
    description: 'Akıcı Türkçe anlatım · Çevrimdışı yapay ses', size: 36171095,
    license: 'Apache 2.0', attribution: 'EMA Lightning - Canberk Aslan; ONNX dönüşümü: ozcancelik; normalizer-tr: Erdem Tuna',
    voiceURI: 'offline:ema-tr-v1:default',
    files: [
        { name: 'meta.json', bytes: 357, sha256: '76627201405723633f5319a208ed7dea63c42acbf3ca997671bccdca9d9186b2' },
        { name: 'text.onnx', bytes: 4806400, sha256: 'ad5d4885b5d218f63d976a6e562334ea0194aec54847a6c6482d328e784089f0' },
        { name: 'sound.onnx', bytes: 18120655, sha256: '958364217360cecaa92dc5ff2170d19f3c9f6995fd5e61241ea4068971a46a59' },
        { name: 'decoder.onnx', bytes: 12031945, sha256: '396c06a8e5711fd40bfd2c3f4f33851feb2ad07a86485833844e0ae8ff637b17' },
        { name: 'normalizer.wasm', bytes: 1211738, sha256: '2614bcf15b4546249d49474c029420a4a611daf9e9a0c596cc852bd16cdecc89' }
    ].map(file => ({ ...file, url: 'https://huggingface.co/ozcancelik/ema-lightning-onnx/resolve/13c431db0356b2f7fafb1247cd823ec0d777c820/' + file.name }))
}].map(pack => ({ ...pack, files: pack.files.map(file => ({ ...file, url: file.url.replace('/ahakan/okur-tts/resolve/main/', '/ahakan/okur-tts/resolve/0c1ae1a9c5e7bcaa46bdff732bc7182c9ae7bd70/') })) })));

function createVoicePackManager({ root, bundledFrontend, onProgress = () => {}, catalog = CATALOG, downloadFile = download }) {
    root = assertSafePath(path.resolve(root));
    const controllers = new Map();
    fs.mkdirSync(root, { recursive: true });
    const pack = id => catalog.find(item => item.id === id);
    const directory = id => assertSafePath(path.join(root, id));
    const manifestFile = id => path.join(directory(id), 'manifest.json');
    function installed(item) {
        try {
            const manifest = JSON.parse(fs.readFileSync(manifestFile(item.id), 'utf8'));
            return manifest.id === item.id && manifest.version === item.version && item.files.every(file => fs.statSync(assertSafePath(path.join(directory(item.id), file.name))).size === file.bytes)
                && (item.id !== 'okur-tr-v1' || fs.statSync(assertSafePath(path.join(directory(item.id), 'frontend.wasm'))).size === 1284999);
        } catch { return false; }
    }
    function list() { return catalog.map(item => ({ ...item, files: undefined, installed: installed(item), installing: controllers.has(item.id) })); }
    async function verify(id, signal) {
        const item = pack(id);
        if (!item || !installed(item)) return null;
        for (const file of item.files) {
            if (await hashFile(assertSafePath(path.join(directory(id), file.name)), signal) !== file.sha256) throw new Error('Ses paketi bozuk. Onar düğmesini kullanın.');
        }
        if (item.id === 'okur-tr-v1' && await hashFile(path.join(directory(id), 'frontend.wasm'), signal) !== '01fbef3518abe592658fe694e65bf76eedda8f4f1a5f5072f4e16b261f75f88e') throw new Error('Ses ön işlemcisi bozuk. Paketi onarın.');
        return directory(id);
    }
    async function install(id) {
        const item = pack(id);
        if (!item) throw Object.assign(new Error('Ses paketi bulunamadı.'), { code: 'VOICE_PACK_UNKNOWN' });
        if (controllers.has(id)) throw Object.assign(new Error('Ses paketi zaten indiriliyor.'), { code: 'VOICE_PACK_BUSY' });
        const controller = new AbortController(); controllers.set(id, controller);
        const staging = assertSafePath(path.join(root, `.${id}-${crypto.randomUUID()}`));
        const cache = assertSafePath(path.join(root, '.downloads', id));
        try {
            await fs.promises.mkdir(staging, { recursive: true });
            await fs.promises.mkdir(cache, { recursive: true });
            let completed = 0;
            for (const file of item.files) {
                const cached = assertSafePath(path.join(cache, file.name));
                const valid = fs.existsSync(cached) && fs.statSync(cached).size === file.bytes && await hashFile(cached, controller.signal) === file.sha256;
                if (!valid) await downloadFile(file.url, cached, { ...file, signal: controller.signal, oyun: `voice:${id}`, onProgress: progress => onProgress({ ...progress, id, completedBytes: completed + (progress.transferredBytes || 0), totalBytes: item.size }) });
                if (fs.statSync(cached).size !== file.bytes || await hashFile(cached, controller.signal) !== file.sha256) throw new Error('Ses dosyası doğrulanamadı.');
                await fs.promises.copyFile(cached, path.join(staging, file.name));
                completed += file.bytes;
            }
            throwIfAborted(controller.signal);
            if (item.id === 'okur-tr-v1') await fs.promises.copyFile(bundledFrontend, path.join(staging, 'frontend.wasm'));
            await fs.promises.writeFile(path.join(staging, 'manifest.json'), JSON.stringify({ id, version: item.version, attribution: item.attribution }, null, 2), 'utf8');
            const target = directory(id); const backup = assertSafePath(`${target}.${crypto.randomUUID()}.old`);
            if (fs.existsSync(target)) await fs.promises.rename(target, backup);
            try { await fs.promises.rename(staging, target); }
            catch (error) { if (fs.existsSync(backup)) await fs.promises.rename(backup, target); throw error; }
            await fs.promises.rm(backup, { recursive: true, force: true });
            onProgress({ id, phase: 'complete', percent: 100, message: `${item.name} kullanıma hazır.` });
            return list();
        } finally {
            controllers.delete(id);
            assertSafePath(staging);
            await fs.promises.rm(staging, { recursive: true, force: true }).catch(() => {});
        }
    }
    async function remove(id) {
        const item = pack(id); if (!item) throw new Error('Ses paketi bulunamadı.');
        if (controllers.has(id)) throw new Error('Önce ses indirmesini durdurun.');
        await fs.promises.rm(directory(id), { recursive: true, force: true });
        return list();
    }
    function cancel(id) { controllers.get(id)?.abort(); return { ok: true }; }
    function resolve(id) { const item = pack(id); return item && installed(item) ? directory(id) : null; }
    function close() { for (const controller of controllers.values()) controller.abort(); }
    return { list, install, remove, cancel, resolve, verify, close };
}

module.exports = { createVoicePackManager, CATALOG };
