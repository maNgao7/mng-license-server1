# Zombie War event regression checks

Release 6.5.13 fixes the modern connector's `gift.type` and `like.count` fields.
Gift groups use cumulative high-water marks, so a progress message and its final
message contribute only the newly sent gifts. Like batches retain each viewer's
unfinished threshold. The Java receiver also rejects duplicate dispatch IDs.

This folder preserves the changed event sources and their regression checks.
The full Minecraft runtime is distributed as the `zombie-war.zip` release asset.

Run the bridge checks with Node.js:

```sh
cd live-bridge
npm ci
node --test events.test.js live-session.test.js proto-regression.test.js
```

Compile `EventCounter.java` and `EventCounterChecks.java` together with Java 17,
then run `com.tikmng.zombiestrike.EventCounterChecks`.

The in-game verification additionally replays real v3 protobuf messages through
the connector, local WebSocket, Java receiver, configured actions and spawn queue.
It deliberately duplicates both gift notifications and local dispatch frames.
Release result: 34 Node tests, 13 counter assertions and 9 in-game cases passed.
