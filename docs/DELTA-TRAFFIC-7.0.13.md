# Low-traffic widget protocol, 7.0.13

Clients opt in using `transport=changes&patch=1`. First load receives a full
snapshot and an exact state token. Later responses may contain only structured
set/delete/keyed-row operations against that exact token. Unchanged state uses a
bodyless 204. Scopes retain channel, read key, widget type, screen, game, mode,
preview and requested visible-row count. Event cursor/history transitions may
reuse the exact prior body, not a different account or widget.

The publisher keeps at most 128 serialized snapshots / 8 MiB, with a 90-second
TTL and 512 KiB snapshot limit. Evicted or mismatched bases use full snapshots.
The browser attempts one full resync after an invalid patch. Legacy clients and
publishers retain the previous protocol. Actual broadcasts continue when hidden;
gallery previews suspend. Licensing and personal media policies are unchanged.

Synthetic loopback HTTP + WebSocket relay + Chrome comparison, same 39 frames:

| Mode | HTTP response body bytes |
|---|---:|
| Full identical payloads | 2,126,993 |
| Gzip only | 422,989 |
| Gzip plus delta | 72,320 |

This workload saved 96.60% versus the full-body reference and 82.90% versus gzip
alone. These are response-body measurements, not production invoice guarantees.
HTTP/TLS/TCP headers are excluded. All 173 synthetic activity IDs arrived exactly
once; old history rotated out without losing delivered gifts. Real Chrome tested
reset, reconnect, invalid base/operations, dropped responses, nine visible rows,
unchanged avatar elements, desktop/mobile fit and explicit zero PK scores.

Game widgets retain existing portrait DOM on score/rank changes and request only
their 30 displayed rows. A transient portrait error uses bounded retry backoff
instead of redownloading on every score update. Original image bytes are retained.

## Rollout

1. Publish the verified 7.0.13 launcher files to GitHub; Drive is a backup only.
2. Deploy the release commit on Render. No billing plan or card change is needed.
3. Existing users apply the normal launcher update without uninstalling.
4. Refresh open Live Studio/OBS browser sources once; URLs stay the same.
5. Inspect authenticated `/api/admin/http-traffic` after a representative session.
   `stateWidgets` distinguishes snapshot, changes and delta clients without
   recording tokens, channels, usernames, IPs or messages. Restart resets counters.

Sources left open on old HTML/launchers cannot receive the full delta savings
until refreshed/updated. Prior accrued transfer is not erased by the update.
