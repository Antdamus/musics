# Recorded alto saxophone

The Sax trio uses soft notes played on an alto saxophone and recorded with a condenser microphone. [Karoryfer Weresax](https://shop.karoryfer.com/pages/free-weresax)

The bank covers concert G3–C♯5 (MIDI 55–73), with two actual takes at each pitch. Notes use the publisher’s SFZ pitch centers and play at their native rate. Fretwise sequences the notes to the practice tempo and fades each release before the next bar. The player downloads only the files in the selected arrangement.

The pinned source revision and sample hashes are in `sources.json`. The upstream CC0 license is in `LICENSE.txt`. Rebuild with `node tools/prepare-fretboard-instrument.mjs sax` (Node, curl and FFmpeg). The script removes leading silence and encodes Ogg Vorbis. Source WAVs remain in ignored test output.
