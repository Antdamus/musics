# Fretwise

Guitar sight-reading and fretboard practice with classical notation, exact octaves, a 21-fret note map, adjustable tempo, optional microphone checking, recorded guitars, acoustic drums, and a mechanical metronome.

**[Open Fretwise](https://antdamus.github.io/musics/)**

For a backing band, select a key and note family in **Notes & goals**, then open **Sound → Backing accompaniment**. Choose recorded upright bass, nylon guitar, an acoustic duo, **Sax trio**, or **Piano duo** for soft grand-piano chords and upright bass. In the trio, an alto sax plays short answers at the ends of bars 2 and 4 while the guitar exercise continues. Try **E · Phrygian dominant** with **Acoustic duo** to hear E → F → Dm → E. Preview plays four bars at the playback tempo without starting a practice session.

Choose **Electric rock band** for overdriven rhythm guitar, picked electric bass and drums. Add **grand piano** or **solo violin** independently. **Preview backing** plays the band with your selected drummer. Choosing Electric rock band starts Straight rock if drums were off. Use **Drum groove** to change or mute the kit.

This is the dedicated source repository for the **Music learning** project. The complete app, recordings, licenses, tests, and sample preparation tools were imported from the Fretwise work through `Antdamus/Invsto` commit `cb47a1f200917cc630bedb7b64469fd440004d79`.

## Run locally

Serve the repository with a static HTTP server, for example:

```sh
python -m http.server 4173
```

Open `http://localhost:4173/fretboard/`. The site is static with no build step. Guest progress stays in browser localStorage. Optional email/password accounts use a dedicated Supabase project to sync private progress and settings between devices. Each person chooses a display username and signs in with their own email.

## Profiles

Choose **Sign in → Create an account**, enter a username, email and password (at least 10 characters), and confirm the email. Use the same account on phone and computer. Sign out before another person uses the same browser. Existing guest history can be brought into an account explicitly from the profile dialog; it is never silently assigned to whoever logs in first.

Changes save locally immediately, sync after a short delay, and refresh from the account every 15 seconds or when returning to the page. Remote setup changes wait until playback is paused. The profile shows whether work has synced or is waiting for a connection. Microphone audio and local backing files never leave the device. Playback BPM and target BPM remain separate settings.

Choose **My progress** for a Monday–Sunday summary: practice time by day, days practiced, session count, checked notes, and accuracy. Browse earlier weeks or inspect individual sessions with their duration, playback tempos and notes studied. Sessions save every five seconds while playing and when pausing or leaving the page, so **Finish session** is optional for preserving your work. Pausing and resuming updates the same session; paused time is excluded and the count-in is included. Signed-in history syncs with the account. The latest 365 sessions are retained; older session records use their original saved date.

The public browser configuration is in `fretboard/account-config.mjs`; it contains only the public Supabase URL and anonymous client key. Administrative keys, SMTP credentials and database passwords must never be committed. The dedicated **Fretwise** project uses the Free plan; email confirmation and password recovery use custom SMTP, with Fretwise as the sender name. No inventory tables or inventory auth settings are modified.

`supabase/migrations/20261031000000_practice_profiles.sql` defines ownership policies, revision-checked saves and idempotency receipts. It has been applied to the hosted project. Each row belongs to its authenticated user; anonymous access is denied. Save requests also verify the expected account to reject requests left over after account switching. Offline changes merge against the last synchronized base, preserving new attempts, passes and session summaries from both devices. Resetting a signed-in account clears its practice history across devices.

The official Supabase client is pinned and bundled locally. After changing that dependency, run `npm run build:auth` and commit the generated module and license. The published site does not depend on a JavaScript CDN. Configure the hosted Auth site URL and allowed redirects to `https://antdamus.github.io/musics/fretboard/` (and its `index.html` entry). Auth emails must use a functioning custom SMTP service; Supabase's built-in test email delivery is not sufficient for public accounts.

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
- `supabase/migrations/`: private account storage and database policies.
- `tools/prepare-fretboard-*.mjs`: reproducible sample preparation scripts. Rebuilding the drum subset also requires FFmpeg.

GitHub Pages publishes the root of `main`; the root entry redirects to `fretboard/`. No build action or external audio service is required.
