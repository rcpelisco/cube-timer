# Cube Timer

Speedcubing timer built as an installable PWA (Vite + React + TypeScript + vite-plugin-pwa). Live at
**https://rc-cube-timer.web.app**.

## Features

### Timer

- Hold Space (or touch and hold) until the time turns green, release to start; any key or tap stops.
- Optional 15 s WCA inspection with a countdown ring and spoken "Eight seconds" / "Twelve seconds"
  calls: +2 after 15 s, DNF after 17 s.
- Split timing: each press marks the end of a phase (e.g. Cross · F2L · OLL · PLL, Roux blocks, or a
  4×4's Centers · Edges · 3×3), with phase names set per puzzle.
- Focus mode (full-screen timer while solving), an option to hide the time while solving, vibration on
  green, splits and stop, and the screen kept awake on timer pages.
- Type in times instead (a switch in Settings), e.g. from a Stackmat: `12.34`, `1:02.34` or `1234`, with
  `+` for +2 or `DNF`; each uses the scramble shown.
- Shortcuts for the last solve: `2` / `+` for +2, `D` for DNF, `N` for a note, Backspace to delete.
- A sub-X goal and a daily solve target (a ring that fills as you go), confetti on a new PB.
- Mock competition: an Ao5 or Mo3 round run the WCA way, with optional cutoff and time limit; finished
  rounds are kept on the session and can be shared as an image.

### Puzzles and scrambles

- 2×2–7×7, Pyraminx, Skewb, Megaminx, Square-1, Clock and FTO. Each session is for one puzzle (set when
  you create it; it can only change while the session is empty).
- Scrambles from [cubing.js](https://js.cubing.net/cubing/) (random-state where the WCA uses it, as in
  TNoodle), generated in a web worker with the next one prepared ahead, plus a flat drawing of the
  scrambled puzzle. If the generator fails, the cubes fall back to random-move scrambles and the label
  says so; other puzzles show an error with a retry button.
- New scramble, Previous (brings back the last one, e.g. to redo a solve) and Copy.

### Sessions and statistics

- Named sessions (e.g. "Main", "One-handed"), each with its own solves and stats. Switch, create, rename
  and delete them from the menu next to the app name.
- Single, Mo3, Ao5, Ao12, Ao100 with WCA trimming, plus averages of any size you add (e.g. Ao50,
  Ao1000). Tap one to see the solves behind it.
- +2 / DNF / delete per solve, and a detail view with its scramble, the averages it ended and a note.
- Charts: a recent trend with Ao5, progress by day, week or month (for the session or every session
  for the puzzle), and how times are spread.
- Compare dates: this week against last, this month against last, the last 30 days against the 30
  before, or two ranges you pick, with solves, mean, average, best single, Ao5, Ao12 and DNF rate.
- PB history (best single and averages over time), practice days for the last six months with your
  streak, and share cards for results.
- Copy times, clear a session, and import or export csTimer files.

### Algorithms and Trainer

- Algorithms page: 3×3 F2L (all 41 cases), OLL (57), PLL (21) and COLL (40), and 2×2 Ortega (OLL and
  PBL), with diagrams, up to 4
  algorithms each (standard first, pick your own main), setups, named triggers (Sune, Sledgehammer…),
  a 3D cube that plays them, group/status filters, Learning/Learned status, and a cross-color setting
  that recolors the diagrams. Every algorithm is checked on a cube model (`npm run check:algs`).
- Trainer: scrambles into a random F2L, OLL, PLL or COLL case from the ones you pick (shown only after the solve,
  so recognising it is part of the practice), times per case, favouring slow and little-practised cases.
  Also last-layer and cross drills, and "Drill my worst" for your slowest cases with a before and after.

### Appearance

- Light, dark or system theme, accent colours, pure black for dark mode, and a photo behind the timer
  with adjustable dim and blur.

### Data, sync and privacy

- Solves are saved in the browser (localStorage). Works offline once loaded.
- Signed in with Google, solves, sessions, algorithm progress and Trainer times sync between devices.
  Each account's data stays separate on a shared device.
- Settings has a privacy note, Sign out and remove from this device, and Delete account (its cloud data
  and sign-in record).

## Develop

```bash
npm install
npm run dev
```

`npm run build` writes the static site to `dist/`; `npm run preview` serves that build.

## Build and deploy

The app is live at **https://rc-cube-timer.web.app** (Firebase Hosting, project `cube-timer-72686`,
site `rc-cube-timer`; set in `.firebaserc` and `firebase.json`). Deploying needs the Firebase CLI to be
signed in once on this computer:

```bash
npx firebase-tools@14.9.0 login
```

Then, to check, build and deploy everything in one go:

```bash
npm run deploy
```

That runs these steps, which you can also run one at a time:

```bash
npm run check:algs
```

```bash
npm run lint
```

```bash
npm run build
```

```bash
npx firebase-tools@14.9.0 deploy --only hosting,firestore:rules
```

- `check:algs` checks every algorithm on a cube model (see below).
- `build` type-checks and writes the site to `dist/`, including the service worker for offline use.
- `deploy --only hosting` uploads `dist/`; `firestore:rules` uploads `firestore.rules` (only needed when
  the rules change, but harmless otherwise).

The build reads the Firebase config from `.env.local`; without it the app builds fine but hides sign-in.
An installed copy on a phone picks up a new deploy the next time it's opened (close and reopen it if it
still shows the old version).

## Algorithms

Algorithm lists live in `scripts/algs-source.txt` (most popular first). To rebuild `src/lib/algs.ts`
from it and check the result:

```bash
node scripts/build-algs.ts
```

```bash
npm run check:algs
```

F2L and COLL algorithms are found by search on the cube model and written to `src/lib/algsF2L.ts` and
`src/lib/algsCOLL.ts` (slow: tens of minutes for COLL):

```bash
node scripts/find-algs.ts f2l
```

```bash
node scripts/find-algs.ts coll
```

`build-algs` keeps an algorithm only if it solves the same case as the one already listed for it;
`check:algs` fails if any algorithm breaks the first two layers, solves the wrong case, or a set is
missing or repeats a case.

## Install on iPhone

PWAs need HTTPS, so deploy `dist/` first. Firebase Hosting is set up (see below) because Google sign-in
in a home-screen app needs the app and the sign-in handler on the same domain.
Then open the site in Safari, tap Share → **Add to Home Screen**. It launches full screen and works offline.

To try it on your phone before deploying, run `npm run dev -- --host` and open the printed network
address in Safari on the same Wi-Fi. That works for testing, but offline mode needs the HTTPS deploy.

Icons are generated at build time from `public/icon.svg` (see `pwa-assets.config.ts`).

## Google sign-in and sync (Firebase)

Signed in, solves are stored in Firestore (`users/{uid}`) and sync between devices; signed out, the app
works exactly as before with solves kept on the device. Without a Firebase config the sign-in button is hidden.

1. Create a project at https://console.firebase.google.com and add a **Web app**.
2. **Authentication → Sign-in method**: enable **Google**.
3. **Firestore Database**: create a database (production mode).
4. Copy `.env.example` to `.env.local` and fill in the values from Project settings → Your apps.
   Set `VITE_FIREBASE_AUTH_DOMAIN` to the domain you'll open the app on (e.g. `your-project.web.app`),
   so the redirect sign-in used by the iPhone home-screen app stays on the same site.
5. Deploy hosting and the security rules:

```bash
npx firebase-tools@14.9.0 login
```

```bash
npx firebase-tools@14.9.0 use --add
```

```bash
npm run deploy
```

6. On iPhone, open `https://your-project.web.app` in Safari → Share → **Add to Home Screen**.

If you open the app on another domain (or `localhost` for testing), add it under
Authentication → Settings → **Authorized domains**.
