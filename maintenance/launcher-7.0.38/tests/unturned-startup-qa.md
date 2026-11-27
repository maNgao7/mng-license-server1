# Unturned readiness integration and verification

Replace the current `session.stage(...shell.openExternal('steam://run/304930'))`
and immediate ready message in the Gelene Geçene branch with:

```js
await require('./lib/unturned-startup.cjs').launchUnturned({
    session,
    directory: unturnedKlasoruBul(),
    openExternal: url => shell.openExternal(url)
});
session.markReady('Gelene Geçene oyun penceresi doğrulandı.');
```

The helper owns its 120-second startup stage. Do not wrap it in a shorter stage.
The discovered absolute installation directory is required; C:, E:, custom Steam
libraries and UNC paths are accepted. Every process query filters by the exact
installation executable. The helper writes no settings or game files.

Preflight refuses a pre-existing game without adopting, closing or relaunching
it. Concurrent requests in the same session share one launch. A launch nonce is
preferred; Steam versions that omit it use an empty preflight plus exactly one
exact-path process created after dispatch. A foreign nonempty nonce, an older
process or multiple candidates fails verification. Once captured, PID, executable,
native start ticks and observed nonce guard cleanup, including PID reuse.
An unobserved nonce-free late Steam launch is never guessed or killed.

The helper returns actual process/window evidence, not world or LIVE readiness.
It monitors process exit and closes the existing GameLaunchSession, so the
session's bridge cleanup stays in the existing lifecycle. No second bridge or
LIVE connection is created by this module. Cleanup errors remain visible.

## Verified on 2026-11-16

- Focused automatic tests passed, including real disposable Windows GUI
  executables, another installation, window discovery, wrong-token/start-time
  cleanup refusal, cancellation, early exit, PID reuse, timeouts, duplicate
  requests, C:/custom E: installations and the nonce-free fallback.
- `tests/release-gate.ps1` completed with exit code 0 after the path/fallback fix.
- Real installed Steam launch: preflight found zero Unturned processes. Steam
  displayed its launch-option chooser. The standard option offered optional new
  BattlEye installation, which was declined without remembering a preference.
  The existing Unturned game then opened normally.
- Actual executable: `D:/SteamLibrary/steamapps/common/Unturned/Unturned.exe`.
  Owned PID: **21136**. Window handle: **1247516**. Process/window verification
  completed after **93,469 ms**, including the Steam/BattlEye dialogs.
- Steam did **not** propagate the nonce to the OS command line. The verified
  `path-and-start-time` fallback was therefore exercised by the real game.
- The actual native mod settings screen was visually observed, including its
  game-start control. A second helper call returned the same process; the Steam
  dispatch count stayed at **1**.
- Only that owned PID was closed. Final process count: **0**; cleanup error:
  **null**; smoke-test exit code: **0**. The game window was also observed gone.
- No test gifts/messages were sent. The test did not edit settings/configuration,
  inspect credentials or user files, start the bridge, or modify installed mod
  files. Normal diagnostics written by the authorized game launch were allowed.
  No LIVE-event delivery, gameplay round or audio claim follows from this check.
- `main.js` was not edited. Hookup, final packaging and delivery belong to main.

## Optional manual replay

```powershell
node tests/unturned-steam-qa.cjs --launch-steam '<discovered absolute directory>'
```

This opt-in script is excluded from release-gate automation. It uses an isolated
in-memory GameLaunchSession, refuses an already-running game, allows 120 seconds
for startup and automatically closes its verified owned PID 30 seconds after
readiness. It reads no interactive input and sends no synthetic events.
