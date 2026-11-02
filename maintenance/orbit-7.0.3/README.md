# MNG Orbit 7.0.3

Game-only release. The live simulation, server and public broadcast widgets are unchanged.
`public/panel-visibility.js` changes local UI display only; no polling or remote calls.

- Left-bottom Lucide view control; independent gifts, winners, ranking and timer checkboxes.
- Browser storage preference, safe defaults and denied-storage fallback.
- Existing drag positions and running simulation survive visibility changes.

Verification: 32 browser assertions at 800x600, 1280x720 and 1920x1080;
7 collision tests; round progression integration; hash verification of 2995 package
files; actual library update reusing 430000880 bytes and downloading 33098 changed
file bytes plus the 1016167-byte complete manifest. Clean archive installation passes.
There were no real paid gifts or remote load tests.

The complete production manifest reuses unchanged immutable GitHub objects.
The archive is for cold installs; do not proxy downloads through Render.
The launcher and user Drive setup installer remain at 7.0.15.
