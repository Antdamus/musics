# Recorded flamenco guitar phrases

These stereo recordings were published by **digifishmusic**. The minor bar comes from *Flamenco Loop 3.wav* and the major bar from the opening of *Flamenco Loop 6.wav*. Both are licensed under Creative Commons Attribution 4.0. Fretwise excerpted, tuned, transposed, time-stretched and encoded them for practice. The source links, extraction lengths and hashes are in `sources.json`. [Flamenco Loop 3](https://freesound.org/people/digifishmusic/sounds/41986/) · [Flamenco Loop 6](https://freesound.org/people/digifishmusic/sounds/41989/) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

Each file contains a whole four-beat phrase. Three pitch positions and five tempos per chord quality keep the final pitch and timing adjustments small. The browser fits the selected take to the exact practice tempo before playback. Pausing or resuming midway can enter the recording on the next score beat.

Run `node tools/prepare-rumba-phrases.mjs` with Node, curl, and FFmpeg built with the Rubber Band filter to regenerate the Ogg files.
