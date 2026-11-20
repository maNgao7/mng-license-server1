# Fetih 0.1.0 standalone source

This is the exact Godot 4.7.2 standalone project used for the approved preview.7 ZIP. It contains no Steam executable or runtime. Runtime Node modules/executable and compiled Godot import cache are omitted from Git; their versions and hashes are in bridge/runtime/runtime-manifest.json and licenses. The muted broadcast guide, original gift PNG and country-leader widget are included in the released ZIP.

Game entry: Fetih.exe. Engine: Godot 4.7.2 Windows x64 release template. Archive SHA-256: b4ecf9a51132a6fb6f7e734805ced76b2dde14790dabda3015cb4e7204983a20.

Launcher owns the live connection when launched from TikMnG; the child receives the existing owner adapter URL/token via environment. Profiles and saves stay outside the package in the launcher user-data fetih directory. Direct launch uses LocalAppData/TikMnG/FetihStandalone.

Do not publish test profiles, license data or private owner tokens. Local/synthetic tests do not establish real gift delivery or guarantee portrait quality for every remote user.
