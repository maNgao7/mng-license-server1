# Launcher 7.0.1 Maintenance Snapshot

These are the changed renderer and QA sources for the existing TikMnG launcher,
not a standalone application. Apply to its 7.0.0 source tree and set the root
package.json and package-lock.json package version to 7.0.1 before building.

No game versions, userdata paths, media hashes or saved mapping schema changed.
Workspace browser QA covers separate Library/My Actions tabs, audio-only lists,
preserved preview/search nodes on background asset events, game-scope filtering
and saved mapping restoration. The packaged check uses the package version.

Server-side offline source recovery lives in overlay-relay.js and requires a
separate Render deployment; a launcher-only update does not deploy the server.
