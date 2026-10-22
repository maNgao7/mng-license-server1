# Independent routing QA - 2026-10-22

Delivery verdict: **adapter fixes complete; all scoped regression and browser checks pass**. The ten originally reported failures are resolved by targeted edits to `main.js` live/widget adapters and `lib/live-session.cjs`. Parent fan-club extraction and current gift defaults are preserved. Actual gift-to-Live-Studio playback remains unverified.

## Evidence and scope

- New runner: `tools/qa-all-connections.cjs`.
- New contracts: `tests/live-routing-regression.test.cjs`.
- Latest post-fix run: 2026-10-22 19:41:31-19:42:13 UTC (22:41-22:42 Istanbul).
- [Post-fix results and source hashes](D:/TikMnG-QA-Delivery/routing-2026-10-22T19-41-31-245Z/routing-result.json).
- [Original failing regression results](D:/TikMnG-QA-Delivery/routing-2026-10-22T19-33-03-420Z/routing-result.json).
- [Real-room observation and initial audit](D:/TikMnG-QA-Delivery/routing-2026-10-22T19-30-53-675Z/routing-result.json).
- Post-fix verification used `--skip-live`, preserving the separate pre-fix real-room observation. No installed launcher or game was opened. No real gifts, chat messages, follows, license changes, saved mappings, commits or deployments were sent.
- VM fixtures execute actual functions extracted from `main.js`, with an in-memory store, real platform/media services, and a fake SDK transport. Game handoff fixtures use real HTTP/WebSocket transports on random loopback ports. They do not execute game engines.
- Source hashes before and after each completed audit were unchanged. Parent fan-club updates were present in the latest tested snapshot.

## Original defects, now fixed

| Priority | Location | Concrete regression |
| --- | --- | --- |
| P1 | `main.js` direct `onEvent` callback, around line 506 | Connector 2.4.4 emits chat text in `content`; the callback uses only `comment`/`message`. A non-empty SDK-shaped question becomes an empty string. `common.msgId` is also absent from its normalized event ID. |
| P1 | `lib/live-session.cjs:165` | Actual v3 streak type is `gift.type`; only flat `giftType`, `giftDetails.giftType` and `extendedGiftInfo.giftType` are checked. A progress event with `repeatEnd=0`, count 3 and `gift.type=1` incorrectly adds 3 coins before the final event. |
| P1 | `main.js:462` | Actual v3 `user.displayId` is ignored. A viewer handle becomes its display nickname; normalized `{username, avatar}` inputs also lose identity/avatar. Shared nicknames can merge viewer records and misapply per-viewer eligibility. |
| P1 | `main.js` direct callback and `widgetOlayParmakIzi`, around lines 363/506 | Two legitimate SDK v3 like batches with different `common.msgId` and count 7 collapse to the same fallback fingerprint. Expected 14 likes; actual 7. A repeated second ID is part of the fixture to require both deduplication and acceptance of genuinely distinct batches. |
| P2 | `main.js` viewer callback, around line 510 | Actual v3 `roomUser.total='42'` is ignored; the widget shows 0. `totalUser` is a different cumulative field and must not replace current count. |
| P2 | `main.js:372`, account switching | Recent fingerprints are shared across accounts. A legitimate room-local event ID used in account B immediately after account A is suppressed; B remains at 0 coins. |
| P2 | `main.js:372` | Replaying a gift event ID after 3 seconds doubles widget coins from 2 to 4, although media deduplication keeps one playback. Counters and effects disagree about the same replayed event. |
| P2 | `main.js:216` | Artwork lookup combines ID/name with OR inside `find`. `{giftId:'6064', giftName:'G\u00fcl'}` selects earlier rose artwork `5655.png` instead of GG `6064.png`. Exact ID must take precedence over conflicting/localized names. |

The table describes the original failures; all now pass. Direct callbacks read `content`, `common.msgId` and `total`; profile normalization retains `displayId` and normalized avatar/username. Streak progress with nested `gift.type` is suppressed before delivery. Fingerprints include the account, retain identified events for five minutes with a 4096-entry bound, and keep a short debounce for ID-less compatibility events. Artwork resolves exact ID before falling back to names. SDK field shapes came from the installed connector and `tiktok-live-proto/dist/node/v3.d.ts`, not private TikFinity/TikOyun code.

SHA-256 values below are identical before/after the passing audit and match the files re-read for this handoff:

| File | SHA-256 |
| --- | --- |
| `main.js` | `d332cb63543e983d6f4a30d3960dec2977f7308975065a304b7794e646fb5343` |
| `lib/live-session.cjs` | `14e350be1f7a40005fdad3966e57dafaddd85012611d682aaab711d4d68b0bd1` |
| `tests/live-routing-regression.test.cjs` | `e319615521cec69bff964c0e2039bc0c47d853696c09bbb25f4e00c7ef040e85` |

## Verified synthetic results

| Check | Result | Meaning |
| --- | --- | --- |
| New routing suite | **32/32 pass** | All ten original reported failures, including profile child cases, now pass. |
| Existing contract suites | **328/328 pass** | Live-session lifecycle, platform, launch session, game handoff, overlay bridge, optional local TikFinity packet interface, media, audience and top-gift contracts. |
| HTTPS overlay QA | **PASS** | Isolated HTTPS/WSS publisher, Range bytes, synthetic gift to decoded MP4, global/game separation, all 13 widget pages, stable address on reconnect, outage recovery. This uses a local test certificate and synthetic relay credentials. |
| Widget relay tests | **2/2 pass** | Actual browser widget frames and animated gift-jar assets use the relay prefix; no public request leaks the local key. |
| Workspace QA | **PASS** | Visual gift picker ordering/pagination, actual `7934` selection, distinct explicit synthetic voice URIs with `natural`, AAC audio decoding on hover and stop on leave, no fake style dropdown, layout at four widths. It does not prove natural voice quality. |
| Fan-club profile to platform | **PASS** | Real profile helper calls `extractFanClubLevel` through the real require path. Level 4 reaches platform ingest and the accepted chat. Missing metadata, inactive status and account switching do not reuse the grant. Eligibility and v3 chat text mapping have separate passing regressions. |

Parent reports **647 full-suite tests passed**. That broader total was communicated by the parent; the independently captured counts for this audit are the rows above. Parent owns packaged runtime/voice acceptance, final package download/build and preview delivery.

All 14 game IDs receive separate media routes. An ID-5655 gift carrying the name "Beni Sev" does not trigger a 7934 mapping; an actual ID-7934 gift does, only for the active game. Saved mapping changes are confined to in-memory fixtures.

| Games | Tested boundary |
| --- | --- |
| `vs`, `puanlama`, `orbit`, `crowd-control`, `battle-game`, `duck-hunt`, `penalty-kick` | Correct game-specific connect frame delivered over an isolated real WebSocket. |
| `pony-life` | Session fetch, authentication frame, then connect frame on `/live`. |
| `frog-river` | Session fetch and authenticated HTTP `/api/connect` payload. |
| `tightrope-balance` | HTTP `/api/connect` payload flushed without waiting for an external TikTok handshake. |
| `battle-royale`, `snow-war`, `zombie-war` | HTTP `/connect` using supplied dynamic loopback port and session identifier. |
| `gelene-gecene` | Per-game media routing and existing mocked Steam launch/lifecycle contracts. No actual Steam/Unturned session was started. |

The 13 widget IDs checked are `likefountain`, `userinfo`, `topgift`, `carousel`, `wheel`, `topgifter`, `topliker`, `coindrop`, `timer`, `viewercount`, `streambuddies`, `coinjar`, `tinydiny`. Their shared state handles normalized gift, like, follow, share, subscription and viewer fixtures. Both the previously failing live normalization contracts and the isolated rendering checks now pass.

## Real network observation

`@mlbb_gossipgirl` was observed read-only at 19:30:53.741-19:31:22.254 UTC (22:30:53-22:31:22 Istanbul) for 28.5 seconds. Room ID validity and WebSocket connection were verified. The application session received 11 chat, 10 member, 10 like, 13 viewer and 1 follow events. No gift occurred in this window. No event was injected into a real game, widget profile or saved media mapping. This observation preceded the adapter fixes; the fixed adapters were subsequently verified with synthetic SDK-shaped events, without another live observation.

The earlier separate delivery observation at 18:02 UTC recorded gifts, but it is not substituted for this run or counted as real gift-to-game validation.

The public service returned HTTP 200 with normal TLS verification for `/api/health`, `/api/overlay/health`, `/api/version` and `/api/content/catalog`. Overlay health reported `available=true`, protocol 1. Health checks are point-in-time reachability, not sustained availability or authorization/playback proof.

## Gift catalog

Read-only catalog audit found **686 unique numeric IDs, 686 present image files, and 686 successfully decoded browser images**. No duplicate IDs, missing files, invalid coin integers or image-path/filename-ID mismatches were found. Thirty display labels occur under multiple IDs; this makes name-based matching unsafe, but duplicate labels are not themselves a catalog failure.

| ID | Catalog gift | Coins |
| --- | --- | --- |
| 5655 | Rose / Gul | 1 |
| 6064 | GG | 1 |
| 7934 | Beni Sev | 1 |
| 5319 | Blue Bead | 5 |
| 5879 | Donat | 30 |
| 5303 | Tea / Cay | 50 |
| 7168 | Para Tabancasi | 500 |
| 11046 | Galaksi | 1000 |

Raw JSON order is not coin ascending. The current visual picker sorts at render time; the workspace audit verified all 686 entries in pages of at most 60. Catalog labels and prices are bundled metadata, not a fresh authoritative TikTok regional-price guarantee.

## Remaining acceptance work

- Scoped adapter implementation and regression rerun are complete. Parent's remaining work is package download/build and preview delivery.
- Real gift-to-action behavior inside each installed game engine remains untested: **0/14 actual game runtimes launched** by this audit.
- Acceptance by TikTok Live Studio/OBS UI and playback from the user's saved production HTTPS source URLs remain unverified. Isolated HTTPS browser playback passed.
- Actual natural-speaker diversity, audible hardware output and real fan-club events are not established by synthetic voice/eligibility fixtures.
- The optional local TikFinity bridge's documented packet boundary is tested with fixtures; no installed TikFinity session or private API was used. No private-source copying is needed or claimed.
- No update was committed, published or deployed.
