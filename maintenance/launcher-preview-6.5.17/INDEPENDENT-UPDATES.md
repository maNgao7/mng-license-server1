# Launcher and Game Updates

The launcher version is not a game version. Updating a game does not require a
launcher release or removal of installed games.

## Release a Game

1. Build the selected game's ZIP or a verified per-file manifest. Give that game
   its own new version and calculate its byte count and SHA-256 hash.
2. Upload only that game's assets to the owned distribution host.
   A GitHub game-only release must not become the latest launcher release or
   replace its `latest.yml`/installer assets. Keep the two release feeds separate.
3. In the authenticated content manager, update only that game's catalog entry:
   version, URL, bytes and hash; optionally publish the per-file manifest.
4. Save the draft, review it, then publish the catalog. This does not publish a
   launcher executable or change the launcher update feed.
5. The launcher refreshes its catalog on demand and periodically. That game's
   detail page offers Update; other installed games stay installed.

## Installation Safety

- Download to a temporary location; verify bytes/hash and archive paths.
- Preserve mutable settings, saves, gift assignments and configured storage.
- Validate a new version before switching the game's active pointer.
- A failed/cancelled update leaves the old game playable.
- Per-file manifests reuse matching files by copying them, not writable links;
  only changed files need transfer. ZIP updates download only the selected
  game's ZIP, not the launcher or other games.
- Shared-package aliases, currently VS/Profile Rating, update together. Truly
  independent alias releases require splitting their physical packages first.

The application installer ships no game packages. Game and media roots live
outside its installation directory. The NSIS configuration preserves application
data, and the updater does not clear the library or profile.

## Preview Gate

The current 6.5.17 build is a private preview. Do not publish a stable launcher
update until user acceptance. No production catalog was changed in this work.
