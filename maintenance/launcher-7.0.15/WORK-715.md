# TikMnG 7.0.15 Release Preparation

Scope: local release preparation only. Main owns native Arena acceptance, catalog,
game tests, server/site work, full server tests, GitHub publication and source snapshots.
This sidecar does not publish GitHub releases or change
Render, administrator previews, older releases or current user configuration.

- Arena descriptor: `D:/TikMnG-Yaratik-Arena-0.1.20-final2/package-descriptor.json`.
- Arena ZIP: 151499890 bytes, SHA-256
  `3761d94d81a4c69591d3e0520d1dee101526cc0bc26e2a8be9c776728fe14434`.
- Original demo excluded. Steam App 5364590 must be installed first from
  https://store.steampowered.com/app/5364590/.
- New-install defaults: 100 likes -> 5 creatures, first follow -> 5, Parfum -> 25,
  Blue Bead (gift 5319) -> 10; borderless. Existing custom settings are not rewritten.
- Stage: `D:/TikMnG-Release-7.0.15-build`.
- Output: `D:/TikMnG-Release-7.0.15-ready`.
- Production identity, updater repository, licensing code and NSIS retention policy
  are preserved. Staged administrator game list is empty; published Arena remains.
- No publisher certificate is installed: `signedPublisher: false`.

## Verification

- Focused source suite: 121 passed, zero failures, cancellations or skips.
- Added only one Arena unit case: exact 240-character loader path rejected before
  package reads/copies; Steam base files remain unchanged.
- Full source suite passed 1182/1182, zero failures, cancellations or skips, with
  `MNG_GAME_SOURCE_ROOT=C:/Users/User/Desktop/MNG-TikTok-Game`, the bundled
  `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE` set to installed Chrome;
  log: `qa-715-full.log`. The first run had 1181 passes and one optional Chromium
  skip. The second exposed a missing bundled-browser executable and a transient
  390px leaderboard assertion. Both tests pass in the corrected, serial follow-up
  (21/21; `qa/715/full-suite-followup.log`). The corrected serial full run completed
  in 217.2 seconds.
- Final2 installer and portable build passed with Electron 31.7.7 / builder 24.13.3,
  `--publish never`. Initial Windows vendor extraction failed on macOS symlinks;
  WinCodeSign 2.6.0 was extracted excluding `darwin` into this release's isolated
  `.builder-cache`. `signAndEditExecutable` remains enabled, preserving branding.
- Finalized installer: `TikMnG-Setup-7.0.15.exe`, 250321156 bytes. Portable:
  `TikMnG-7.0.15-Portable.exe`, 250142577 bytes. Blockmap: 259887 bytes. Local
  manifest and normalized update feed generated at `2026-11-02T09:58:55.135Z`.
- Installer SHA-256:
  `fd2ac5b7cc2adf4f12cf19a87a0bc9235f3727ff33e3f16accfcf34967ed0a17`.
- Portable SHA-256:
  `119220b365ff9f03a47ae8af134808765fff90b3b6774b49bb89a61d600817fa`.
- Corrected gift 5319 to Blue Bead in release notes and this work record. Re-ran
  prepare/build, actual packaged stable smoke, and local finalization as requested.
  Corrected source notes, staged releaseInfo, final notes and latest.yml match.
  app.asar is byte-identical to the prior tested build; runtime code did not change.
  The existing 1182-pass full suite remains valid and was not rerun for this edit.
- Read-only source/package audit passed: 1802 source-file digests, 1796 packaged
  files compared, preserved appId/productName/updater/NSIS/Windows branding options,
  empty staged administrator list. EXE version resources identify TikMnG 7.0.15.
- Actual packaged stable EXE smoke passed (`qa/715/packaged-result.json`): real
  preload/IPC, actual Steam discovery and refresh, HTTPS store-button dispatch,
  missing-demo UI with only discovery stubbed, only Arena's new-game announcement,
  dismissal across process restart, byte-identical gift PNG save, custom widget/TTS
  settings and a synthetic game-settings fixture retained across restart.
- Smoke uses fresh isolated temporary userData/Documents/Videos, no copied or read
  original configuration. Only the authenticated UI state is simulated; a missing
  license is still rejected. External-browser opening and native save selection
  are intercepted. Native game launch remains main's responsibility.
- Packaged app.asar SHA-256:
  `0af1dad9cdf92b5e5780ec8aea92400dfb384eb7dfb560e3e9fdbbef5b1b3c2b`.
- Screenshots: `qa/715/packaged-arena-desktop.png` and
  `qa/715/packaged-arena-restarted.png`; desktop screenshot visually inspected.
- Authenticode checked on unpacked EXE, installer and portable: all `NotSigned`;
  `signedPublisher: false`. Current user custom settings were not changed.
- The first build was stopped at the user's instruction when the first-install
  settings defect was identified. Its incomplete unpacked files are superseded by
  final2. No installer or finalized release was produced from the old descriptor.
- Main native acceptance: `D:/TikMnG-Arena715-Final2QA/arena-package-result.json`.
  Verified latest run finished `2026-11-02T09:55:50.206Z` with `passed`,
  `nativePassed` and `livePassed` all true. All four native suites passed, along
  with first-install audio 71/3/80, zero-copy second preparation and settings/base
  preservation through library repair. Actual crbaris_ live delivery: 14 events,
  one gift event, three like events and two rendered live portraits; verified true.
  No messages or gifts were sent by the test.
- Main reports the earlier damage-feedback failure was an Update/OnGUI harness
  race, resolved by waiting 600 ms before the same assertion. No shipping binary
  changed and the assertion was not weakened. Native acceptance is now satisfied.
  This sidecar subsequently completed the authorized local finalization after the
  Blue Bead documentation correction. No GitHub assets were published and no
  server/site/Render changes were made; those steps and snapshots remain with main.
- The actual native gift event was observed, not purchased or sent by QA.
  `realPaidGiftTest: false`, `signedPublisher: false`, `published: false` and
  `currentUserCustomSettingsNotChanged: true` are verified in the final report.

## Handoff Evidence

- Packaged smoke report: `qa/715/packaged-result.json`.
- Packaged smoke log: `qa/715/packaged.log`.
- Build log: `qa/715/build.log`.
- Finalization log: `qa/715/finalize.log`.
- Full launcher suite log: `qa-715-full.log`.
- Final manifest: `D:/TikMnG-Release-7.0.15-ready/manifest-7.0.15.json`.
- Final acceptance report: `D:/TikMnG-Release-7.0.15-ready/KONTROL-RAPORU.json`.

## Commands

1. `node tools/prepare-release715.cjs --build`
2. `node tools/qa-packaged715.cjs`
3. `node tools/prepare-release715.cjs --finalize`

The build always uses `--publish never`. Finalization checks source/stage/package
hashes, full-suite results and the exact app.asar tested by packaged QA before
creating the installer/portable manifest and normalized local update feed.
