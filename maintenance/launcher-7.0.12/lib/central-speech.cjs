'use strict';
function fault(code) {
    const messages = { CENTRAL_NOT_CONFIGURED: 'TikMnG merkezi ses hizmeti henüz etkinleştirilmedi.', CENTRAL_LICENSE: 'Ses hizmeti için aktif TikMnG lisansı gerekli.',
        CENTRAL_QUOTA: 'TikMnG ses kullanım sınırına ulaşıldı. Biraz sonra yeniden deneyin.', CENTRAL_BUSY: 'Ses hizmeti meşgul. Biraz sonra yeniden deneyin.',
        CENTRAL_UNAVAILABLE: 'TikMnG ses hizmetine ulaşılamadı.', VOICE_UNAVAILABLE: 'Seçilen konuşmacı artık kullanılamıyor.', SPEECH_CANCELLED: 'Ses durduruldu.' };
    return Object.assign(new Error(messages[code] || messages.CENTRAL_UNAVAILABLE), { code });
}
function createCentralSpeech({ serverURL, getCredentials, fetchImpl = globalThis.fetch, cacheMs = 30000 }) {
    let cache = null, expires = 0, owner = '';
    async function request(route, data, signal) {
        const credentials = getCredentials?.();
        if (!credentials?.licenseCode || !credentials?.deviceId) throw fault('CENTRAL_LICENSE');
        const base = new URL(serverURL());
        if (base.protocol !== 'https:' || base.username || base.password) throw fault('CENTRAL_UNAVAILABLE');
        try {
            const response = await fetchImpl(new URL('/api/speech/' + route, base.origin), { method: 'POST', redirect: 'error',
                headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, licenseCode: credentials.licenseCode, deviceId: credentials.deviceId }),
                signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) });
            let bytes = 0;const chunks = [];
            for await (const chunk of response.body) { bytes += chunk.length;if (bytes > 16 * 1024 * 1024) throw fault('CENTRAL_UNAVAILABLE');chunks.push(Buffer.from(chunk)); }
            let result;try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fault('CENTRAL_UNAVAILABLE'); }
            if (!response.ok) {
                const code = [401, 403].includes(response.status) ? 'CENTRAL_LICENSE' : response.status === 429 ? 'CENTRAL_QUOTA' :
                    ['CENTRAL_NOT_CONFIGURED', 'CENTRAL_BUSY', 'VOICE_UNAVAILABLE'].includes(result.code) ? result.code : 'CENTRAL_UNAVAILABLE';
                throw fault(code);
            }
            return result;
        } catch (error) { if (signal?.aborted) throw fault('SPEECH_CANCELLED');throw fault(['CENTRAL_LICENSE', 'CENTRAL_QUOTA', 'CENTRAL_NOT_CONFIGURED', 'CENTRAL_BUSY', 'VOICE_UNAVAILABLE'].includes(error.code) ? error.code : 'CENTRAL_UNAVAILABLE'); }
    }
    async function listVoices({ refresh = false } = {}) {
        const credentials = getCredentials?.();
        const identity = JSON.stringify([credentials?.licenseCode, credentials?.deviceId]);
        if (!refresh && cache && identity === owner && Date.now() < expires) return structuredClone(cache);
        try {
            const result = await request('voices', {});
            if (!Array.isArray(result.voices) || result.voices.length > 1000) throw fault('CENTRAL_UNAVAILABLE');
            const voices = result.voices.filter(v => typeof v.id === 'string' && v.id.length < 200 && typeof v.name === 'string' && v.name.length < 200)
                .map(v => ({ id: v.id, voiceURI: 'tikmng:' + v.id, name: v.name, lang: 'tr-TR', gender: ['male', 'female'].includes(String(v.gender).toLowerCase()) ? String(v.gender).toLowerCase() : 'unknown',
                    provider: 'tikmng', neural: true, localService: false }));
            const status = { voices, available: voices.length > 0, reason: voices.length ? null : 'CENTRAL_NOT_CONFIGURED' };
            owner = identity;cache = status;expires = Date.now() + cacheMs;return structuredClone(status);
        } catch (error) { cache = null;return { voices: [], available: false, reason: error.code || 'CENTRAL_UNAVAILABLE' }; }
    }
    async function synthesize(settings, signal) {
        const voiceId = String(settings.voiceURI || '').replace(/^tikmng:/, '');
        const result = await request('synthesize', { text: settings.text, voiceId, rate: settings.rate }, signal);
        const audio = Buffer.from(String(result.audioBase64 || ''), 'base64');
        if (audio.length < 44 || audio.length > 8 * 1024 * 1024 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE' || result.voice?.id !== voiceId) throw fault('CENTRAL_UNAVAILABLE');
        return audio;
    }
    return { listVoices, synthesize };
}
module.exports = { createCentralSpeech };
