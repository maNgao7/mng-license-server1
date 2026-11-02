# Yaratik Arena 0.1.22

Game-only hotfix for TikMnG 7.0.15. Launcher latest remains 7.0.15.

- The game bootstrap retains the original process handle through launcher exit,
  so normal game shutdown does not try to observe an exited process through a
  newly acquired handle or report that the process was not started by this object.
- The connection menu has separate Baglan and Kes controls.
- Automatic connection uses the username last saved inside the game. An
  environment-provided username does not replace it. First installation starts
  with a blank username.

## Catalog Migration

The complete Arena 0.1.21 rev12 catalog is preserved byte-for-byte in
`content-bootstrap-arena-0.1.21.json`. The earlier 7.0.15 rev11 snapshot remains
in `content-bootstrap-7.0.15.json` for the previous hotfix migration.

Only an exact match of both the stored draft and published rev12 catalog migrates
to rev13. Only Arena's version, archive URL, SHA-256, and byte size change, along
with catalog revision and publication timestamp. Administrator changes in either
catalog prevent replacement. All other game descriptors, media, launcher
metadata, and license data remain unchanged.

Game archive:
https://github.com/maNgao7/mng-license-server1/releases/download/yaratik-arena-0.1.22/yaratik-arena.zip

## Integration Status

Final metadata comes from Main's descriptor at
`D:/TikMnG-Yaratik-Arena-0.1.22-release/package-descriptor.json` and has been
independently checked against the local ZIP:

- Version: `0.1.22`
- Bytes: `151510221`
- SHA-256: `525a243d494d3e0fa4efd03009020d777d414ea3a6183c57c5c251f1754203b6`

The rev13 catalog contains these verified values. Its publication timestamp uses
the final descriptor's filesystem modification time in UTC.

265 rules checks, 13 .NET Framework process-exit checks and all 137 server tests
passed. The packaged native game opened and closed normally three times with
exit code zero and no startup warning. The native connection checks cover both
800x600 and 1280x720, account switching, invalid input, manual disconnect, restart
persistence and unchanged custom actions. A clean installation kept its account
empty despite the launcher supplying an account. Updating 0.1.21 preserved
settings and recopied zero bytes of the cached Steam game.

The previous gameplay fixes are unchanged. No paid gifts were sent during these
checks. Evidence: `maintenance/yaratik-arena-0.1.22/VERIFICATION.json`.

Only the game requires updating; launcher latest stays 7.0.15. There is no need
to replace the Drive installer or reinstall the Steam demo. Existing users can
enter their desired account once in B > Yayin ve test and press Baglan; the game
then retains that selection independently of the launcher account.

## Catalog Verification

Unfiltered Node tests across all nine server test files: 137 passed, zero failed,
zero skipped. Browser tests were enabled with bundled Playwright and installed
Chrome. Portal screenshots were redirected to a temporary directory at runtime;
the existing source QA screenshots were verified unchanged.

Coverage includes exact rev12-to-rev13 migration, retained rev11 migration,
immutable historical 0.1.21 expectations, full backup retention, restart
idempotence, administrator draft/published preservation for both baselines,
unchanged other games and media, and launcher latest remaining 7.0.15.
