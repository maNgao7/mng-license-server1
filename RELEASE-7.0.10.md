# TikMnG 7.0.10

## Scope
- Add the approved Profile Contest 0.3.0 as a separately downloaded game; no Java or external launcher required.
- Preserve the approved standalone test source. Production adapter runs its bundled host in the launcher's existing Electron process with isolated persistent game data.
- Add six sculpted portrait frames to royal widgets and interaction notifications; reuse original-resolution portrait resolution and caching.
- Refresh rankings, PK context, audience participation and gift visuals without changing official PK team scoring.
- Retire the large Chatterbox download UI and migrate its selected voice to Okur while preserving audience filters. Keep Okur/Ema and existing Windows fallback.

## Verification
- Launcher: 990 tests passed, zero failed or skipped.
- Actual built EXE: game launch through IPC, announcement, frame settings, gift matching, voice migration and unchanged original user profile verified.
- Public HTTPS relay: bundled game with three profiles, arbitrary-gift scoring and byte-identical 1080px portraits verified using synthetic events.
- Browser: 18 royal variants and six notification frames; PK desktop/mobile and recorded live packet replay passed. A real live 2v2 match and paid gift were not exercised.
- Real Okur/Ema synthesis and cancellation recovery passed on the test machine. Timing is hardware-dependent.
- Unsigned Windows publisher: SmartScreen can warn. Do not promise faultless behavior on all hardware.

## Publication
- GitHub is the primary release/update source. Drive is a backup copy.
- User uploads the four prepared Drive files, then deploys the latest Render commit.
- Catalog migration only replaces an exact untouched 7.0.9 baseline. Customized administrator catalogs are preserved and may need explicit catalog publication.
- Existing shared Minecraft component rollout is unchanged; no unrelated game re-download is requested.
