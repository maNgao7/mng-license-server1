TikMnG Fetih 0.1.0
Private Windows x64 build

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
The Country Leaders widget uses http://127.0.0.1:32188/ulke-liderleri.

Assets and licenses
The single playable map is Türkiye. The game packages the TikMnG atlas,
coastline, geometry, title and victory art, music and Turkish voice.
The stand-alone impact sprites and generic gift icon are original.
The gift catalogue keeps names, IDs and coin values, with the common
gift icon. For map and audio attribution, see licenses/assets/.
Godot licenses and credits are in licenses/. Node and package notices
are in bridge/runtime/.

