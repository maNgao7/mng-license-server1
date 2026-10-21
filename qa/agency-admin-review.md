# Agency Administration Refresh

## Scope and Visual Direction

- Existing TikMnG Express website and admin panel; no new hosting platform.
- Quiet, dense operational layout: charcoal navigation, neutral workspace, teal commands, restrained status colors.
- Expandable agency rows expose registered devices, administrator-assigned publisher labels, first recorded login, last license check and login count.
- Public site keeps its existing artwork, demos, download and contact flows. Typography, navigation and mobile spacing were refined.
- Follow-up: the hero artwork now occupies almost the entire first viewport without an overlaid demo panel. Demos remain playable in their own unframed section below it. A persistent upper-right admin entry is visible on desktop and mobile without opening a menu.
- No launcher/game files or existing runtime license databases were changed.

## Agency Keys and Compatibility

- User-entered agency/brand/username determines the key prefix; Hype is never added automatically.
- New key: up to seven normalized name characters, eight random hex characters and an eight-character HMAC signature. Maximum 25 characters, matching the already-deployed launcher's input limit.
- Full agency names remain in database records. Individual keys retain their original format and single-device binding.
- Legacy agency keys and legacy activation tokens remain supported.
- New agency activation receipts bind the full name, capacity, duration, expiration and device through a SHA-256 HMAC. Cached receipts can recover agency records without incorrectly converting them to individual licenses.
- Unactivated compact keys require the license database or its backup. They do not encode the entire license configuration. Persistent storage / the existing encrypted GitHub backup must be retained for production.

## Capacity Semantics

- Capacity means distinct registered devices, not concurrent online viewers or verified individual people.
- Re-entering with the same device never uses another slot. Initial registration and subsequent checks use the same membership rules.
- Administrators can label devices, increase capacity, reduce it no lower than occupancy, block one device to release its slot, and re-allow it later.
- A blocked device cannot re-register or reuse a cached receipt while the authoritative record exists.
- Old browser backups are restored only by explicit administrator action and never overwrite current membership/capacity for an existing key.
- Failed primary license writes return an error instead of acknowledging an unpersisted change.

## Verification

Run `npm run test:licenses` for ten API/integration scenarios, covering 20-seat limits, duplicate entry, concurrent registrations, every member's subsequent check, per-device tokens, capacity changes, labels, blocking, restart persistence, validation, legacy keys, signed receipt recovery, expiration/revocation, storage-write failure and admin authorization.

Run `tests/admin-browser-check.cjs` with `PLAYWRIGHT_MODULE` pointing to Playwright and optional `BROWSER_EXECUTABLE` pointing to an installed Chromium browser. Twenty-one browser checkpoints include desktop/mobile overflow, agency creation/expansion, saving labels/capacity, block/unblock, backup export/import, individual keys, stored-XSS escaping, search, error recovery, public navigation and end-to-end inquiry submission to admin. The admin entry and hero layout are checked at 2560, 1920, 1366, 390 and 320 pixels wide, and a canvas-pixel check verifies the relocated demo remains rendered.

All checks use isolated temporary databases, generated test secrets, disabled external backups and loopback listeners. Browser artifacts are written to `qa/admin-2026-10-21/` and contain only disposable demo data.

Production deployment: install the updated dependency lockfile, deploy the website/server commit on Render, and retain the existing data directory, admin secret and backup settings. No installer or game-package release is required.
