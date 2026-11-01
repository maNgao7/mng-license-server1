# State response bandwidth hotfix

This is a server-only compatibility update. It does not change launcher release
metadata, licenses, public source URLs, user settings or game packages.

Successful JSON widget state responses are gzip-compressed when the browser
accepts gzip and the original body is at least 1 KiB (or chunked with unknown
length). Compression is per request. No shared or public cache of live state is
introduced. Small bodies, HEAD, 204, errors, byte ranges, images, video and SSE
are left unchanged. Existing clients decompress through their normal HTTP stack.

The authenticated HTTP meter additionally groups state bytes by a fixed allowlist
of widget names and snapshot/changes transport. Tokens, channels, usernames,
messages, IPs and arbitrary query values are not retained.

## Verification

Run `node tools/qa-state-wire.mjs` for a localhost WebSocket relay and actual Chrome
check. Forty synthetic changing leaderboard samples transferred 1,306,640 bytes
without compression and 352,301 bytes with gzip: 73.04% fewer HTTP body bytes.
Decoded JSON was byte-identical, the score was visible in Chrome, original media
was unchanged, and the slowest gzip response in this run was 5 ms.

This is one synthetic workload, not a guaranteed production or invoice reduction.
Existing uncompressed traffic has already accrued and cannot be removed.

The full server suite passed 89 tests with zero failures and zero skips, including
browser form tests, source reconnection, media ranges, private portrait cache,
license enforcement, cancellation, flow control, stalled gzip output and malformed publisher frames.

After deployment, record `/api/admin/http-traffic` again. Its counters restart on
each server process restart. Compare equal-duration representative active sessions,
including widget mix, before drawing conclusions about total savings.
