# Minecraft game-only release 7.0.3

Only snow-war and battle-royale change. The launcher remains 7.0.6.
The release notes describe controls, migration, preserved settings and test limits.

Each game directory contains its mod source, Gradle wrapper and resources.
The two native gift smoke suites use synthetic events through the real command
handler; they do not purchase TikTok gifts. Enable only in an isolated test world.

## Checks

- In snow-war/mod: `./gradlew.bat regressionTest build`
- In battle-royale/mod: `./gradlew.bat catalogResourceCheck build`
- In either mod: `./gradlew.bat runClient -PgiftSmoke`
- In either mod: `./gradlew.bat runClient -PwinnerSmoke`
- In snow-war/mod: `./gradlew.bat runClient -PpauseSmoke`
- In server root: `node --test tests/content-bootstrap.test.js tests/content-api.test.js`
- In launcher source: `node --test tests/game-content.test.cjs`

Native screenshots and logs are under qa/. Both gift catalogs contain 905 unique
IDs with decoded images. All 26 standard actions were tested on native entities.
The 23,530 routing cases are resolver checks, not 23,530 purchased gift events.

## Delivery

The assets are published under the immutable tag minecraft-rounds-20261027.
Existing managed installs reuse unchanged files and download one new mod each.
Full ZIPs are for clean installs. Never replace a published asset in place.

`node verify-release.cjs <staging-folder>` checks uploaded GitHub digests.
Add `--public` for anonymous descriptor/mod downloads and ZIP range checks.
Add `--live` to also check the deployed catalog through the existing launcher parser.
The report is saved to the staging folder as remote-verification.json.

The server migrates only an exact untouched previous catalog. Custom administrator
catalogs stay unchanged. Launcher release endpoints and other 14 games are retained.
