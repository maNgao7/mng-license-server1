# Snow War Audio Provenance

## Christmas music

- Asset: `assets/mng_snow_war/sounds/christmas.ogg`
- Title: Joy to the World (piano)
- Performer and uploader: Orthologist (Wikimedia Commons)
- Recording published: March 9, 2007
- Source and rights declaration: https://commons.wikimedia.org/wiki/File:Joy_to_the_World_(piano).ogg
- Permanent source revision: https://commons.wikimedia.org/w/index.php?title=File:Joy_to_the_World_(piano).ogg&oldid=677040125
- Original download: https://upload.wikimedia.org/wikipedia/commons/d/d3/Joy_to_the_World_%28piano%29.ogg
- Retrieved and verified: October 18, 2026
- Rights: public domain, expressly dedicated by the copyright holder (PD-self), worldwide. The dedication includes an unconditional permission to use the work for any purpose where public-domain dedication is not legally possible, subject to mandatory law. This is the recording's own rights statement, not an inference from the age of the carol, and not the Commons website footer's CC0 metadata license.
- Composition: traditional carol tune arranged by Lowell Mason (1839); the source also credits Isaac Watts and George Frideric Handel. This asset is an instrumental piano performance.
- Changes: none. Original Ogg Vorbis bytes retained, renamed `christmas.ogg`.
- Format: Ogg Vorbis, stereo, 48,000 Hz, 122.506979 seconds, 2,346,318 bytes.
- SHA-256: `28ed2a5243d969b85abe555045638ec3bcc29cf454487241117f7adc480c29b5`

Suggested credit for distributions and broadcasts:

> Music: Joy to the World (piano), performed by Orthologist, Wikimedia Commons. Recording dedicated to the public domain by its copyright holder. https://commons.wikimedia.org/wiki/File:Joy_to_the_World_(piano).ogg

The music event remains `mng_snow_war:christmas`, streamed through `sounds.json`. `tools/generate-audio.cjs` only regenerates the wind sound and preserves this recording. The obsolete synthesized `christmas.wav` has been removed so later audio conversion cannot restore the old synthetic music.

To restore the music, download the original URL above to `christmas.ogg` and verify the SHA-256. No music synthesis or transcoding is needed.

## Wind

The existing wind sound is generated procedurally by `tools/generate-audio.cjs`. It is separate from the downloaded piano performance.
