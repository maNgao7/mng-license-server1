# TikMnG 7.0.13

Verified launcher maintenance and low-traffic widget release. The new protocol is
opt-in and backward compatible. Original portrait/video quality, licensing,
existing URLs, game profiles, saved videos and settings are retained.

- Launcher regression suite: 1,143 passed, zero failures/skips.
- Server regression suite: 90 passed, including actual Chrome integrations.
- Stable packaged EXE: IPC, exact-token state protocol, visible-row limit, entry
  video playback, saved settings and original profile preservation passed.
- Packaged Okur/Ema workers generated non-silent WAV through portable WASM.
- Real local relay/Chrome workload: full 2,126,993 bytes, gzip 422,989 bytes,
  gzip plus delta 72,320 bytes. All 173 activity IDs delivered exactly once.
  These are synthetic HTTP body measurements, not invoice guarantees.
- Separate Snow War 7.0.6: real install/upgrade, preserved settings and shared
  runtime, packaged native sender/combat smoke all passed.

GitHub release files are the update source. Drive is the user's backup. After
deploying this commit on Render, users update normally to 7.0.13 and refresh
their open Live Studio/OBS browser sources once. The existing URLs do not change.
Old open documents cannot use delta until refreshed. No billing setting changed.
