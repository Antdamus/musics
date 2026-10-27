# Fretwise

Guitar sight-reading and fretboard practice with classical notation, exact octaves, a 21-fret note map, adjustable tempo, optional microphone checking, recorded guitars, acoustic drums, and a mechanical metronome.

**[Open Fretwise](https://antdamus.github.io/musics/)**

This is the dedicated source repository for the **Music learning** project. The complete app, recordings, licenses, tests, and sample preparation tools were imported from the Fretwise work through `Antdamus/Invsto` commit `cb47a1f200917cc630bedb7b64469fd440004d79`.

## Run locally

Serve the repository with a static HTTP server, for example:

```sh
python -m http.server 4173
```

Open `http://localhost:4173/fretboard/`. The app needs no build step, backend, or runtime dependencies. Progress and settings are saved in browser localStorage.

## Verify

Use a current Node.js release, then install the pinned test dependencies and browser:

```sh
npm ci
npx playwright install chromium
npm test
```

If Chromium is already installed in a custom Playwright cache, set `PLAYWRIGHT_BROWSERS_PATH` to that directory before testing. `npm run test:unit` runs the non-browser checks; `npm run test:browser` exercises the UI, transport, and audio.

## Structure

- `fretboard/`: the complete static app and detailed [practice documentation](fretboard/README.md).
- `fretboard/samples/`: bundled guitar, drum, and metronome recordings, with licenses and source manifests.
- `tests/`: music logic, sample integrity, and browser checks.
- `tools/prepare-fretboard-*.mjs`: reproducible sample preparation scripts. Rebuilding the drum subset also requires FFmpeg.

GitHub Pages publishes the root of `main`; the root entry redirects to `fretboard/`. No build action or external audio service is required.
