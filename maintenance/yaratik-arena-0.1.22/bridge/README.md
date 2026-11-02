# TikTok file IPC bridge

Entry point: `index.cjs`. Unity can launch `bridge/runtime/node.exe` with
`bridge/index.cjs --root D:\TikMnG-CanEmAll-Prototype --parent-pid GAMEPID`.
The root is the prototype directory, not its `userdata` subdirectory. Node 24+
is required. The bridge owns its sidecar only and performs no game actions.

From this directory:

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
.\runtime\node.exe --test ..\qa\bridge-tests.cjs
.\runtime\node.exe index.cjs --root D:\TikMnG-CanEmAll-Prototype --parent-pid 12345
.\runtime\node.exe probe.cjs
```

`tiktok-live-connector` is pinned to 2.4.4 and Sharp to 0.34.5, including the npm lockfile. An optional
`TIKTOK_SDK_MODULE_PATH` can point to a supplied 2.4.4 package directory or JS
entry point. Optional `EULER_API_KEY` takes precedence over the existing private
key at `C:\Users\User\Desktop\MNG-TikTok-Game\apps\tiktok-vs\euler-api-key.txt`.
Keys and SDK exceptions are never included in status, evidence, or bridge logs.
The existing launcher is only read; its helper is copied verbatim.

## IPC

The bridge publishes a fresh status at startup and ignores the command already
on disk. Unity waits for that status, then atomically replaces
`userdata/live-command.json` with a strictly newer safe integer sequence:

```json
{"seq":1,"op":"connect","username":"benyigit61"}
```

Supported operations are `connect`, `disconnect`, and `shutdown`; all include
a string `username` (empty for disconnect/shutdown). Commands are polled every
200 ms. In-flight connects are replaced without waiting for network timeouts.

`userdata/live-status.json` contains exactly `status`, `reason`, `message`,
`username`, `roomId`, `epoch`, `lastEventAt`, `received`, and `giftEvents`.
Times are Unix milliseconds (`0` before any event). Counters reset on explicit
connect: `received` counts forwarded SDK events including duplicate terminal
messages; `giftEvents` counts accepted, queued terminal gift messages, not gift
units. A new random epoch is published on boot and explicit connect/disconnect.
Automatic reconnect preserves it. Old avatar tasks cannot emit under a new
epoch. Unity must discard events whose epoch differs from current status.

Each event is an independent, flushed JSON file published by a same-directory
atomic rename. Filenames are sortable 20-digit sequence + UUID +
`.tiktok-bridge.json`. Gift schema:

```json
{"kind":"gift","epoch":"uuid","username":"viewer","nickname":"Viewer","giftId":"5655","repeatCount":3,"eventId":"sha256","avatarFile":""}
```

Avatar schema:

```json
{"kind":"avatar","epoch":"uuid","username":"viewer","avatarFile":"D:\\TikMnG-CanEmAll-Prototype\\userdata\\avatars\\tiktok-bridge-avatar-HASH.jpg"}
```

Gifts are queued before any avatar network work. Only native positive gift IDs
are accepted. Native message ID + sender identity + gift ID form the stable
event ID. Native combo groups provide an additional dedupe key even if terminal
message IDs change. Names, counts, or time windows are never used to identify a
gift. Messages missing native IDs are rejected with an explicit status reason.
The persisted journal retains the most recent 2,000 accepted gift records
across reconnects/restarts. Dedupe beyond that bounded window is not guaranteed.
Without a native group ID, separate terminal message IDs cannot safely be
treated as the same combo. Initial SDK data replay is disabled.

The spool permits at most 2,000 JSON files, including foreign files. On overflow
the bridge reports `status:error, reason:overflow`, logs the failure, and stops
the connection; it never evicts undelivered current-epoch gifts. After draining,
send a newer connect command. Only bridge-named stale event files with valid
gift/avatar records are removed on boot or explicit channel replacement.
Foreign files and linked directories are never cleanup targets.

## Avatars and lifecycle

Avatar downloads run asynchronously (2 workers; 128 outstanding jobs), validate
HTTPS CDN hostnames and each redirect, reject private DNS addresses, enforce a
12-second total deadline and 2 MiB streaming cap, and check raster signatures.
The cache holds up to 512 owned files / 64 MiB. Queue overflow is reported in
status. Sharp decodes at most 16 megapixels from at most 2 MiB input, processes
only the first animation frame, rotates/downscales/crops to at most 256 x 256,
and emits PNG only for Unity's image decoder. Conversion has a 5-second limit.

The copied session helper handles 25-second connection timeout, jittered
reconnect, offline waiting, health checks, late connection retirement, and
terminal combos. Parent death, IPC shutdown, SIGINT, and SIGTERM close the
session, cancel avatar work, release the owned root lock, and exit the sidecar.

`probe.cjs` creates isolated owned roots under `bridge/`, connects sequentially
to the four authorized accounts, observes each connected room for 8 seconds,
then disconnects and shuts down each sidecar before starting the next. It only
receives data. Results are written to `qa/bridge-live-result.json`; connected
rooms and real gift delivery must be distinguished in that evidence.
