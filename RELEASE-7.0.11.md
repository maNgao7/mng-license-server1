# TikMnG 7.0.11 Release Verification

## Scope

Launcher widget and portable speech update. The Profile Contest 0.3.0 game and all other game packages remain unchanged. Existing licenses, media, video rules, audience filters and saved rankings are preserved. No uninstall is required.

- PK: actual 1v1/2v2 rosters, four-corner layout, verified numeric-ID profile resolution and idempotent official match results.
- Racon list: six sculpted frame choices, centered heading/brand, fixed top three and rotating persistent lower ranks.
- Action wheel: gift-triggered appearance, random result, configured result duration and automatic dismissal.
- Stream timer: eight independently selected gifts and duration rules; pause, resume and reset. Does not control TikTok livestream termination.
- Notifications: per-person like thresholds, explicit gift captions, updated penalty/pusher/firework identity and recent-gift styling.
- Speech: bundled ONNX WebAssembly runtime for Okur and Ema; no ONNX native DLL or customer Visual C++ requirement. Initial model downloads still require internet access.
- Transfer: type-scoped snapshots and event cursors for transient widgets. Polling responsiveness is retained.

## Validation

- 995 launcher tests: no failures or skips.
- Real packaged Windows executable: IPC settings, independent gift selectors, duplicate event handling, preserved user settings and Profile Contest launch.
- Both voices generated non-silent WAV audio using the packaged executable and bundled WASM runtime. Native ONNX is absent from the package.
- Actual HTTPS overlay relay: four original PK profiles, recorded live 2v2 packet replay, desktop/mobile layout, Racon pagination, wheel dismissal, notification threshold and timer.
- Fourteen additional widget smoke checks, eighteen royal-frame variants and six interaction-frame variants.
- Read-only live observation of the two authorized TikTok accounts. No paid gifts sent. Public source pictures have varying original resolutions; absent source detail is not invented.
- No physical verification on other customers' computers. External TikTok availability and first-time model download connectivity remain dependencies.

## Transfer Measurements

The synthetic 120-event comparison reduced an interaction snapshot from 174,404 to 1,401 bytes and a wheel snapshot to 1,790 bytes. Coin-jar response size fell by 68.9%; PK was already scoped and did not change. These are per-response fixture measurements, NOT an overall Render bill reduction or cost guarantee.

## Build

The sanitized launcher source is in `maintenance/launcher-7.0.11`. Use the existing Electron 31.7.7/electron-builder 24.13.3 pipeline. The shipped game catalog must be the public catalog, not administrator preview metadata.

The checked-in `lib/vendor/speech-inference-worker.cjs` bundles `onnxruntime-web` 1.23.2 and uses the matching two files in `lib/vendor/onnx-wasm`. To regenerate, install `onnxruntime-web@1.23.2` in the isolated `outputs/speech-compat-build` tool directory, then run `tools/build-speech-compat.cjs`. Include the MIT notice and unpack both WASM runtime assets. Do not include the deprecated native ONNX runtime or full portrait-engine source in the installer.

Normalized installer, blockmap, portable executable and `latest.yml` must match `manifest-7.0.11.json`. Verify GitHub asset digests before promoting the release and changing the public server version. The Drive folder is a backup distribution channel; Render deployment is performed separately.

Windows publisher certificate is not configured; SmartScreen can warn. Existing game download URLs remain on their previously verified releases.
