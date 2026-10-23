# TikMnG 7.0.0

## Delivery

- Launcher installer and portable: GitHub release `v7.0.0`.
- Installer size: 206,446,928 bytes (206.4 MB, 196.9 MiB).
- Installer SHA-256: `ef3a5ee2553ec512d13f0765dc88aa311122908c4ffea650053d4911df1d083d`.
- The NSIS blockmap and SHA-512 feed are included for application updates.
- Media release `media-7.0.0`: 165 videos, 120 audio clips, 693,684,608 bytes.
- Voice-driving support release `game-caahr-0.6.11`: 52,163,999 bytes. Requires
  the separate Steam CAAAHR Demo; no base-game binaries are redistributed.
- Existing game package versions stay independent from launcher version 7.0.0.

## Checks

- 817 launcher checks passed. Packaged Electron startup and real preload IPC passed.
- 15 original covers decoded; game details, media preview and exact gift routing passed.
- Shared HTTPS media relay, reconnect and widget scenarios passed controlled tests.
- Native game window was confirmed visible; the test-owned game process was closed.
- Website tested at 360, 390, 768, 1024, 1440 and 1920 widths.
- Website gift designer uses the same model, script, styles, catalog and fonts as
  the launcher. Saved designs, legacy migration and transparent PNG export passed.
- License/admin/content API tests preserve existing data and reject unauthorized writes.

## Render: Owner Deploys

Render deployment is intentionally left to the owner. Choose the service backed by
this repository, deploy the latest `main` commit, and retain all existing environment
variables and persistent data. Do not clear the disk or recreate the service.

After deployment check:

1. `/api/version` returns `latestVersion: "7.0.0"` and the v7.0.0 installer URL.
2. `/` loads `portal-v4.css` and shows 15 game covers.
3. `/hediye-tasarimi` opens the updated designer and exports a transparent PNG.
4. `/api/content/catalog` exposes 15 games and 285 media entries on an untouched
   initial catalogue. Only the exact unedited revision-0 bootstrap is migrated,
   with a backup. Administrator-edited/published catalogues are never replaced.
5. Admin login and an existing license continue to work.

GitHub distribution can be verified independently from Render deployment.
TikTok availability and real Live Studio behaviour remain third-party dependencies,
not a zero-outage guarantee. Windows may display SmartScreen because no publisher
code-signing certificate is configured.

## Google Drive

The connector has a 100 MB file-transfer limit. The owner uploads the 206 MB setup
file manually. The existing instruction, control report and manifest IDs are updated
in place. Retain old game ZIPs: they are unrelated to this launcher release.
