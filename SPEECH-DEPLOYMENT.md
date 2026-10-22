# Central TikMnG speech relay

This module lets all authorized TikMnG installations use the server's Azure Speech
resource. Users do not supply Azure credentials. This change only adds the backend;
it does not configure Render, deploy the service, or change the launcher client.

Current handoff status: optional, unconfigured and unpublished. No Azure signup,
credential configuration or activation is part of this change. The parent task
is evaluating local Chatterbox voices separately; this relay is not a dependency
of that experiment. With central credentials absent, authorized requests return
`CENTRAL_NOT_CONFIGURED` without making an upstream network request.

## Registration and credentials

`server.js` imports `registerSpeechRelay` and registers it after CORS, before the
general JSON parser, with the existing read-only `overlayAuthorize` callback.
The module also has its own 8 KiB strict JSON parser (`inflate: false`). If an
application has already parsed JSON, the decoded body's size is checked again.

Only if this optional backend is adopted later, provision these values in the
server's secret environment:

| Environment variable | Meaning |
| --- | --- |
| `MNG_AZURE_SPEECH_KEY` | Key for the shared Azure Speech resource |
| `MNG_AZURE_SPEECH_REGION` | Lowercase Azure region, for example `westeurope` |

Only those two credential variables are read. Missing/invalid credentials disable
the service. Existing administrator credentials are never used for speech.
Configuration is read at registration; restart the service after rotating it.
Never compile the Azure key into an EXE, launcher configuration, web asset, URL,
client response, or content catalog. Do not put licenses in query strings.

The only upstream URLs are built by the server, with a validated region:

- `GET https://{region}.tts.speech.microsoft.com/cognitiveservices/voices/list`
- `POST https://{region}.tts.speech.microsoft.com/cognitiveservices/v1`

The key is sent only in the `Ocp-Apim-Subscription-Key` header to that origin.
Redirects are not followed. Request bodies cannot select an upstream URL,
endpoint, key, region, pitch or arbitrary SSML. See the official
[Azure text-to-speech REST reference](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech).

## HTTP contract

Both routes require `Content-Type: application/json` and credentials in the body.
Other methods return 405. Any query string is rejected. Responses use `no-store`.

`POST /api/speech/voices`:

```json
{ "licenseCode": "EXISTING-BOUND-LICENSE", "deviceId": "existing-device" }
```

```json
{
  "configured": true,
  "available": true,
  "reason": null,
  "voices": [{
    "id": "tr-TR-EmelNeural",
    "name": "Emel",
    "lang": "tr-TR",
    "nativeLang": "tr-TR",
    "multilingual": false,
    "gender": "female",
    "provider": "tikmng",
    "neural": true
  }]
}
```

This example is illustrative, not a hardcoded catalog. Only `VoiceType: Neural`
voices with `Locale: tr-TR` or `SecondaryLocaleList` containing exactly `tr-TR`
are returned. Native Turkish voices sort first. The ID is the actual Azure
`ShortName`. Names and gender come from that speaker's metadata; styles are not
represented as different people. Supported multilingual voices additionally
carry their original `nativeLang` and `multilingual: true`.

`POST /api/speech/synthesize`:

```json
{
  "licenseCode": "EXISTING-BOUND-LICENSE",
  "deviceId": "existing-device",
  "voiceId": "tr-TR-EmelNeural",
  "text": "Merhaba TikMnG!",
  "rate": 1
}
```

`rate` is optional (default 1), numeric and between 0.5 and 2. Text must be
nonblank, valid XML text and at most 500 Unicode scalar characters. Unpaired
surrogates and XML control characters are rejected. All XML special characters
are escaped; text cannot add SSML tags. The exact catalog ID is selected, with
natural `+0%` pitch and a bounded rate. Multilingual speakers explicitly receive
Turkish language markup, matching the launcher's existing Azure voice handling.

```json
{
  "audioBase64": "BASE64_ENCODED_WAV_BYTES",
  "mimeType": "audio/wav",
  "voice": {
    "id": "tr-TR-EmelNeural", "name": "Emel", "lang": "tr-TR",
    "nativeLang": "tr-TR", "multilingual": false,
    "gender": "female", "provider": "tikmng", "neural": true
  }
}
```

The requested output is RIFF, 24 kHz, 16-bit mono PCM. The complete stream is
limited to 8 MiB and checked for RIFF/WAVE size, format/data chunk bounds and PCM
format before any base64 is returned. The JSON voice catalog is limited to 4 MiB.
Provider requests and body reads share a timeout and abort signal. Disconnected
HTTP callers abort their upstream work. No retries automatically spend more quota.
An upstream transport that ignores cancellation continues to occupy its bounded
upstream slot until it settles; subsequent requests fail closed at that limit.

## Authorization and bounded use

Every request calls `overlayAuthorize({ licenseCode, deviceId })`; only a result
containing `ownerId` grants access. This verifies active status, expiration,
blacklist/revocation and the already-bound individual/enrolled agency device.
It never enrolls/activates devices. Authorization is checked again after queueing,
before synthesis spending, and before returning voices/audio. Cached catalogs
cannot bypass authorization. Revoking a license blocks queued work and returning
in-flight results. An already-sent Azure request may still be charged by Azure.

The voice catalog is cached for five minutes; concurrent refreshes share one
upstream call. Failed refreshes back off for five seconds. An expired catalog is
not used to synthesize an unverified speaker.

Limits apply per owner (license), per owner + device, and server process. Changing
devices cannot bypass the owner's budget. Only hashed owner/device identifiers
and counters are retained; text, audio, raw licenses and provider errors are not
logged or written by this module. The admitted request cap is 64, as is the
outstanding authorization cap. Owner/device ledger capacities are 4096/8192;
exhaustion fails closed. Records idle for a day are eligible for cleanup.

| Environment variable | Default | Allowed range |
| --- | ---: | ---: |
| `MNG_SPEECH_OWNER_HOURLY_CHARS` | 10000 | 1-1000000 |
| `MNG_SPEECH_OWNER_DAILY_CHARS` | 30000 | 1-10000000 |
| `MNG_SPEECH_DEVICE_HOURLY_CHARS` | 6000 | 1-1000000 |
| `MNG_SPEECH_DEVICE_DAILY_CHARS` | 20000 | 1-10000000 |
| `MNG_SPEECH_GLOBAL_DAILY_CHARS` | 500000 | 1-100000000 |
| `MNG_SPEECH_OWNER_REQUESTS_PER_MINUTE` | 60 | 1-600 |
| `MNG_SPEECH_DEVICE_REQUESTS_PER_MINUTE` | 30 | 1-300 |
| `MNG_SPEECH_GLOBAL_REQUESTS_PER_MINUTE` | 600 | 1-6000 |
| `MNG_SPEECH_CONCURRENCY` | 4 | 1-16 |
| `MNG_SPEECH_QUEUE_SIZE` | 8 | 0-64 |
| `MNG_SPEECH_QUEUE_TIMEOUT_MS` | 5000 | 100-15000 |
| `MNG_SPEECH_AZURE_TIMEOUT_MS` | 15000 | 100-30000 |
| `MNG_SPEECH_OWNER_PENDING` | 4 | 1-16 |
| `MNG_SPEECH_DEVICE_PENDING` | 2 | 1-8 |

Invalid numerical settings fail startup without printing their values. Pending
limits include running and queued work. Voice-list requests and synthesis both
consume request rate limits, including catalog cache hits. Authorization has a
two-second deadline. All limits are enforced before starting billable synthesis.

Character budgets reserve the full input count synchronously immediately before
sending synthesis to Azure. A failed, timed-out, or disconnected synthesis keeps
that reservation because the provider may have billed it. Invalid voices and
queue rejections do not spend character budget. Budgets use fixed UTC hour/day
windows; request counts use fixed UTC minute windows. Backward clock adjustments
cannot reset budgets within the same process.

**Enforcement lasts only for the lifetime of one server process.** Counters are
in memory, reset on restart, and are not shared across replicas. This is not a
durable billing ledger or subscription-wide Azure cost cap. Use one instance for
these local limits; before scaling, implement an atomic shared/persistent ledger.
Set the resource's own Azure usage/billing controls separately. Provider pricing
and its resource quota still apply; this service is central, not offline or free.

## Safe errors and client integration

Error responses contain `{ configured, available: false, reason, code }` with a
fixed code. They never return raw Azure bodies, thrown error messages, stack
traces, subscription headers, the key, or the text submitted for synthesis.

| Status | Code | Client behavior |
| --- | --- | --- |
| 401 | `CENTRAL_UNAUTHORIZED` | Supply the existing local license/device in the body |
| 403 | `CENTRAL_FORBIDDEN` | Stop requests; verify license activation/status |
| 400 | `CENTRAL_INPUT`, `CENTRAL_INVALID_VOICE` | Correct input or refresh the speaker catalog |
| 405 / 415 / 413 | `CENTRAL_METHOD`, `CENTRAL_JSON_REQUIRED`, `CENTRAL_BODY_TOO_LARGE` | Correct the request format |
| 503 | `CENTRAL_NOT_CONFIGURED` | Show central service unavailable; never ask end users for an Azure key |
| 429 | `CENTRAL_QUOTA` | Honor `Retry-After`; do not immediately retry |
| 503 | `CENTRAL_BUSY` | Honor `Retry-After`; keep the client queue bounded |
| 504 | `CENTRAL_TIMEOUT` | Report timeout; do not assume the provider did not bill |
| 503 | `CENTRAL_UNAVAILABLE`, `CENTRAL_NO_VOICES` | Central authorization/provider configuration needs attention |
| 502 | `CENTRAL_UPSTREAM`, `CENTRAL_RESPONSE_INVALID` | Provider/network/output unavailable |

The launcher integration should list these voices as provider `tikmng`, send the
selected exact `voiceId`, decode the returned WAV in the existing speech player,
and keep license/device fields in POST bodies. Reading rules (followers, selected
gift senders, blocked users, cooldown) remain in the connected launcher's event
pipeline and need no separate browser-source link. This backend does not add
those client controls or change how TikTok is connected.

## Verification before deployment

Run without real Azure credentials or license files:

```sh
node --test tests/speech-relay.test.js tests/overlay-authorization.test.js tests/overlay-relay.test.js
node --check server.js
```

The speech tests use an actual local Express HTTP server, synthetic licenses,
injected clock, mocked upstream fetch, and generated PCM WAV fixtures. They cover
credentials/secrets, actual voice selection, input boundaries, revocation,
budgets, concurrent reservations, saturation, cancellations and invalid output.
They do not connect to Azure, Render or a live TikTok broadcast. A real resource
smoke test and launcher end-to-end audio playback remain deployment checks.
