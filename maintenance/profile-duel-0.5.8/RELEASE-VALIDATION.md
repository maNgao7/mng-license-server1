# Profile Duel 0.5.8 release validation

Only the player picker and its control-page host/layout changed. Runtime scoring, source ownership, gifts, result/winner behavior and public broadcast rendering retain 0.5.7 behavior. Launcher stays 7.0.36.

- Game release gate: 37/37 passed, no skipped tests.
- Browser: full-window left/right dialog tested with 85 local fixture profiles, 2560×1440, 1152×760 and 390×780; search, groups, duplicate selection, scrolling/pagination and focus checked. Screenshots inspected locally.
- Extracted shipped ZIP: real browser opening, empty wait state, both picker selections, 10-second manual round, duplicate event protection, automatic end, winner retention, next round and removal to clean idle passed.
- Server release gate with RequireReleaseIntegrity: passed; 6 optional browser tests skipped by its existing environment guards. Game browser regression above ran without skips.
- Catalog revision 2026112502 upgrades only Profile Duel from 0.5.7 to 0.5.8. Both default catalog copies match. Migration preserves customized published catalogs and pending admin drafts.
- No live TikTok gift/portrait test was performed for this UI-only release. Tests use local fixtures; no profiles or credentials ship in the ZIP.
- The source release folder below retains the complete game files. package-contents.json is the allowlist/integrity map; tests and this report are not part of the downloadable ZIP.
- Existing browser test portrait fixtures refer to the local widget-overhaul preview cover image and the installed Playwright/Chrome paths. See the test headers when reproducing on another machine.
- Render deployment is reserved to the user.
