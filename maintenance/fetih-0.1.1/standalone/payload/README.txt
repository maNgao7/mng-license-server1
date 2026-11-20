TikMnG Fetih 0.1.1
Windows x64

Extract the entire ZIP and open Fetih.exe. Keep Fetih.pck and bridge/
beside the executable. The package boots directly into the Türkiye map
and includes the Windows engine and local LIVE bridge runtime.

Launcher integration
Set the working directory to the extraction folder and launch Fetih.exe
with no additional arguments. Reuse the one running game process.
TIKMNG_ANIMAL_PROFILE is an optional absolute writable directory. The
default is %LOCALAPPDATA%/TikMnG/FetihStandalone.
TIKMNG_FETIH_STARTUP_SIGNAL is an optional absolute file path. Create its
parent folder and use a fresh signal file per launch. The game writes
2 (boot), 3 (loading map), and 4 (first gameplay frame drawn). When the
signal is configured the launcher draws the loading UI. Treat process
exit or a launch timeout as startup failure.
Pass MNG_LIVE_OWNER_URL and MNG_LIVE_OWNER_TOKEN together to the game
child when the launcher owns LIVE. The portable bridge relays events
without opening another TikTok session. The included
bridge/runtime/owner-helper.cjs implements the existing owner adapter.
Direct launch permits an independent connection after the publisher
enters their account and clicks Bağlan.
Use the in-game Country Leaders and Army Standings buttons to copy a
TikMnG HTTPS browser-source URL. The local URLs also work with OBS on
the same PC while the game and the widget service are running.

Assets and licenses
Türkiye opens by default. Select Dünya in the map picker for the
34-region world atlas. Each map keeps its own round.
The package includes the TikMnG map art, title and victory art, music,
Turkish voice, small impact sprites and the individual gift icons.
For map and audio attribution, see licenses/assets/.
Godot licenses and credits are in licenses/. Node and package notices
are in bridge/runtime/.
