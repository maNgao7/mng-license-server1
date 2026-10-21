'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

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
        $modern.Options.SpeakingRate = [double]$inputData.speed
        $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
            $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetGenericArguments().Count -eq 1 -and
            $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name.StartsWith('IAsyncOperation')
        } | Select-Object -First 1
        $operation = $modern.SynthesizeTextToStreamAsync([string]$inputData.text)
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
            $synth.Speak([string]$inputData.text)
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
    const preset = settings.voicePreset || 'natural';
    if (!['natural', 'female', 'male', 'child'].includes(preset)) throw failure('VOICE_UNAVAILABLE');
    let candidates = voices.filter(voice => !settings.provider || voice.provider === settings.provider);
    if (settings.voiceURI) candidates = candidates.filter(voice => voice.voiceURI === settings.voiceURI);
    if (preset === 'child') candidates = candidates.filter(voice => voice.age === 'child');
    if (preset === 'male' || preset === 'female') candidates = candidates.filter(voice => voice.gender === preset && voice.age !== 'child');
    const selected = candidates[0];
    if (!selected) throw failure('VOICE_UNAVAILABLE');
    return selected;
}

function profilesFor(voices) {
    return ['natural', 'female', 'male', 'child'].map(id => {
        try { return { id, available: true, voiceURI: selectVoice(voices, { voicePreset: id }).voiceURI }; }
        catch { return { id, available: false, voiceURI: null, reason: 'VOICE_UNAVAILABLE' }; }
    });
}

function createSpeechService({ env = process.env, azure, fetchImpl = globalThis.fetch, windowsRunner = runWindows, cacheMs = 30000 } = {}) {
    let credentials = { key: env.MNG_AZURE_SPEECH_KEY || '', region: env.MNG_AZURE_SPEECH_REGION || '' };
    if (azure) credentials = { key: azure.key || '', region: azure.region || '' };
    credentials = { key: String(credentials.key).trim(), region: String(credentials.region).trim().toLowerCase() };
    let cached = null; let expires = 0; let revision = 0;
    const pending = new Set();
    function cancel() { for (const controller of pending) controller.abort(); }
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
        try {
            const installed = await windowsRunner('list');
            for (const voice of Array.isArray(installed) ? installed : [installed]) {
                if (!voice?.id || !voice.name || !turkish(voice.lang)) continue;
                voices.push({ voiceURI: `windows:${voice.id}`, id: voice.id, name: voice.name, lang: voice.lang,
                    gender: genderOf(voice.gender), age: String(voice.age || 'unknown').toLowerCase(), provider: 'windows', neural: false, localService: true });
            }
            providers.windows = { available: voices.length > 0, reason: voices.length ? null : 'VOICE_UNAVAILABLE' };
        } catch { providers.windows = { available: false, reason: 'WINDOWS_UNAVAILABLE' }; }
        try {
            configuration();
            const items = JSON.parse((await azureRequest('voices/list')).toString('utf8'));
            if (!Array.isArray(items)) throw failure('AZURE_UNAVAILABLE');
            for (const voice of items) {
                if (!turkish(voice.Locale) || !voice.ShortName || voice.VoiceType !== 'Neural') continue;
                voices.push({ voiceURI: `azure:${voice.ShortName}`, id: voice.ShortName, name: voice.LocalName || voice.DisplayName || voice.ShortName,
                    lang: voice.Locale, gender: genderOf(voice.Gender), age: 'unknown', provider: 'azure', neural: true, localService: false });
            }
            providers.azure = { available: voices.some(voice => voice.provider === 'azure'), configured: true };
        } catch (error) { providers.azure = { available: false, configured: Boolean(credentials.key && credentials.region), reason: error.code || 'AZURE_UNAVAILABLE' }; }
        const unique = [...new Map(voices.map(voice => [voice.voiceURI, voice])).values()]
            .sort((a, b) => Number(b.neural) - Number(a.neural));
        const result = { voices: unique, profiles: profilesFor(unique), providers };
        if (currentRevision === revision) { cached = result; expires = Date.now() + cacheMs; }
        else return listVoices({ refresh: true });
        return structuredClone(result);
    }
    async function synthesize(settings = {}) {
        const text = typeof settings.text === 'string' ? settings.text.trim() : '';
        if (!text || text.length > 500 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) throw failure('INVALID_TEXT');
        const controller = new AbortController(); pending.add(controller);
        const checkCancelled = () => { if (controller.signal.aborted) throw failure('SPEECH_CANCELLED'); };
        try {
            const { voices, providers } = await listVoices(); checkCancelled();
            const provider = settings.provider || (settings.voiceURI ? settings.voiceURI.split(':')[0] : credentials.key && credentials.region ? 'azure' : 'windows');
            const rate = Number.isFinite(Number(settings.rate)) ? Math.max(0.5, Math.min(2, Number(settings.rate))) : 1;
            async function produce(voice, fallbackUsed) {
                checkCancelled();
                let audio;
                if (voice.provider === 'windows') {
                    try { audio = Buffer.from(await windowsRunner('synthesize', { id: voice.id, text, speed: rate, rate: Math.round(Math.log2(rate) * 5) }, { signal: controller.signal }), 'base64'); }
                    catch { checkCancelled(); throw failure('WINDOWS_UNAVAILABLE'); }
                } else {
                    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="tr-TR"><voice name="${xml(voice.id)}"><prosody rate="${Math.round((rate - 1) * 100)}%">${xml(text)}</prosody></voice></speak>`;
                    audio = await azureRequest('v1', ssml, controller.signal);
                }
                checkCancelled();
                if (audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') throw failure('INVALID_AUDIO');
                return { audioBase64: audio.toString('base64'), mimeType: 'audio/wav', voice, fallbackUsed };
            }
            try {
                if (provider === 'azure' && !providers.azure.available) throw failure(providers.azure.reason || 'VOICE_UNAVAILABLE');
                return await produce(selectVoice(voices, { ...settings, provider }), false);
            } catch (error) {
                checkCancelled();
                if (provider !== 'azure' || settings.allowOfflineFallback !== true) throw error;
                return await produce(selectVoice(voices, { voicePreset: settings.voicePreset, provider: 'windows' }), true);
            }
        } finally { pending.delete(controller); }
    }
    return { status: listVoices, listVoices, synthesize, configureAzure, configure: configureAzure, cancel };
}

module.exports = { createSpeechService, selectVoice, profilesFor, runWindows };
