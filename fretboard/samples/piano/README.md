# Sampled grand piano

The Piano duo uses close-microphone recordings of a Steinway Model B, played softly with the sustain pedal down. A recorded upright bass accompanies the piano chords. [Versilian Community Sample Library](https://versilian-studios.com/vcsl/)

Eleven source keys cover F♯3 through D5 at whole-tone intervals. Notes between source keys use the nearest recording, shifted by one semitone. The stereo recordings keep their attack and resonance. This web subset removes leading silence and limits long pedal tails to eight seconds with a fade.

See `sources.json` for the pinned source revision, file URLs and hashes. The publisher’s CC0 license is in `LICENSE.txt`. To reproduce, run `node tools/prepare-fretboard-instrument.mjs piano` with Node, FFmpeg and curl.
