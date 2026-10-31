# Recorded upright bass

18 pizzicato samples from Karoryfer’s [Meatbass](https://shop.karoryfer.com/pages/free-meatbass), recorded on a 1958 Otto Rubner double bass. See the [original SFZ mappings and audio](https://github.com/sfzinstruments/karoryfer.meatbass/tree/ac9e859564bda286ab5ec672d00ff1aa2fef2895), the bundled CC0 license, and `sources.json` for exact input and output hashes.

The subset covers F♯1–F♯3 at minor thirds, with two separate takes per sampled note. The player chooses the nearest recording, tunes it to the required pitch, and releases it in time with the arrangement. Notes keep their original attack and decay. The nylon accompaniment uses the existing CC0 guitar recordings under `../guitar/nylon/`.

To rebuild, run `node tools/prepare-fretboard-bass.mjs` with Node, curl, and FFmpeg on the path. The tool removes leading silence and encodes Ogg Vorbis at quality 6. Source WAVs stay in ignored test output. The practice app fetches only the samples for the chosen four bars from its own host.
