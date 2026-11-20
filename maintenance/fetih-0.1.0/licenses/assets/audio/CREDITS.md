# Harita Savaşı — recorded military audio

All four recordings below are published as **CC0 1.0** on their individual
Freesound pages. License: https://creativecommons.org/publicdomain/zero/1.0/
Credit: **qubodup / Freesound**, with the original UH-60 recording by
**Sgt. Charlie Duke, U.S. Army, 1st Armored Division**.

Public HQ MP3 previews were downloaded without an account or API token. The
original WAV/FLAC downloads were not used. The game loads local mono, 48 kHz
Ogg Vorbis files and does not contact Freesound at runtime.

| Game file | Author, recording and license evidence | Adaptation |
| --- | --- | --- |
| `rotor.ogg` | qubodup, [UH-60 Black Hawk Helicopter Hover Loop 1, #854493](https://freesound.org/people/qubodup/sounds/854493/), 17 May 2026; CC0. Derived by the uploader using MubLoop from [1st AD CAB and DSB conduct combined training exercise](https://www.dvidshub.net/video/1006929/1st-ad-cab-and-dsb-conduct-combined-training-exercise), recorded 29 April 2026 by Sgt. Charlie Duke, marked public domain on DVIDS. | Full 2.611 s preview; mild 42 Hz high-pass, 12 kHz low-pass and 1.8:1 compression; 25 ms circular crossfade; peak target -3 dBFS. No synthetic rotor, unrelated ambience, music, siren or speech layers added. |
| `tank-cannon.ogg` | qubodup, [Tank Firing, #168707](https://freesound.org/people/qubodup/sounds/168707/); CC0. Page identifies tank fire extracted from a U.S. Government agency video. | One actual shot, 1 s; 35 Hz–12.5 kHz filtering, 2 ms entrance and 200 ms tail fades; peak target -4 dBFS. Triggered by `MilitaryLayer.tank_fired`. |
| `front-impact.ogg` | qubodup, [Tank Shots, #239135](https://freesound.org/people/qubodup/sounds/239135/); CC0. Page identifies tanks firing in a U.S. Government agency video. | First 2.85 s cannon blast and reverberation; 32 Hz–11 kHz filtering, 2 ms entrance and 600 ms tail fades; peak target -5 dBFS. A recorded tank report used as a battlefield impact, not a separately verified shell detonation. |
| `front-rumble.ogg` | qubodup, [Distant Tank Shots.flac, #184275](https://freesound.org/people/qubodup/sounds/184275/); CC0. Page identifies live training-range fire and a U.S. Government agency video. | 9.0–11.9 s excerpt; 35 Hz–8.5 kHz filtering, 2 ms entrance and 600 ms tail fades; peak target -6 dBFS. |

These replace the old #187681 rotor, #108640 impact (juskiddink), and #383220
rumble (1piemanpie); those old sources are no longer used by these game files.
No punch/dice recording is played by the combat adapter.

`sources.json` records source URLs, preview hashes, exact processing, resulting
durations, measured decoded peaks/RMS, and game-file hashes. Source-page HTML
and previews used in development are retained under `qa/audio-source`.

Mix contract: one aggregate rotor voice on `TikMnG Rotor`; visible war aircraft
have a 0.075 overview floor and focused aircraft rise to 0.34. No overview floor
for idle patrols or offscreen aircraft. Combat keeps its own bus, pauses with
the war, and starts only after contact (`travel >= 1`). Cannon voice count and
cadence are capped; active fronts share a volume budget. Missing recordings
warn without stopping the other channel.

Validation is local native loading, playback state and numerical levels only.
External live delivery and the user's audible satisfaction are not certified.
The tank recordings are authentic according to their source descriptions;
this is not a claim of a newly captured or independently authenticated tank.

Local verification on 17 November 2026: `qa/check-audio-mix.gd` passed 33
checks in the installed Godot 4.3 engine; `qa/native-attack-gate.ps1` passed
the 25 existing adapter checks. All four decoded files have zero clipped
samples; measured peaks are -3.14, -4.11, -4.61 and -6.42 dBFS (rotor, cannon,
impact, rumble). Reports: `qa/audio-mix-results.json` and
`qa/audio-levels-results.json`. Full `tests/release-gate.ps1` and external LIVE
were not run in this audio-only scope.

Parent integration/test note: zoom 0.7 no longer implies unconditional zero
rotor strength. Expect 0.075 for visible aircraft near an active war, and 0
for idle overview patrols, unrelated regions and offscreen aircraft. The
existing `tests/check-battle-surface.gd` overview assertion uses a post-war
fixture; preserve the idle assertion and add wartime coverage. No edits to
`MilitaryLayer.gd`, `PerspectiveMap.gd`, existing tests, launcher, settings,
live connection or user profiles are needed for the audio wiring.
