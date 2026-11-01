# 7.0.14 Private Widget Candidate

No public 7.0.14 release, GitHub push, Drive upload or Render deployment.
The approved live 7.0.13 release remains unchanged.

## Widget Maintenance

- Fireworks: separate launch/burst/name phases, no avatar/card, name fades and clears.
- Compact stable coin/like rankings; remove unit labels, retain score and portrait DOM.
- Larger circular Racon portrait, centered circular Beauty portrait; original image bytes retained.
- Viral settings simplified: remove six per-range animation selectors, retain old thresholds
  internally, add one entrance-sound choice and one selector for wings/gold/crystal/ember.
- Jar: default capacity 200, legacy default 140 migrates once while custom capacities survive.
  Base 25 plus one unit per five unit-coins: 1 -> 25, 5 -> 26, 10 -> 27; bounded at 64.
  Gift repeat totals do not enlarge a cheap individual gift.
- Full launcher regression suite: 1,145 passed, zero failures/skips before concept-only revision.
- Built and existing administrator preview EXEs passed isolated IPC/delta, settings, manual video,
  unit-gift ranking and original profile hash-preservation checks.
- Existing preview updated in place, no new shortcut:
  `D:/TikMnG-Update-QA-20261030/preview-build/win-unpacked/resources`.
- Backup: `D:/TikMnG-Update-QA-20261030/preview-backup-714-20261102-32fa7b35`.

## Frame Concepts, Revision 2

The user rejected all first-pass animations. V1 remains only as an unused source reference.
Active independent preview: sibling `../widget-preview-7.0.14`, `frame-motion-v2.js`.
The user approved revision 2. All three designs are integrated into the packaged launcher.

- Guaranteed round foreground portrait, width 66% on Gold, 62% on Crystal/Ember.
  Perspective/ornament deformation never affects the photo.
- Gold: attached engraved coin pieces rotate in real 3D; a jewel mechanism turns around the rim.
- Crystal: three modeled metal/jewel rings tilt and counter-rotate with actual depth.
- Ember: natural alpha fire texture with animated distortion, limited floating embers, lit metal rim.
- Three.js 0.180.0 is installed only in the independent preview, not the launcher or Render.
- Up to 30 FPS, offscreen/hidden animation pause, reduced-motion and manual pause supported.
- A depth-only circular shield excludes all animated geometry from the portrait aperture.
- Local optional photo picker uses object URLs; the file is never uploaded.
- Actual Chrome desktop/mobile, moving/nonblank canvas pixel checks, center alpha, shader errors,
  pause/reduced-motion and nonsquare image-fit checks are in `tests/widget-refresh714.test.cjs`.

## Final Verification

- 1,174 launcher tests and 101 server tests pass; zero failures or skipped tests.
- All three designs retain their actual controller, canvas and images through 100 changes each.
  No lost or duplicate gift IDs, new WebGL contexts or immutable asset transfers during updates.
- Original full-resolution frame art is losslessly converted to WebP. Only small 3D ornament
  textures are 512px; portrait photos and frame art are not downscaled.
- The bundle is 514,708 bytes, 153,805 on the gzip wire. Widget HTML also compresses losslessly.
- Actual sandboxed full navigation still refetches art (roughly 1.77-2.05 MB per selected style).
  Security isolation is retained; do not promise zero traffic on source reload.
- Deterministic 103-frame test: full 6,067,900 B; gzip 1,177,428 B; gzip+delta 176,658 B.
- Approximately 750 KiB snapshots: full 8,638,686 B; gzip+delta 435,035 B, exact Chrome results.
- Retain up to 2 MiB per delta base with 8 MiB total/128 entries/90 seconds on the publisher;
  browser uses four entries/8 MiB. Larger data falls back losslessly, not unbounded retention.
- Small jar overflow gifts resting above the ground on another gift now enter cleanup, while
  the settled jar contents are retained. Both natural side escapes and capacity bursts pass.
- Final stable EXE and the existing administrator preview pass actual IPC, all three WebGL
  frames, private authenticated asset routes, manual entry video and profile preservation.
- Okur and Ema synthesize non-silent WAV using the packaged portable WASM runtime.
- Local synthetic byte reductions are not a Render invoice guarantee. Real paid gifts and
  other customers' hardware were not tested. No publisher signing certificate is installed.

Preview helper: `node tools/preview-widgets714.cjs` (loopback only).
Current user-facing URL: `http://127.0.0.1:57295/`.
