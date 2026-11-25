# Teke Tek Profil 0.5.8 — technical notes

Prepared on 25 November 2026 for the game-only 0.5.8 update. Launcher 7.0.36 stays unchanged. Catalog metadata points to the separately versioned game archive; Render deployment belongs to the user.

## Full-window player picker

The keyed preview iframe carries an explicit data-profile-editor marker. Its picker dialog is mounted in that same-origin control document so it is no longer clipped by the 250px preview. The selection controls and API requests retain their existing owner and control key. Standalone keyed widgets keep their local dialog; public broadcast views have no picker.

The left/right dialog is aligned to the corresponding viewport edge, uses nearly the full height, and on wide desktops fits the free space beside the 1180px control column. It adapts to smaller windows. Search and tabs stay fixed above an independently scrolling profile grid. Pagination (40 per batch), disabled duplicate selections, stable rows, avatar retry, Escape/close focus return and running-round locks are preserved. Cleanup removes the parent dialog when the preview unloads.

## Compact widget

- Retains the existing compact work: transparent stage up to 448 × 236 px, square portraits up to 156 px, gifts up to 28 px, and a 250 px control preview.
- Names and the empty-slot selection caption sit 4 px below each portrait. In the keyed preview, the transparent selection button covers both portrait and caption, with a visible keyboard focus outline. Its duplicate text over the portrait is hidden. The copied widget has no editing controls.
- Left is red (`#ef4b57`), right is green (`#39d887`). The shared score rail aligns with the outer portrait edges and its split follows the existing score ratio.
- The clock occupies the gap between profiles. Paused text is centered above the frozen clock. The leading segment has a small 10 × 13 px CSS flame near the split; ties, paused rounds and results hide it. Reduced motion keeps the flame static and disables split transitions.
- Existing victory animation, winner retention, draw behavior, profile cache retries and gift rendering remain in place.

## Duration editing

`web/duration-control.mjs` is shared by the local preview and launcher control pages. The Saniye/Dakika selector converts the entered value to whole `durationSeconds` before either start request. Changing units preserves the same duration: 120 seconds becomes 2 minutes; 1.5 minutes becomes 90 seconds. Decimal minutes round to the nearest second. The existing range is 10–3600 seconds (up to 60 minutes), including the 10-second boundary expressed as minutes. Empty and invalid edits cannot start a round.

Snapshots refresh the editor when the configured duration changes, while repeated snapshots preserve an edit for the next round. Both APIs and the snapshot schema continue to use seconds. A unit switch preserves an empty field.

## Existing live integration and storage

| Concern | Existing contract |
| --- | --- |
| Connection owner | The host launcher supplies `subscribeSharedEvents`; the game opens no second TikTok connection. |
| Live source | `createLauncherServer` accepts `(type, payload, metadata)` only for `metadata.source === 'live'` and the selected normalized `metadata.channel`. |
| Gift normalization | `src/launcher-adapter.mjs` supplies event identity, gift identity, completion, repeat and coin metadata to the existing core scoring. |
| Event identity | `eventId`, `id`, `msgId`, `common.msgId`, or the existing completed-series/group fallback. Deduplication is kept per channel within the game session, including reconnects and round resets. |
| Public state | Existing schema 1 from `src/core.mjs`; duration remains `durationSeconds`, remaining time is milliseconds. |
| Profiles | Separate username/nickname and best available portrait from the host's shared `widgetPortraits` cache. Cache path: `userData/widget-portraits-v1`. Game portrait endpoint: `/api/portrait?username=…`. |
| Gift settings | Optional host `onGiftConfig` persistence and `giftConfig` restoration; host setting key `profile_duel_gifts_v1`. |
| Game records | This package creates no account credential, portrait cache, ranking or winner-record files. The host owns existing persistent data. |
| Control access | Existing keyed `/control` and `/api/live/*`; copied `/widget` address omits the control key. |

`src/core.mjs`, `src/launcher-adapter.mjs`, `src/server.mjs` and `src/launcher-entry.mjs` were not edited for this completion. No scoring, replay, event or server schema changes were required. The package, lockfile and game-owned `launcher-widget.json` carry version 0.5.8; entry paths are unchanged.

## Packaging and validation

`profile-duel.zip` has the game files at archive root: `src/`, `web/`, `package.json`, `package-lock.json`, `launcher-widget.json`, `README.md`, this note and `TEST-REPORT-0.5.8.md`. Runtime code uses Node built-ins and needs no production dependencies. `node_modules`, tests, QA artifacts, logs, personal portraits, participant data and settings are excluded through an explicit file allowlist.

See [TEST-REPORT-0.5.8.md](TEST-REPORT-0.5.8.md) for completed local checks and their limits. Real TikTok gift delivery and live portrait quality were not observed in this task. The browser tests use local fixtures and a shared-feed-shaped synthetic event source; they do not establish a live connection.
