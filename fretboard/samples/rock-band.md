# Electric rock band recordings

The rhythm guitar uses the bridge pickup of a sampled Fender electric guitar, processed through FreePats’ overdrive rig. Two picked takes at each of eight source pitches cover the low rhythm part. The arrangement alternates short picked notes with ringing two-note chords. [FreePats FSBS Dist1](https://github.com/freepats/electric-guitar-FSBS-dist1)

The electric bass uses the picked blue solidbody five-string from Black And Blue Basses. This subset has two takes at each of ten sounding pitches from E1 to B♭2. The source names and SFZ key centers use the written bass octave. The local files and manifest use sounding MIDI pitches. [Karoryfer Black And Blue Basses](https://shop.karoryfer.com/pages/free-black-and-blue-basses)

The optional solo violin uses five softly bowed notes with natural vibrato. It holds a chord tone in bars 2 and 4. The optional piano uses the existing [Steinway grand recordings](piano/README.md) and enters just after the downbeat. [Versilian Chamber Orchestra 2 Community Edition](https://versilian-studios.com/vsco-community/)

Electric guitar, electric bass and violin use the nearest bundled note, shifted by at most two semitones. Recordings load when that part is needed. Each instrument folder contains the publisher’s CC0 license and a manifest with source URLs, pinned revisions and SHA-256 hashes. Rebuild with Node, curl and FFmpeg from the repository root.

```sh
node tools/prepare-fretboard-instrument.mjs electric
node tools/prepare-fretboard-instrument.mjs rockbass
node tools/prepare-fretboard-instrument.mjs violin
```
