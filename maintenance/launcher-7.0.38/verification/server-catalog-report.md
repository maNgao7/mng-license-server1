# Server Ring catalog QA

Final server release gate PASSED: exit 0, 441 tests, 435 passed, 0 failed, 6 skipped. Command: tests/release-gate.ps1 -RequireReleaseIntegrity. The unmodified gate ran through RTK with an extra Node TAP file reporter to retain exact counts.

Repository: work/snake-video-launcher-7034; branch/base: release/ring-7038 at fa2de28 (7.0.37 baseline).

## Owned changes

Only these test files were edited/added; server implementation, metadata, generated UI, native code, launcher and release/distribution files remain parent-owned.

- tests/content-api.test.js: expect the Ring addition and 20-game catalog; retain old-game, admin-state and backup checks. Consolidate the version endpoint check from 25 historical migrations into one 7.0.38 contract test and remove a duplicate Arena assertion covered by whole-catalog equality.
- tests/ring-release.test.js: five top-level tests plus 16 admin-state subtests covering video Il6t2jrBy1c, Steam 4793540, no gift image, all 19 existing records/media/launcher retained, current web fallback equality, fresh storage, exact pre-Ring migration and full backup, idempotent restart, and edits to draft or published state. Includes deliberate Ring removal from current state.
- tests/profile-duel-058.test.js: anchor the historical release to the pre-Ring snapshot, then check its descriptor remains unchanged in both current catalogs.
- tests/release-725.test.js: expect 19 public website games; retain full embedded-catalog/card/link/count/asset checks, and require footer/softwareVersion/lockfile to match the package version pinned to 7.0.38 by Ring tests.
- tests/uslu-yaratik-0210.test.js: remove an unrelated duplicate launcher-version pin from the independent package test.

The content-bootstrap test file was unchanged and exercised throughout. The pre-Ring snapshot equals HEAD:content-defaults.json exactly (server-catalog-baseline.json).

## Executed checks

| Check | Exit | Tests | Passed | Failed | Skipped |
| --- | --- | --- | --- | --- | --- |
| Initial content-api + content-bootstrap | 1 | 150 | 123 | 26 | 1 |
| Updated six-file narrow regression | 1 | 179 | 177 | 1 | 1 |
| Initial full gate, without integrity switch | 1 | 441 | 433 | 2 | 6 |
| Ring regression after initial metadata fill | 0 | 21 | 21 | 0 | 0 |
| Website regression after parent artifact fixes | 0 | 8 | 8 | 0 | 0 |
| Final full gate with RequireReleaseIntegrity | 0 | 441 | 435 | 0 | 6 |

The website narrow run contains five public-website tests and three release-725 tests. The Ring narrow run contains five top-level tests and 16 subtests. RTK success logs retain exit and failure/skip counters; the final gate TAP log retains complete counts. git diff --check -- tests also exited 0.

## Resolved implementation failures

Parent surgically updated web/index.html. Both original failures now pass:

1. tests/public-website.test.js:57: missing /oyunlar/ring homepage link.
2. tests/release-725.test.js:64: old embedded JSON, Ring card, counts and 7.0.37 version strings.

No UI assertions were weakened. Server catalog count is 20; public website count is 19 because profile-contest was already absent from the website. Runtime sitemap and canonical routes already derive from game-catalog.json in public-website.js:98-101.

At inspection, build-portal-catalog.cjs supported generic Ring cards/covers when the selected launcher had artwork-current.json Ring currentFile ring-v1.png and its PNG. It did not update footer/softwareVersion and retained the old hardcoded announcement. Also at inspection, public-website.js did not render tutorialUrl; rendered tutorial visibility is outside the completed metadata checks.

## Evidence

- server-catalog-narrow.log, server-catalog-narrow-before.raw.log, server-catalog-narrow-after.raw.log.
- server-release-gate.log / server-release-gate.raw.log: initial failing full gate.
- server-ring-final.log: post-metadata Ring regression.
- server-website-fixed.log: fixed website regression.
- server-release-gate-final.log / server-release-gate-final.tap.log: final passing gate.
- server-final-inputs-before.json / server-final-inputs-after.json: hashes of shared inputs surrounding the final gate. Changed files: [].

Observed Ring metadata after the final gate: SHA-256 a2f3bf8e56e2f0ea71e90a54193e3ba456e1afff9881bcbc857ca01181a85f8e, bytes 349970774. This records the catalog values, not a new archive hash computation.

## Open verification

- Six optional browser tests remain skipped: Arena catalog UI, content-admin forms, portrait cache, hashed bundle cache, offline overlay recovery, and sandboxed overlay embedding. Their Playwright environment variables were not provided.
- The integrity switch checks the script's existing metadata scope (hapisten-kac, profile-duel, fetih). Ring archive contents/hash/size were not independently verified here; the parent owns final rebuilt package verification.
- Native compatibility, live gifts/likes, game lifecycle and launcher checks remain parent-owned. This task only started isolated local HTTP test servers and cleaned its temporary state/listeners.
- No server implementation test failures remain in the final gate. Any later shared-source or package change requires verification appropriate to that change.
