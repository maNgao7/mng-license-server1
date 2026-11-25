# Teke Tek Profil 0.5.8 — local test report

Date: 25 November 2026.

- tests/release-gate.ps1 passed: 37 tests, 37 passed, zero failures or skips.
- Browser regression checks the actual launcher control page with an 85-person fixture: both viewport-edge pickers, dialog outside the iframe, search, gift/chat/like categories, paginated selection beyond row 40, duplicate-side prevention, Escape focus restoration, cross-document portrait retry and stable live updates.
- Tested viewport sizes: 2560×1440, 1152×760, 390×780; no horizontal overflow or dialog clipping. Public widget remains read-only and compact. Standalone keyed widget still works.
- Existing duration, start/pause/reset, winner retention, scoring, deduplication and shared-session tests passed.
- Runtime src files remain byte-identical (apart from line endings) to the previously published 0.5.7 package.
- These are local fixture/browser tests, not real TikTok gift delivery or user-observed live-stream validation. No TikTok connection was opened and no real participant, gift or account data was changed.
- Package uses the previous explicit 23-file allowlist, with this version's notes replacing the old notes. No node_modules, test profiles, credentials, settings or QA logs are shipped.
