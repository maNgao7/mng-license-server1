# Presentation audio — original synthesis

These sounds were authored for TikMnG with the adjacent `generate.py`, Python's
standard library, seeded noise and the installed FFmpeg Vorbis encoder. No
third-party recording, sample, sound library or existing melody was used.
They may be used, modified and distributed with TikMnG games, broadcasts and
videos, including commercial use, without attribution.

- `steel-clash.ogg`: 0.82 s, inharmonic steel resonances, brief impact and scrape;
  source peak -8 dBFS, player -9 dB. A single impact with a 700 ms retrigger cap.
- `migration-call.ogg`: 2.8 s, three synthesized distant bird calls; source peak
  -16 dBFS, player -12 dB, once during each migrating flock. No idle audio loop.
- `loading-ottoman.ogg` and `loading-ottoman.wav`: the same original 8 s modal
  phrase with soft reed harmonics, bass and restrained percussion, inspired by
  Ottoman instrumentation. This is synthesized music, not an authentic ensemble
  recording or a historical march. Source peak -25 dBFS; Godot adds -6 dB.
  The mono PCM16 WAV carries its own quiet gain for WinForms SoundPlayer.

The existing `country-victory.ogg` was not reused: its licensing/provenance could
not be established from the project's audio credits. No change to victory audio.

Rebuild with `python assets/audio/presentation/generate.py`. Existing Vorbis
copy glob `assets/audio/**/*.ogg` covers the Godot assets. Desktop packaging also
needs `assets/audio/presentation/loading-ottoman.wav`; package scripts are owned
by the parent task. Include this source/rights note in distributed asset credits.
