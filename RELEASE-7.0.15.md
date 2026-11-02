# TikMnG 7.0.15 / Arena 0.1.20

- New published game: Yaratik Arena. Only Arena receives the new-game announcement.
- Requires the free Steam Can 'Em All Demo (App ID 5364590, tested build 25638418).
  Store link: https://store.steampowered.com/app/5364590/
- The mod ZIP contains support components, not the original Steam game. Verified
  Steam files are copied locally into an isolated mod directory on first launch.
  Steam originals are not modified; subsequent launch and repair reuse the copy.
- Fresh settings: each personal 100 likes -> 5 creatures; first follow -> 5;
  Parfum 5658 -> 25; Blue Bead 5319 -> 10. Existing custom settings are retained.
- Borderless fullscreen, readiness-based TikMnG startup cover, 71/3/80 initial
  audio levels, downloadable original guide and game cover are included.
- Catalog migration applies only to exact unchanged released baselines. Draft
  or published administrator edits are not replaced. License data is untouched.
- Public game detail includes the free demo and original PNG download links.

## Verification

- 1,182 launcher tests pass without skips; packaged IPC/Steam controls, new-game
  announcement, guide export and isolated profile retention pass.
- Actual final2 game package passes event, combat, crowd, floor, vacuum and dash
  suites. Actual crbaris_ live connection receives gift/like events and renders
  real profile portraits. Follow threshold/deduplication is fixture-tested.
- No gifts were purchased or sent by the test. Other customer hardware was not
  tested. Binaries have no publisher signing certificate; SmartScreen may warn.
- Main reports: D:/TikMnG-Arena715-Final2QA/arena-package-result.json and
  D:/TikMnG-Release-7.0.15-ready/KONTROL-RAPORU.json.

## Traffic

Existing 7.0.14 low-traffic code remains unchanged. On November 2 the authenticated
meter showed 1.235 MB incremental HTTP body data over 11.36 minutes; this is not
a measured reduction percentage or invoice forecast. Offline-source retry pages
contributed small repeated errors; images, video and state bytes were unchanged
during that sample. Read-only monitoring is scheduled every four hours. No plan,
card, payment or spending-cap settings changed. Current billing and monthly GB
are separate from the process-lifetime HTTP meter.
