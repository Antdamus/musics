# Rumba rhythm guitar

These individual strokes cover practice below 40 BPM, suspended chords and fifth-only chords. The player’s lower strings can keep ringing beneath the lighter treble strokes until the hand mute or chord change. Major and minor chords at higher tempos use [continuous guitar phrases](../rumba-phrases/README.md).

SpeedY recorded open chords on a nylon-string guitar, including separate upward and downward strokes and two takes of the strumming hand stopping the strings. The tap on beat one is leaving.february’s recording of a thumb striking an acoustic guitar body. Both artists released these sounds under CC0. Each entry in `sources.json` links to the original sound and lists the source and packaged file hashes. [SpeedY’s Nylon Guitar Open Chords](https://freesound.org/people/SpeedY/packs/472/) · [Hand mute](https://freesound.org/people/SpeedY/sounds/8506/) · [Guitar body tap](https://freesound.org/people/leaving.february/sounds/674811/) · [CC0 dedication](https://creativecommons.org/publicdomain/zero/1.0/)

Count **1 & 2 & 3 & 4 &**. Play down with a body tap, up, down, **accented up**, **hand stop**, up, down, up. The accented upstroke rings until the hand lands. The last upstroke of bar four leads back into bar one. This is one taught four-beat rumba pattern. [Sergio Ercole’s strumming demonstration](https://www.latinguitarmastery.com/flamenco/rumba-strumming/)

Major, minor and suspended chords each have a full downstroke, a full upstroke for the accent, and an upward brush across the three treble strings. For the fifth-only chromatic backing, the upstrokes use treble-string grips containing just the root and fifth. Each chord stroke is transposed from the nearest available recording of the same quality and articulation. The hand mutes and body tap play at their recorded pitch.

The optional classic cadence descends from the minor chord to the major dominant, one bar per chord. In Phrygian modes the selected key is the final chord. In the other note families the progression starts on the selected key. The backing can borrow tones while the reading exercise stays in its selected scale.

To rebuild the Ogg files, run `node tools/prepare-rumba-strums.mjs` with Node, curl and FFmpeg. The script trims the lead-in to each stroke and keeps up to three seconds of chord decay.
