# TikMnG 6.5.17 Private Preview

This is a local test build, not a published stable update.

## Verified

- Fourteen distinct concept-based game covers, including the five replacements.
- Original TikMnG charcoal/turquoise identity with desktop navigation on the right.
- Installed-first game library, search, categories, detail pages, install/play.
- All fourteen existing package download addresses return HTTP 200; six known
  package lengths match their published metadata.
- Real Crowd Control package download, installation, game window and canvas.
- Protected local video URLs, real MP4 decoding, gift picker, mapping persistence,
  exact gift-ID-triggered playback and volume settings.
- Local archive: 159 files with original titles/categories, separate preview copy.
- Bundled gift catalog: 686 entries, usable without installing the VS game.
- Separate preview configuration/media/game roots and disabled stable updater.
- Responsive UI checks at 1920, 1440, 960 and 390 pixels.
- Game-specific gift/media actions with independent protected overlay links.
- Drag and numeric trim editing, actual clip preview, queue/interrupt, playback
  limits, fade and image/GIF support. Existing global mappings remain intact.
- Username/license entry: server validation still required, account saved and
  connection attempted only after successful activation. Three responsive widths.
- Five system-voice profiles; actual base voices depend on Windows installation.
- TTS eligibility: selected gift or follow events observed during this session,
  with account/channel isolation. Historic follower lists are not available.
- Unified launcher launch indicator; readiness waits and owned-process cleanup
  tested with mocked windows/children for every current game family.
- Independent game update regression: only one selected package is downloaded;
  the second game's executable, settings and active pointer stay byte-identical,
  including after recreating the launcher library.
- Shared account handoff uses each owned game's actual HTTP/WebSocket protocol;
  native bridge ports are read from that launch's arguments, never guessed.
- Current automated suite: 213 checks; widget browser QA: 13 types / 39 layouts;
  actual media browser QA: seven playback scenarios. Public live gifts and clean
  second-machine acceptance remain unverified, not implied by these tests.

## Still Requires Acceptance

- Live TikTok connection with the user's currently broadcasting account and a
  genuinely received gift. Synthetic integration tests are not a live gift test.
- Publisher verification of each game on their broadcast/OBS setup.
- Full download/launch acceptance of every large game on a clean second machine.
- User approval of artwork and the final library layout.

## Local Locations

- Desktop shortcut: TikMnG Test Launcher.
- App: D:/TikMnG-Test-6.5.17/win-unpacked/TikMnG Test.exe.
- Preview data: %APPDATA%/TikMnG-Test-6.5.17.
- Preview media: D:/TikMnG-Test-Medya.
- QA evidence: D:/TikMnG-Launcher-Test-Raporu.

Do not publish this build as a stable release or upload private profile data.
