# Cube Timer

Speedcubing timer for the 3×3, built as an installable PWA (Vite + React + TypeScript + vite-plugin-pwa).

- Hold Space (or touch and hold) until the time turns green, release to start; any key or tap stops.
- 2×2, 3×3, 4×4 and FTO. Each session is for one puzzle (set when you create it; it can only change
  while the session is empty).
- Random-state scrambles from [cubing.js](https://js.cubing.net/cubing/) (the same method as the WCA's
  TNoodle; FTO isn't a WCA event but uses the same method), generated in a web worker with the next one
  prepared ahead, plus a flat drawing of the scrambled puzzle. If the generator fails, 2×2/3×3/4×4 fall
  back to random-move scrambles and the label says so; FTO shows an error with a retry button.
- Optional 15 s WCA inspection: +2 after 15 s, DNF after 17 s.
- Single, Mo3, Ao5, Ao12, Ao100 with WCA trimming; +2 / DNF / delete per solve.
- Named sessions (e.g. "Main", "One-handed"), each with its own solves and stats. Switch, create, rename
  and delete them from the menu next to the app name.
- Algorithms page: all 57 OLL and 21 PLL cases with diagrams, up to 4 algorithms each (standard first,
  pick your own main), setups, a 3D cube that plays them, group/status filters, Learning/Learned
  status, and a cross-color setting that recolors the diagrams.
- Solves are saved in the browser (localStorage). Works offline once loaded. Signed in with Google, solves,
  sessions, algorithm progress and Trainer times sync between devices.

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

- `check:algs` checks every OLL/PLL algorithm on a cube model (see below).
- `build` type-checks and writes the site to `dist/`, including the service worker for offline use.
- `deploy --only hosting` uploads `dist/`; `firestore:rules` uploads `firestore.rules` (only needed when
  the rules change, but harmless otherwise).

The build reads the Firebase config from `.env.local`; without it the app builds fine but hides sign-in.
An installed copy on a phone picks up a new deploy the next time it's opened (close and reopen it if it
still shows the old version).

## Algorithms (OLL/PLL)

Algorithm lists live in `scripts/algs-source.txt` (most popular first). To rebuild `src/lib/algs.ts`
from it and check the result:

```bash
node scripts/build-algs.ts
```

```bash
npm run check:algs
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
