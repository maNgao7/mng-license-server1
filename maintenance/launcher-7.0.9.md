# TikMnG 7.0.9 Publication

Approved public release, 2026-10-30. No license database, signing key, device
binding, payment setting or existing publisher configuration is changed.

- Stable launcher: https://github.com/maNgao7/mng-license-server1/releases/tag/v7.0.9
- Shared game components: https://github.com/maNgao7/mng-license-server1/releases/tag/game-components-7.0.9
- Installer SHA256: e779f467bb4ee4cda60ac4e699c28df3bb7ce398df6dba60881cda9ad0dba408
- Installer bytes: 254573642. All five launcher assets match GitHub SHA256
  digests. Public latest.yml, manifest and installer HEAD checks passed.
- All nine component assets match local and GitHub digests. Public URLs and
  descriptor bodies were verified before enabling content-components.json.
- Capability-gated catalog: old clients retain compatible full packages. Only
  shared-runtime-v2 clients receive PUBG 7.0.5, Snow 7.0.5, Snake 0.17.0 and
  Zombie War 6.5.18. A newer administrator publication is never overwritten.
- Common engine downloads once; compressed game payloads are separate archives.
  Each extracted file is integrity checked. Saved settings and game data remain
  separate. TLauncher is not required. First installation includes the engine.
- 987 launcher regression cases passed, zero failures or skips. Final stable
  packaged UI, in-place profile preservation and differential reconstruction
  passed. 76 server tests passed, including browser forms and relay checks.
- Four actual native game launches passed. Snow host immunity and Snake floor
  removal, falling, pause and reset passed. Snake edge steering passed all eight
  headings without teleporting. Fresh Snake install through packaged IPC passed.
- Existing administrator preview was updated, preserving 990 media records,
  entry rules, license configuration and library path. No extra desktop app.
- Relay only allows private caching of revision-scoped owned media and explicit
  immutable gift artwork. Errors, HTML, state and live events remain uncached.
- Real browser replay test transferred a video once across three plays. Monthly
  bandwidth savings and zero stutter on every computer are not guaranteed.
- Actual four-host PK remains an external live test limitation; official team
  fixtures and real 1v1 traffic passed. Missing fan-club data is not guessed.

Creature Arena and Profile Contest prototypes remain paused and excluded.
Rollback: revert this deployment to the preceding server commit. Old catalogs,
full game releases and v7.0.8 remain available; never delete publisher data.
