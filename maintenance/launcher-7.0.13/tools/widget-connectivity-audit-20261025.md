# Local widget connectivity audit - 2026-10-25

## Scope and authoritative paths

- Launcher source: `C:/Users/User/Desktop/MNG-TikTok-Game/launcher`, package version 7.0.1. Read `AGENTS.md` before changes.
- Server source: `D:/TikMnG-Release-7.0.0-source`; `overlay-relay.js` and tests inspected and exercised locally. No server source changes.
- Installed admin: `D:/TikMnG-Manager-7.0.0/win-unpacked/TikMnG.exe --tikmng-preview`. Read-only ASAR inspection reports package version **7.0.1**, despite the directory name. Its overlay bridge matches current source byte-for-byte; its main process lacks the new widget environment forwarding.
- Coordinated source ownership with catalog/UI chat `01a172ba-54c4-7853-a69f-1493e5487a8d`. No catalog, renderer, manifest, GameEngine or platform edits by this audit.
- Parent owns `minecraftOyunuAc`, Snake Java connect-session handling, `MNG_TIKTOK_USER` adapter environment, and the preview local archive handler. Those functions/files were not changed here. Existing Minecraft behavior is outside this fix.

No installed app, deployment, public directory, saved profile or live game state was modified. No GitHub, Drive, Render, release, public widget session, external gifts or messages were used. Tests use synthetic credentials and isolated local ports/profiles. No real bearer tokens are included here.

## Confirmed defect and narrow fix

The VS/Puanlama game's three legacy state proxies called the launcher at port 31975 without its installation key. The actual launcher HTTP handler rejects those reads with 403. The proxy previously piped that text error body into a downstream response whose status remained 200. The legacy widget client then failed JSON parsing. Preview additionally uses port 31976, so the hardcoded port could reach a different installation or nothing.

The regression reproduced the old failure using the real launcher handler and extracted original proxy code. Requests were redirected to an isolated fixture even before the fix, so no installed service was contacted.

Fix:

1. `main.js`, only `nodeBilgisiBul()`: all three runtime-selection branches forward the owning `MNG_WIDGET_PORT` and `MNG_WIDGET_ACCESS_KEY` to child processes, overriding inherited stale values.
2. `../apps/tiktok-vs/server.js`, only widget state proxy handlers: use that endpoint/key, preserve upstream error status, return JSON errors for offline/unconfigured service, bound requests to three seconds and 1 MiB, reject HTML or incompatible state schemas, and support both `/widget/.../state` and `/api/widget/.../state` aliases.
3. `tests/live-routing-regression.test.cjs`: repair missing `preview` VM context after the concurrent admin-game addition; add actual HTTP route/schema/artwork/account tests, legacy proxy regressions and stable/preview runtime-selection checks.

This is a source fix. The installed admin and existing installed game packages still contain their previous code. Packaging/installing is deliberately not performed.

## Link and route inventory

| Family | Routes/types | Transport and payload |
| --- | --- | --- |
| Launcher gallery, 13 types | `topgift`, `coinjar`, `topliker`, `topgifter`, `carousel`, `coindrop`, `timer`, `streambuddies`, `likefountain`, `userinfo`, `wheel`, `viewercount`, `tinydiny` | `topliker`/`topgifter` generated links use `/widget-leaderboard.html?type=...`; others use `/widget-overlay.html?type=...`. Protected local HTTP; public HTTPS through the publisher bridge. |
| Legacy launcher documents | `/widget-NAME.html`, `/widget/NAME`, `/widget/NAME.html`; NAME is `overlay`, `top-gift`, `top-likes`, `leaderboard`, `gift-feed`, `activity` | GET/HEAD; HTML plus JSON polling. |
| Combined state | `/widget/state`, `/api/widget/state` | `topGift`, `topGifters`, `topLikes`, `ranking`, `activities`, `stats`; `jarGifts` only populated for `type=coinjar`. |
| Legacy state | `/widget/NAME/state`, `/api/widget/NAME/state`; NAME is `top-gift`, `top-likes`, `leaderboard`, `activity` | Gift uses `{top,entries}`; the other consumers use `{entries}`. No separate gift-feed state route; it consumes activity state. |
| Widget assets | `/widget/gift-assets/<file>`, `/widget/vendor/matter.js`, `/widget/physical-jar.js`, `/assets/widgets/glass-gift-jar.png` | Images/physics scripts, scoped through `/overlays/<token>` on public URLs. |
| Shared and game media | `/tikmng/media`, `/tikmng/media/<uuid>`, `/tikmng/media/file/<uuid>`, `/tikmng/media/client.js`, `/tikmng/media/client.css`, `/tikmng/media/events`, `/tikmng/media/poll` | Global or `game=<id>` scope; local SSE, public polling, byte Range and HEAD support. Local library-preview `/library/...` routes are not in the public relay allowlist. |
| HTTPS publisher | `/api/overlay/session`, `/api/overlay/bridge`, `/overlays/<token>/...` | Session POST and authenticated publisher WSS; viewer routes are GET/HEAD only. The relay does not proxy arbitrary game WebSocket servers. |

Game-local links found in the Desktop source are a separate family:

| Game/source | Existing links | Upstream |
| --- | --- | --- |
| VS/Puanlama, port 3000 | `/widget.html`, `/widget-vs.html`, `/widget-vs-winners.html`; legacy `/widget-top-gift.html`, `/widget-top-likes.html`, `/widget-leaderboard.html` | Gameplay widgets use same-host WS; legacy three widgets poll the fixed state proxies above. |
| Orbit, port 3010 | `/widget.html`, `/winner-widget.html` | Same-host WS `leaderboard`/winner updates; avatar API. |
| Crowd Control, port 3020 | `/widget.html` | Same-host WS and avatar API. |
| Battle Game, port 3030 | `/army-widget.html`, `/tournament-widget.html` | Same-host WS `army-leaderboard` and `tournament-winners`. |
| Duck Hunt, port 3040 | `/widget.html?mode=survivors`, `?mode=victims` | Same-host WS and avatar API. |
| Pony Life, widget port 3051 when launched by launcher | `/widget.html?mode=ranking`, `?mode=winners`, `/widget.js`, `/widget.css` | Poll `/api/widget-state`, avatar API. Its optional tunnel is separate and was not started. |
| Penalty Kick, port 3070 | `/widget`, `/widget.html`, `/widget-keepers`, `/widget-teams` | Same-host WS `init-leaderboard`/`sync-leaderboard`. |
| Tightrope Balance, port 3080 | `/widget.html?side=...` or `?mode=...` | Same-host WS plus `/api/leaderboard` polling. |
| Other source-only widgets | `vip-painter/public/widget.html`, `sweet-kingdom/public/widget.html` | Separate game WS/API consumers; not demonstrated as active launcher entries. |

Frog River, Minecraft variants, Zombie War and Steam/Unturned widget behavior is not established by the file inventory above. Snake's two HTTPS widgets and native handshake remain parent-owned. Merely loading an HTML file cannot verify any of those gameplay transports.

## Executed verification

| Command (from launcher unless specified) | Result |
| --- | --- |
| `node --test tests/overlay-bridge.test.cjs tests/widget-relay-paths.test.cjs` | 87 passed, zero failures/skips. Includes 12 browser widget frames and six animated GIF physics-jar frames, root/relay paths, JSON updates, prefixed images, moving canvas pixels and no escaped public requests. |
| Server: `node --test tests/overlay-relay.test.js` with `OVERLAY_RELAY_PLAYWRIGHT=<bundled playwright>/index.mjs`, `BROWSER_EXECUTABLE=<installed Chrome>` | 21 passed, zero failures/skips. Includes browser source opened while publisher offline, automatic recovery and opaque-origin sandbox polling. |
| `MNG_RELAY_SOURCE=D:/TikMnG-Release-7.0.0-source node tools/qa-https-overlay.cjs` (environment set through PowerShell) | Eight checks passed: real local TLS/WSS, binary Range, denied writes, decoded MP4 playback, game/global isolation, all 13 widget types, stable address after reconnect and recent-gift recovery. |
| `node --test tests/live-routing-regression.test.cjs tests/media-studio.test.cjs tests/game-launch-session.test.cjs` | 146 passed, zero failures/skips. Includes actual generated widget HTTP links, both state aliases, PNG signature, key rejection, account isolation, normalized source events, malformed upstream payloads, upstream 403/offline errors, stable/preview endpoint selection, media scoping and game handoffs. |
| `node --check main.js`; `node --check ../apps/tiktok-vs/server.js` | Both passed. |

The initial relay-browser command pointed the ESM import at a directory; it was corrected to `index.mjs` and both browser cases passed. This was a test invocation issue.

`node tools/qa-widgets-v2.cjs` stopped at its first transparency assertion: it opens `preview=1` but expects a transparent body. Current `overlay.html` explicitly assigns black to preview bodies. This is an outdated QA expectation, not evidence that non-preview OBS sources are black. Its remaining layout checks were not completed; no renderer change was made.

## Limits and remaining findings

- This audit confirms a real legacy state-proxy defect, not the cause of every reported missing widget.
- No real TikTok live gifts, actual LIVE Studio/OBS acceptance, game-generated WS payloads or installed game widgets were exercised. Local WS handoff fixtures test account transport, not gameplay widget content.
- Direct game widgets need their own running game server and its expected WS/API schema. They cannot be made HTTPS-compatible by adding their HTML path to the launcher's HTTP relay allowlist alone.
- Several old game event-post helpers still target fixed 31975. They were observed but not broadly rewritten; their preview/stable event routing requires a separate coordinated audit. The centralized launcher live connection has its own event path.
- The parent-reported native connect-session ownership issue is not covered by the 13 launcher-widget tests. Java/adapter/native handshake verification must be reported separately by the parent.
- No public health or authenticated public widget requests were made. Live widget availability remains unverified.

Changed files owned by this audit: launcher `main.js` (`nodeBilgisiBul` only), game `apps/tiktok-vs/server.js` (three state proxies only), launcher `tests/live-routing-regression.test.cjs`, and this report. Other concurrent catalog/UI/native changes belong to their respective owners.
