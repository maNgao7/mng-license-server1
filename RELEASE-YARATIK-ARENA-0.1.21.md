# Yaratik Arena 0.1.21

Game hotfix for TikMnG 7.0.15. Launcher latest remains 7.0.15.

- Creature health bars attach above the head, show no numeric health text, and
  use distance-based level of detail.
- Restarting after the killer portrait death screen fully clears old bodies
  while retaining the live connection, saved settings, and queued gifts.
- After seven seconds without taking a hit, the player regenerates 1% of maximum
  health per second. Regeneration does not run while dead or paused.
- The player HUD is 18% larger and raised by 24 pixels.

## Catalog Migration

The 7.0.15 rev11 catalog, including Arena 0.1.20, is preserved byte-for-byte in
`content-bootstrap-7.0.15.json`. Only an exact match of both the stored draft and
published catalog migrates to rev12. The update changes only Arena's package
version, URL, SHA-256, and size, plus catalog revision and publication metadata.
Administrator changes in either catalog prevent automatic replacement. Other
games, media, launcher metadata, and license data are retained.

Game archive:
https://github.com/maNgao7/mng-license-server1/releases/download/yaratik-arena-0.1.21/yaratik-arena.zip

## Integration Status

Final package metadata is read from Main's
`D:/TikMnG-Yaratik-Arena-0.1.21-release/package-descriptor.json` and independently
verified against the local ZIP:

- Version: `0.1.21`
- Bytes: `151506384`
- SHA-256: `2c512ffb9dab578efa06de81038af207260692c5915f481cfe3b4d3bda6fb503`

The rev12 catalog contains these verified values. Its publication timestamp uses
the final descriptor's filesystem modification time in UTC.

The packaged native game passed all seven gameplay regression suites, including
head-attached indicators at 1920x1080, 1280x720 and 800x600, actual lethal attacks
and complete death resets, delayed health regeneration, likes/follows/gifts,
combat, crowded scenes, floor protection, vacuum collection and directional dash.
The 0.1.20-to-0.1.21 launcher installation preserved saved settings and recopied
zero bytes of the cached original Steam game. The original Steam installation
was not modified or redistributed.

## Catalog Verification

240 native rules checks and all 121 server tests passed. Regressions use the
actual rev11 catalog and verify the Arena-only rev12 upgrade, backup retention,
restart idempotence, customized draft/published preservation, and launcher latest
remaining 7.0.15. Evidence: `maintenance/yaratik-arena-0.1.21/VERIFICATION.json`.

In one 100-creature local measurement, mean frame time changed from 3.81 ms to
3.18 ms. This is evidence for this computer only, not a guarantee for every PC.
Current hotfix gift/like/follow tests use normalized fixtures in the real engine;
no paid gifts or chat messages were sent. The live bridge is unchanged.

Only the game needs updating. Do not uninstall the launcher, replace the Drive
installer, reinstall the Steam demo, or delete existing user settings.
