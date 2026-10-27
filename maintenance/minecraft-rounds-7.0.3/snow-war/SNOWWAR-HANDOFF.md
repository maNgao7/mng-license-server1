# SnowWar Local Preview Handoff

Only `apps/snow-war` was edited. Shared launcher, Snake, PUBG, installed mods,
and external services were not changed. The parent owns the local package on D:.

## Artifact And Build

- Final source artifact: `C:\Users\User\Desktop\MNG-TikTok-Game\apps\snow-war\mod\build\libs\mng_snow_war-1.0.0.jar`.
- Existing package mod, left untouched: `C:\Users\User\Desktop\MNG-TikTok-Game\apps\snow-war\prototype\game-instance\mods\mng-snow-war-1.0.0.jar`.
- Preserve the existing hyphenated package filename when replacing its contents.
- Final clean JAR SHA-256: `C0EF93566BE6B198DB657679642197EB750F101297511BE0E6EE9AA02BBB8629`.
- Final clean JAR size: 74,936,697 bytes.
- Offline build: `powershell -ExecutionPolicy Bypass -File .\tools\build-mod.ps1` from this app directory.
- Equivalent from `mod`: `.\gradlew.bat --offline --no-daemon clean regressionTest build`.
- Native round QA from `mod`: `.\gradlew.bat --offline --no-daemon runClient -ProundSmoke`.
- Native QA uses `mod/run`, with its own save and config, and never writes into the prototype instance.
- The native QA property is opt-in and defaults off in packaged games.
- Resource verification: `.\tools\verify-mod-jar.ps1` from this app directory; use
  `-JarPath <package-jar>` to verify the parent's renamed JAR against this source.

## Controls And Behavior

| Control | Result |
| --- | --- |
| P | Start every waiting round with a 10-second center countdown. Press again to pause preparation/combat/final; press again to resume the same round. |
| B, Start battle | Same start command and countdown as P. |
| B, Stop battle | Freeze the round, combatant movement, damage, throws and start/winner countdowns. Only the host moves; P resumes it. |
| E | Follow the live arena participant directly under the crosshair, in native third person from behind. E again restores the prior player camera and perspective. |
| TAB | Existing first/third-person camera toggle. |
| Double Space | Existing flight toggle. |
| Left mouse | Throw a snowball. |
| Right mouse, wheel | Existing zoom and zoom adjustment while held. |

E takes priority over vanilla inventory while gameplay has focus; inventory can
be rebound in Minecraft controls. P consumes vanilla social-interactions input.
Chat/settings text entry is unaffected. A center crosshair is retained in third person.

E uses the rendered camera ray, block collision clipping, and nearest exact AABB
intersection. Dead, removed, audience, nonparticipant, and outside-arena entities
are excluded. Target loss/death, world change, player respawn/death, or replacement
of the camera safely detaches. The follow feature changes only the client camera;
it does not teleport/control the player or mutate TikTok events, actions or identities.

Initial login, sole entrants, 4/5/300 joins and a completed round never start combat.
A winner countdown requires a running battle that has observed two rival teams.
The existing winner-delay setting is preserved, with its default of 10 seconds.
Winner/reset clears combatants and transient round effects, then waits for P again.

## 2026-10-27 Game-Only Candidate

- Current candidate supersedes the older JAR hash above; see package-report.json
  in D:\TikMnG-Minecraft-Oyun-Guncellemesi-7.0.3 for final artifact hashes.
- P now toggles pause/resume through the server command `snowwar toggle`.
- New rivals cancel the final countdown through both join paths.
- Offensive gifts received while waiting/paused are queued for active combat.
- Winner has a larger animated circular profile and the Orbit winner sound;
  final candidates preload their profile. Normal HUD is hidden during victory.
- Vanilla tutorial steps and toast notifications are suppressed throughout play,
  including while settings are open. Game-specific overlays remain enabled.
- Native pause evidence: reference/snowwar-pause-native-20261027.log.
- `-PpauseSmoke` and `-PwinnerSmoke` are opt-in; normal game launches never run them.
- Game catalog/PNG resource count is now 905, not the historical 797 below.
- Prepared only; launcher, installed games and the public catalog are unchanged.

## Packaging

No additional nonpersonal `game-instance` directory is required beyond the parent's
allowlist: `mods`, `defaultconfigs`, `resourcepacks`, `tacz`. Assets/audio/gift images
are embedded in the mod JAR. Keep the prototype runtime/profile and bridge outside
the instance in their existing relative layout.

Do not ship personal `saves`, `config`, `options.txt`, user caches, logs,
crash reports or launch argument files. The game generates fresh defaults and a
new arena. A pre-existing nullable-floor unboxing error was fixed so first boot
works without shipping a saved world. Existing saves follow the same arena path.

## Verification

- Offline regression suite covers waiting 0/1/4/5/300, full P countdown, repeated P,
  pause/resume, real-contest eligibility, reset and repeated next-round countdowns.
- Camera regressions cover exact ray/AABB nearest hit, off-ray/behind/dead/audience
  filtering, wall-clipped rays, target removal/death, recycled entity IDs, session
  changes, saved perspectives and idempotent cleanup.
- Native engine suite passed every check, including 300 native joins, paused start
  and winner timers, solo no-win, contested 10-second winner/reset and next-round P.
- Final native camera QA verified third-person attachment, E exit to the previous
  camera, and automatic return to the player when the target died.
- Fresh boot generated the arena without a packaged save. Its temporary QA worlds
  were moved to `D:\MNG-SnowWar-QA-20261025` after closing the development client.
- Native evidence is preserved in `reference/snowwar-native-qa-20261025.log`, with
  `MNG_ROUND_SMOKE_RESULT` reporting all checks true.
- Final artifact rebuilt with `clean regressionTest build --offline`, then verified:
  catalog exactly 797 and byte-identical to source, canonical gift PNGs exactly 797,
  all 1,488 packaged PNG paths match source, zero obsolete or missing PNGs.
