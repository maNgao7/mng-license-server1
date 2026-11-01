# TikMnG Local Speech Lab

Private experiment only. This engine is NOT bundled in the launcher or enabled
for customer chat. The current downloadable launcher packs remain Okur and EMA.

## Reproducible Sources

- Code: https://github.com/resemble-ai/chatterbox
  revision 5de7a54aa4e5e2baadb0182dde554908b48b85c2, MIT license.
- Model: ResembleAI/chatterbox, Multilingual V3, revision
  5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18. Hashes in download-chatterbox.cjs.
- References: Alania Turkish Synthetic Speech by PatientDesk AI,
  https://huggingface.co/datasets/cloud0day3/alania-synthetic-speech-tr,
  voices config, revision 277dfc8a2322014099ff72688bcaee12480c4605,
  CC BY 4.0: https://creativecommons.org/licenses/by/4.0/.
- Only the CC BY 4.0 voices partition is used. No CC BY-SA text/audio partition,
  original actor recordings or named cartoon/celebrity imitations are included.
- The publisher describes the reference voices as synthetic designed identities,
  not recordings of real people. Keep its attribution and change notice with
  extracted references and generated/adapted samples.

## Local Paths

Environment and source: D:/TikMnG-Ses-Laboratuvari
Models: model-v3/; references: references/; samples: samples/karsilastirma/.
The exact installed environment is recorded in environment.lock.txt there.
No weights, runtime, reference audio or private user profile is committed here.

## Procedure

Use an isolated Python 3.12 environment. Install the pinned source above, not a
global Python replacement. Dependency checks passed on the recorded environment.

1. Run download-chatterbox.cjs to download and verify the pinned weights.
2. Download voices/voices.parquet from the pinned dataset revision. Verify its
   SHA256 5f7022efa9c2fc2f62c328812bf5b82792922bfe032a8ad09bcb7fbe848acf51.
3. Run extract-references.py --source <parquet> --output <references>.
4. Run benchmark.py --model <model-v3> --batch <references/manifest.json>
   --output <sample-folder> --limit 10. Do not treat synthesis as listening QA.

The launcher now uses lib/vendor/chatterbox-worker.py with pinned local weights.
Its Turkish-only initialization disables the upstream eager Chinese segmenter;
all worker socket connections are blocked, not merely Hugging Face downloads.
The standalone runtime imports were verified after relocation with networking
blocked. Actual synthesis passed through both the worker and packaged Electron.
A clean second PC has not yet been accepted.

## Measurements, 22 October 2026

Windows, Ryzen 7 9850X3D, PyTorch CPU, six threads. No GPU acceleration was used.
One resident model produced these ten samples from separate reference identities,
with no pitch/rate impersonation presets:

| Local Label | Reference | Gender | Audio Seconds | Synthesis Seconds |
|---|---|---|---:|---:|
| Ece | d2-00331 | Female | 4.12 | 12.91 |
| Mert | d2-00919 | Male | 4.72 | 10.68 |
| Ada | d1-00525 | Female | 4.60 | 10.83 |
| Efe | d1-02311 | Male | 4.36 | 12.01 |
| Derya | d1-02057 | Female | 4.08 | 10.47 |
| Arda | d2-00703 | Male | 4.40 | 10.10 |
| Neva | d1-01027 | Female | 4.24 | 9.83 |
| Bora | d1-00884 | Male | 4.00 | 10.26 |
| Beste | d1-00781 | Female | 4.36 | 10.65 |
| Usta | d1-00727 | Male | 4.36 | 10.26 |

The local labels were assigned by TikMnG; they are not actor identities.
Distinct files and successful synthesis do not prove subjective voice quality,
correct pronunciation or adequate separation between every pair of speakers.

## Release Gates

- User listening acceptance and pronunciation checks are still required.
- No verified child voice or Turkish regional-accent catalog is provided.
- Current CPU latency is too high to call this real-time live-comment speech.
- Test supported GPU acceleration and performance during an actual game/broadcast.
  No drivers or global GPU settings were changed by this experiment.
- The bounded resident worker, cancellation, queue, idle unload and pinned pack
  installer are implemented and tested. The optional 10-speaker pack is separate
  from launcher updates. Clean-machine acceptance is still required.
- No API character quota is involved in this local experiment; hardware, storage
  and electrical cost still exist. Do not call a hosted service unlimited/free.
