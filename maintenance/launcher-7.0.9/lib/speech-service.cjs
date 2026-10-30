'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const SPEECH_STYLES = Object.freeze({
    natural: { label: 'Doğal', pitch: 0, rate: 1 },
    deep: { label: 'Kalın', pitch: -24, rate: 0.9, gender: 'male' },
    male: { label: 'Erkek', pitch: -10, rate: 1, gender: 'male' },
    female: { label: 'Kadın tarzı', pitch: 18, rate: 1.04, gender: 'female' },
    warm: { label: 'Sıcak', pitch: -4, rate: 0.93 },
    energetic: { label: 'Enerjik', pitch: 12, rate: 1.18 },
    girl: { label: 'Kız çocuğu tarzı', pitch: 30, rate: 1.12, gender: 'female' },
    boy: { label: 'Erkek çocuğu tarzı', pitch: 20, rate: 1.08, gender: 'male' },
    tiny: { label: 'Minik çizgi karakter', pitch: 38, rate: 1.22 },
    storybook: { label: 'Masalsı anlatıcı', pitch: 8, rate: 0.84 }
});
const SPEECH_STYLE_IDS = Object.freeze(Object.keys(SPEECH_STYLES));
const LEGACY_STYLES = Object.freeze({ child: 'girl' });

// Main-process only. Never expose configureAzure over a general renderer IPC.
// Bridge contract: listVoices() -> { voices, profiles, providers };
// synthesize({ text, voiceURI?, voicePreset?, provider?, rate? }) -> WAV base64.
// Official API: https://learn.microsoft.com/azure/ai-services/speech-service/rest-text-to-speech
// OneCore: https://learn.microsoft.com/uwp/api/windows.media.speechsynthesis.speechsynthesizer.allvoices
const WINDOWS_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$inputData = [Console]::In.ReadToEnd() | ConvertFrom-Json
$onecore = @()
try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $onecore = @([Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]::AllVoices)
} catch { }
if ($inputData.action -eq 'list' -and @($onecore | Where-Object { $_.Language -like 'tr-*' }).Count -gt 0) {
    $items = @($onecore | ForEach-Object {
        @{ id=$_.Id; name=$_.DisplayName; lang=$_.Language; gender=$_.Gender.ToString(); age='Unknown' }
    })
    ConvertTo-Json -InputObject $items -Compress
    return
}
$modernMatch = @($onecore | Where-Object { $_.Id -ceq $inputData.id })
if ($inputData.action -eq 'synthesize' -and $modernMatch.Count -eq 1) {
    $modern = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
    try {
        $modern.Voice = $modernMatch[0]
        $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
            $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetGenericArguments().Count -eq 1 -and
            $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name.StartsWith('IAsyncOperation')
        } | Select-Object -First 1
        $operation = $modern.SynthesizeSsmlToStreamAsync([string]$inputData.ssml)
        $task = $asTask.MakeGenericMethod([Windows.Media.SpeechSynthesis.SpeechSynthesisStream]).Invoke($null, @($operation))
        $speechStream = $task.GetAwaiter().GetResult()
        try {
            $reader = [IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($speechStream.GetInputStreamAt(0))
            $memory = New-Object IO.MemoryStream
            try { $reader.CopyTo($memory); [Console]::Write([Convert]::ToBase64String($memory.ToArray())) }
            finally { $memory.Dispose(); $reader.Dispose() }
        } finally { $speechStream.Dispose() }
    } finally { $modern.Dispose() }
    return
}
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $voices = @($synth.GetInstalledVoices() | Where-Object { $_.Enabled })
    if ($inputData.action -eq 'list') {
        $items = @($voices | ForEach-Object {
            $info = $_.VoiceInfo
            @{ id=$info.Id; name=$info.Name; lang=$info.Culture.Name;
               gender=$info.Gender.ToString(); age=$info.Age.ToString() }
        })
        ConvertTo-Json -InputObject $items -Compress
    } elseif ($inputData.action -eq 'synthesize') {
        $match = @($voices | Where-Object { $_.VoiceInfo.Id -ceq $inputData.id })
        if ($match.Count -ne 1) { throw 'VOICE_UNAVAILABLE' }
        $synth.SelectVoice($match[0].VoiceInfo.Name)
        if ($synth.Voice.Id -cne $inputData.id) { throw 'VOICE_UNAVAILABLE' }
        $synth.Rate = [int]$inputData.rate
        $stream = New-Object IO.MemoryStream
        try {
            $synth.SetOutputToWaveStream($stream)
            $synth.SpeakSsml([string]$inputData.ssml)
            $synth.SetOutputToNull()
            [Console]::Write([Convert]::ToBase64String($stream.ToArray()))
        } finally { $stream.Dispose() }
    } else { throw 'INVALID_ACTION' }
} finally { $synth.Dispose() }
`;

function failure(code) {
    const messages = {
        VOICE_UNAVAILABLE: 'The selected Turkish voice/profile is unavailable.',
        WINDOWS_UNAVAILABLE: 'Installed Windows speech voices are unavailable.',
        AZURE_NOT_CONFIGURED: 'An Azure Speech account key and region are required.',
        AZURE_CONFIGURATION: 'The Azure Speech configuration is invalid.',
        AZURE_AUTH: 'Azure Speech rejected the account credentials.',
        AZURE_LIMIT: 'Azure Speech quota or request limit reached.',
        AZURE_UNAVAILABLE: 'Azure Speech is unavailable.',
        INVALID_TEXT: 'Speech text must contain 1 to 500 characters.',
        INVALID_AUDIO: 'The speech provider returned invalid audio.',
        SPEECH_CANCELLED: 'Speech cancelled.'
    };
    return Object.assign(new Error(messages[code] || 'Speech failed.'), { code });
}

function runWindows(action, payload = {}, { signal } = {}) {
    if (process.platform !== 'win32') return Promise.reject(failure('WINDOWS_UNAVAILABLE'));
    if (signal?.aborted) return Promise.reject(failure('SPEECH_CANCELLED'));
    return new Promise((resolve, reject) => {
        const exe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
        const child = spawn(exe, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(WINDOWS_SCRIPT, 'utf16le').toString('base64')], {
            windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'], signal
        });
        const chunks = []; let bytes = 0; let settled = false;
        const finish = (error, value) => {
            if (settled) return;
            settled = true; clearTimeout(timer);
            if (error) reject(error); else resolve(value);
        };
        const timer = setTimeout(() => { child.kill(); finish(failure('WINDOWS_UNAVAILABLE')); }, 30000);
        child.on('error', () => finish(failure(signal?.aborted ? 'SPEECH_CANCELLED' : 'WINDOWS_UNAVAILABLE')));
        child.stdin.on('error', () => finish(failure('WINDOWS_UNAVAILABLE')));
        child.stdout.on('data', chunk => {
            bytes += chunk.length;
            if (bytes > 12 * 1024 * 1024) { child.kill(); finish(failure('INVALID_AUDIO')); }
            else chunks.push(chunk);
        });
        child.on('close', code => {
            if (code !== 0) return finish(failure('WINDOWS_UNAVAILABLE'));
            try {
                const output = Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '').trim();
                finish(null, action === 'list' ? JSON.parse(output) : output);
            } catch { finish(failure('WINDOWS_UNAVAILABLE')); }
        });
        // Text and voice IDs travel as JSON data, never as PowerShell source.
        child.stdin.end(JSON.stringify({ ...payload, action }));
    });
}

const turkish = value => /^tr(?:-|$)/i.test(String(value || ''));
const genderOf = value => ['female', 'male'].includes(String(value).toLowerCase()) ? String(value).toLowerCase() : 'unknown';
const xml = value => String(value).replace(/[<>&"']/g, char => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&apos;' })[char]);

function selectVoice(voices, settings = {}) {
    const preset = LEGACY_STYLES[settings.voicePreset] || settings.voicePreset || 'natural';
    const style = SPEECH_STYLES[preset];
    if (!style) throw failure('VOICE_UNAVAILABLE');
    let candidates = voices.filter(voice => !settings.provider || voice.provider === settings.provider);
    if (settings.voiceURI) candidates = candidates.filter(voice => voice.voiceURI === settings.voiceURI);
    if (!settings.voiceURI && style.gender) {
        const matchingGender = candidates.filter(voice => voice.gender === style.gender);
        if (matchingGender.length) candidates = matchingGender;
    }
    const selected = candidates[0];
    if (!selected) throw failure('VOICE_UNAVAILABLE');
    return selected;
}

function profilesFor(voices) {
    return SPEECH_STYLE_IDS.map(id => {
        try { return { id, label: SPEECH_STYLES[id].label, available: true, voiceURI: selectVoice(voices, { voicePreset: id }).voiceURI }; }
        catch { return { id, available: false, voiceURI: null, reason: 'VOICE_UNAVAILABLE' }; }
    });
}

function createSpeechService({ env = process.env, azure, fetchImpl = globalThis.fetch, windowsRunner = runWindows, voicePacks, central, chatterbox, offlineRunner = require('./offline-speech.cjs').runOffline, cacheMs = 30000 } = {}) {
    let credentials = { key: env.MNG_AZURE_SPEECH_KEY || '', region: env.MNG_AZURE_SPEECH_REGION || '' };
    if (azure) credentials = { key: azure.key || '', region: azure.region || '' };
    credentials = { key: String(credentials.key).trim(), region: String(credentials.region).trim().toLowerCase() };
    let cached = null; let expires = 0; let revision = 0;
    const pending = new Set();
    const audioCache = new Map();
    let audioCacheBytes = 0;
    function cancel() { for (const controller of pending) controller.abort();chatterbox?.cancel(); }
    function configureAzure(config = {}) {
        cancel();
        credentials = { key: String(config.key || '').trim(), region: String(config.region || '').trim().toLowerCase() };
        cached = null; expires = 0; revision++;
        return { configured: Boolean(credentials.key && credentials.region) };
    }
    function configuration() {
        if (!credentials.key || !credentials.region) throw failure('AZURE_NOT_CONFIGURED');
        if (!/^[a-z][a-z0-9]{1,40}$/.test(credentials.region) || /[\r\n]/.test(credentials.key)) throw failure('AZURE_CONFIGURATION');
        return { ...credentials };
    }
    async function azureRequest(suffix, body, signal) {
        const config = configuration();
        try {
            const response = await fetchImpl(`https://${config.region}.tts.speech.microsoft.com/cognitiveservices/${suffix}`, {
                method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
                headers: { 'Ocp-Apim-Subscription-Key': config.key, ...(body === undefined ? {} : {
                    'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm', 'User-Agent': 'TikMNG-Speech'
                }) }, ...(body === undefined ? {} : { body })
            });
            if (!response.ok) {
                await response.body?.cancel();
                throw failure([401, 403].includes(response.status) ? 'AZURE_AUTH' : response.status === 429 ? 'AZURE_LIMIT' : 'AZURE_UNAVAILABLE');
            }
            const chunks = []; let size = 0;
            for await (const chunk of response.body) {
                size += chunk.length;
                if (size > 8 * 1024 * 1024) throw failure('AZURE_UNAVAILABLE');
                chunks.push(Buffer.from(chunk));
            }
            return Buffer.concat(chunks);
        } catch (error) {
            if (signal?.aborted) throw failure('SPEECH_CANCELLED');
            // Provider bodies, URLs and transport error messages can contain secrets.
            if (['AZURE_AUTH', 'AZURE_LIMIT'].includes(error.code)) throw failure(error.code);
            throw failure('AZURE_UNAVAILABLE');
        }
    }
    async function listVoices({ refresh = false } = {}) {
        if (!refresh && cached && Date.now() < expires) return structuredClone(cached);
        const currentRevision = revision;
        const voices = []; const providers = {};
        if (central) {
            const status = await central.listVoices({ refresh });
            voices.push(...status.voices);providers.tikmng = { available: status.available, reason: status.reason };
        }
        const packs = voicePacks?.list() || [];
        for (const pack of packs.filter(pack => pack.installed)) {
            voices.push({ voiceURI: pack.voiceURI, id: pack.id, name: pack.name, lang: pack.language,
                gender: pack.gender, age: 'unknown', provider: 'offline', neural: true, localService: true });
        }
        const localAvailable = voices.some(voice => voice.provider === 'offline');
        providers.offline = { available: localAvailable, reason: localAvailable ? null : 'VOICE_PACK_REQUIRED' };
        if (chatterbox) {
            const status = await chatterbox.status();
            const available = status.available === true && Array.isArray(status.voices) && status.voices.length > 0;
            if (available) voices.push(...status.voices);
            providers.chatterbox = { available, engineReady: status.engineReady === true || available, reason: available ? null : status.reason || 'CHATTERBOX_NOT_INSTALLED', speakers: available ? status.voices.length : 0,
                ...(available ? { installBytes: status.installBytes, performance: status.performance } : {}) };
        }
        try {
            const installed = await windowsRunner('list');
            for (const voice of Array.isArray(installed) ? installed : [installed]) {
                if (!voice?.id || !voice.name || !turkish(voice.lang)) continue;
                voices.push({ voiceURI: `windows:${voice.id}`, id: voice.id, name: voice.name, lang: voice.lang,
                    gender: genderOf(voice.gender), age: String(voice.age || 'unknown').toLowerCase(), provider: 'windows', neural: false, localService: true });
            }
            const available = voices.some(voice => voice.provider === 'windows');
            providers.windows = { available, reason: available ? null : 'VOICE_UNAVAILABLE' };
        } catch { providers.windows = { available: false, reason: 'WINDOWS_UNAVAILABLE' }; }
        try {
            configuration();
            const items = JSON.parse((await azureRequest('voices/list')).toString('utf8'));
            if (!Array.isArray(items)) throw failure('AZURE_UNAVAILABLE');
            for (const voice of items) {
                const multilingual = !turkish(voice.Locale) && Array.isArray(voice.SecondaryLocaleList) && voice.SecondaryLocaleList.some(turkish);
                if ((!turkish(voice.Locale) && !multilingual) || !voice.ShortName || voice.VoiceType !== 'Neural') continue;
                voices.push({ voiceURI: `azure:${voice.ShortName}`, id: voice.ShortName, name: voice.LocalName || voice.DisplayName || voice.ShortName,
                    lang: 'tr-TR', nativeLang: voice.Locale, multilingual, gender: genderOf(voice.Gender), age: 'unknown', provider: 'azure', neural: true, localService: false });
            }
            providers.azure = { available: voices.some(voice => voice.provider === 'azure'), configured: true };
        } catch (error) { providers.azure = { available: false, configured: Boolean(credentials.key && credentials.region), reason: error.code || 'AZURE_UNAVAILABLE' }; }
        const unique = [...new Map(voices.map(voice => [voice.voiceURI, voice])).values()]
            .sort((a, b) => Number(b.neural) - Number(a.neural));
        const result = { voices: unique, profiles: profilesFor(unique), providers, packs,
            voiceLibrary: require('./chatterbox-voices.json').map(voice => ({ ...voice, voiceURI: 'chatterbox:' + voice.id, provider: 'chatterbox', lang: 'tr-TR' })) };
        if (currentRevision === revision) { cached = result; expires = Date.now() + cacheMs; }
        else return listVoices({ refresh: true });
        return structuredClone(result);
    }
    async function synthesize(settings = {}) {
        const inputText = typeof settings.text === 'string' ? settings.text.trim() : '';
        if (!inputText || inputText.length > 500 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(inputText)) throw failure('INVALID_TEXT');
        const text = require('./speech-text.cjs').normalizeSpeechText(inputText).slice(0, 500);
        const controller = new AbortController(); pending.add(controller);
        const checkCancelled = () => { if (controller.signal.aborted) throw failure('SPEECH_CANCELLED'); };
        try {
            const { voices, providers } = await listVoices(); checkCancelled();
            const provider = settings.provider || (settings.voiceURI ? settings.voiceURI.split(':')[0] : providers.tikmng?.available ? 'tikmng' : providers.offline.available ? 'offline' : credentials.key && credentials.region ? 'azure' : 'windows');
            const preset = LEGACY_STYLES[settings.voicePreset] || settings.voicePreset || 'natural';
            const style = SPEECH_STYLES[preset];
            if (!style) throw failure('VOICE_UNAVAILABLE');
            const requestedRate = Number.isFinite(Number(settings.rate)) ? Math.max(0.5, Math.min(2, Number(settings.rate))) : 1;
            const rate = Math.max(0.5, Math.min(2, requestedRate * style.rate));
            const pitch = style.pitch;
            async function produce(voice, fallbackUsed) {
                checkCancelled();
                const cacheKey = JSON.stringify([voice.voiceURI, text, rate, pitch, preset]);
                const cachedAudio = audioCache.get(cacheKey);
                if (cachedAudio) { audioCache.delete(cacheKey); audioCache.set(cacheKey, cachedAudio); return { ...cachedAudio, voice: { ...cachedAudio.voice }, fallbackUsed }; }
                let audio;
                if (voice.provider === 'tikmng') {
                    audio = await central.synthesize({ text, voiceURI: voice.voiceURI, rate }, controller.signal);
                } else if (voice.provider === 'chatterbox') {
                    audio = await chatterbox.synthesize({ text, voiceURI: voice.voiceURI, rate: 1 }, { signal: controller.signal });
                } else if (voice.provider === 'offline') {
                    const root = voicePacks?.verify ? await voicePacks.verify(voice.id, controller.signal) : voicePacks?.resolve(voice.id);
                    if (!root) throw Object.assign(new Error('Önce ses paketini indirin.'), { code: 'VOICE_PACK_REQUIRED' });
                    const pitchFactor = 1 + pitch / 100;
                    audio = require('./offline-speech.cjs').applyPitch(await offlineRunner(root, { text, rate, pitchFactor }, { signal: controller.signal,
                        worker: path.join(__dirname, 'vendor', voice.id === 'ema-tr-v1' ? 'ema-worker.cjs' : 'okur-worker.cjs') }), pitchFactor);
                } else if (voice.provider === 'windows') {
                    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="tr-TR"><voice name="${xml(voice.name)}"><prosody rate="${Math.round((rate - 1) * 100)}%" pitch="${pitch >= 0 ? '+' : ''}${pitch}%">${xml(text)}</prosody></voice></speak>`;
                    try { audio = Buffer.from(await windowsRunner('synthesize', { id: voice.id, text, ssml, speed: rate, rate: Math.round(Math.log2(rate) * 5) }, { signal: controller.signal }), 'base64'); }
                    catch { checkCancelled(); throw failure('WINDOWS_UNAVAILABLE'); }
                } else {
                    const content = voice.multilingual ? `<lang xml:lang="tr-TR">${xml(text)}</lang>` : xml(text);
                    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="tr-TR"><voice name="${xml(voice.id)}"><prosody rate="${Math.round((rate - 1) * 100)}%" pitch="${pitch >= 0 ? '+' : ''}${pitch}%">${content}</prosody></voice></speak>`;
                    audio = await azureRequest('v1', ssml, controller.signal);
                }
                checkCancelled();
                if (audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') throw failure('INVALID_AUDIO');
                const result = { audioBase64: audio.toString('base64'), mimeType: 'audio/wav', voice: { ...voice, style: preset, styleLabel: style.label }, fallbackUsed,
                    ...(voice.provider === 'chatterbox' ? { playbackRate: requestedRate } : {}) };
                if (['offline', 'chatterbox', 'windows'].includes(voice.provider) && audio.length <= 2 * 1024 * 1024) {
                    while (audioCache.size >= 16 || audioCacheBytes + result.audioBase64.length > 8 * 1024 * 1024) {
                        const first = audioCache.keys().next().value; audioCacheBytes -= audioCache.get(first).audioBase64.length; audioCache.delete(first);
                    }
                    if (audioCache.has(cacheKey)) audioCacheBytes -= audioCache.get(cacheKey).audioBase64.length;
                    audioCache.set(cacheKey, result); audioCacheBytes += result.audioBase64.length;
                }
                return result;
            }
            try {
                if (provider === 'tikmng' && !providers.tikmng?.available) throw Object.assign(new Error('TikMnG merkezi ses hizmeti hazır değil.'), { code: providers.tikmng?.reason || 'CENTRAL_UNAVAILABLE' });
                if (provider === 'chatterbox' && !providers.chatterbox?.available) throw Object.assign(new Error('Doğal Türkçe ses paketi kurulu değil.'), { code: 'CHATTERBOX_NOT_INSTALLED' });
                if (provider === 'azure' && !providers.azure.available) throw failure(providers.azure.reason || 'VOICE_UNAVAILABLE');
                return await produce(selectVoice(voices, { ...settings, provider }), false);
            } catch (error) {
                checkCancelled();
                if (provider !== 'azure' || settings.allowOfflineFallback !== true) throw error;
                return await produce(selectVoice(voices, { voicePreset: settings.voicePreset, provider: 'windows' }), true);
            }
        } catch(error) {
            if(!['SPEECH_CANCELLED','INVALID_TEXT'].includes(error.code)){cached=null;expires=0;}
            throw error;
        } finally { pending.delete(controller); }
    }
    return { status: listVoices, listVoices, synthesize, configureAzure, configure: configureAzure, cancel,
        close() { cancel(); audioCache.clear(); audioCacheBytes = 0; require('./offline-speech.cjs').closeOffline?.(); } };
}

module.exports = { createSpeechService, selectVoice, profilesFor, runWindows, SPEECH_STYLES, SPEECH_STYLE_IDS };
