# TikMnG 7.0.1

## Launcher

- Separate Library and My Actions tabs in Video Studio and Sound Effects.
- My Actions shows saved gift mappings, enabled state and global/game scope.
- Sound Effects uses audio-only rows, without video thumbnails or a duplicate
  published-media section. Published downloads and local assets are deduplicated.
- Background asset arrivals update metadata without replacing the active video,
  audio preview, search field or editor. Imports open the new action editor.
- Closing/reopening Media Studio restores saved mappings without reconfiguration.
- Game packages, media downloads and voice packs remain separate from the launcher.

## Server (Deploy Separately)

An offline browser source now returns a transparent retrying HTML document with
a nonce-based Content Security Policy. It reloads after three seconds, so a
publisher that starts later can recover without manually refreshing Live Studio.
Binary media and JSON/state requests keep their HTTP 503 error semantics.
Authorization, signed source URLs, channel isolation and public read-only rules
are unchanged. Installer/portable/version metadata now point to 7.0.1.

Render was not deployed by the agent. The owner will deploy main after delivery.
Keep all environment variables, the relay secret and the persistent data disk.

## Evidence

- Launcher automated suite: 817 passed, no failures/skips.
- Workspace browser QA: 15 covers, media editing, sound-only lists, My Actions,
  gift selection, exact event routing, restart persistence and responsive layouts.
- Preview video and audio node identities survive background catalog events.
- Packaged Electron startup: version 7.0.1, 15 games, 285 media, names disabled.
- Offline-start recovery exercised in Chrome without manual reload.
- Earlier installed 7.0.0 connected to the supplied live account without an
  injected developer key; real Rose gifts triggered its mapped video events.
- The owner reported video playback and chat reading working in manual testing.
  This is not a guarantee of uninterrupted TikTok/Live Studio service.

## Distribution

Official artifacts are under GitHub release v7.0.1. Optional media remains on
media-7.0.0 (165 video, 120 audio); no game package versions were changed here.
The installer is per-user and one-click. No Windows signing certificate is
configured; SmartScreen warnings remain possible.

The owner uploads TikMnG-Setup-7.0.1.exe to Google Drive manually. Do not claim
that Drive has been updated until that upload has been checked.
