# Turkish Forza 0.5.2 hotfix

Incremental native mod sources and regression checks from the existing Forza project.
These partial classes are built with that project's pinned BepInEx/IL2CPP references;
this directory is an audit snapshot, not a separate standalone game project.

- Explicit P start cancels the flyover and uses a fixed native three-second clock.
- Native AI receives a bounded passing lane target. Viewer hull pairs cannot push
  one another; track collision layers, wheels and velocity remain native.
- Compact top-ten standings have clean text and a small leader crown.
- Car names omit @; portrait, text and speed share one distance scale and car anchor.
- Only launcher opening music is custom. Welcome/countdown/vehicle/rescue playback
  is disabled, leaving gameplay buses to the original game.
- Command polling, crowd refresh and FMOD bus discovery run at bounded intervals.

Validation: 74 Node checks, native audio/economy/results console checks and mod build
passed. In an isolated native run all 30 cars moved, an upgraded trailing car went
from place 30 to 1, manual finish returned an empty staging grid, third natural
finisher ended the next race, and exit returned 0. These are local synthetic tests;
live TikTok delivery and physical speaker output were not recorded in this run.

Preview6 -> preview7 archive installation, restart, unchanged settings location and
no repeat download were checked. The existing launcher UI also passes the delayed
reply/update-to-Play regression for both Arena and Forza.

The public package contains no original Steam game binaries. Its native DLL SHA256:
`d2f5609d8ac56a06bfd2deeea71230ae2580165a79d11d612d49c8ff58a97dc6`.

Render deploy is manual. Rollback uses the prior Git commit/catalog and the retained
0.5.1 release asset; the migration preserves administrator-customized catalogs.
