import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

// The headers Firebase Hosting sends on every page (firebase.json), so `vite preview` serves the
// built app under the same security policy (the Content Security Policy included): what would be
// blocked on the live site is blocked there too, and listed at the bottom of Settings.
function hostingHeaders(): Record<string, string> {
  const hosting = JSON.parse(readFileSync(new URL("./firebase.json", import.meta.url), "utf8")).hosting;
  const all = hosting.headers.find((h: { source: string }) => h.source === "**")?.headers ?? [];
  return Object.fromEntries((all as { key: string; value: string }[]).map(({ key, value }) => [key, value]));
}

// Writes licenses.txt next to the app: the license of every package bundled into it (found from
// the modules in the build), plus the cubing.js worker and the service worker's Workbox, which
// are built separately. Their licenses ask for their notices to go along with the code.
function licenses(): Plugin {
  const fromIds = (ids: Iterable<string>) => {
    const names = new Set<string>();
    for (const id of ids) {
      const m = [...id.matchAll(/node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/g)].pop();
      if (m) names.add(m[1].replace(/\\/g, "/"));
    }
    return names;
  };
  return {
    name: "licenses",
    apply: "build",
    generateBundle() {
      const names = fromIds(this.getModuleIds());
      for (const extra of ["cubing", "workbox-core", "workbox-precaching", "workbox-routing", "workbox-window"]) names.add(extra);
      const parts = [...names].sort().map(name => {
        const dir = join("node_modules", name);
        if (!existsSync(join(dir, "package.json"))) return "";
        const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
        const file = readdirSync(dir).find(f => /^licen[cs]e/i.test(f));
        // Some packages (Firebase, cubing.js) ship without a license file: name the license, where
        // its full text is, and where the package's source is.
        const repo = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
        const ids = String(pkg.license ?? "").match(/[A-Za-z0-9.+-]+(?=\s|\)|$)/g)?.filter(x => !/^(OR|AND|WITH)$/.test(x)) ?? [];
        const text = file ? readFileSync(join(dir, file), "utf8").trim()
          : [`License: ${pkg.license ?? "see the package"}`, ...ids.map(x => `Full text: https://spdx.org/licenses/${x}.html`),
            ...(repo ? [`Source: ${repo.replace(/^git\+/, "").replace(/\.git$/, "")}`] : [])].join("\n");
        return `${"=".repeat(72)}\n${name} ${pkg.version} (${pkg.license ?? "?"})\n${"=".repeat(72)}\n\n${text}\n`;
      }).filter(Boolean);
      this.emitFile({
        type: "asset",
        fileName: "licenses.txt",
        source: `Cube Timer includes the following open-source packages.\n\n${parts.join("\n")}`,
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  preview: { headers: hostingHeaders() },
  // cubing.js runs its scramble search in a module worker that lazy-loads more code. Two things keep
  // that worker from loading the app itself (which needs `document` and crashes in a worker):
  // the preload helper gets its own chunk instead of living in the main bundle, and preloading is
  // off so the helper never touches `document`.
  //
  // Libraries the app needs at startup get their own chunks (React, Firebase), so each file stays
  // small and browsers keep them cached when only the app code changes. cubing.js is already
  // loaded on demand and split by Rollup.
  build: {
    modulePreload: false,
    // Two cubing.js chunks are bigger than Vite's default 500 kB warning and can't be split: the
    // solver's WebAssembly (~655 kB, loaded only in the scramble worker) and three.js for the 3D
    // cube (~500 kB, loaded only when you watch an algorithm). Anything over 700 kB still warns.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("vite/preload-helper")) return "preload-helper";
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
          if (/node_modules[\\/](@firebase[\\/](firestore|webchannel-wrapper)|firebase[\\/]firestore)/.test(id)) return "firebase-firestore";
          if (/node_modules[\\/](@?firebase|idb)[\\/]/.test(id)) return "firebase";
        },
      },
    },
  },
  worker: { format: "es" },
  // The dev server's dependency pre-bundling doesn't copy cubing.js's worker entry file,
  // so serve cubing straight from node_modules instead.
  optimizeDeps: { exclude: ["cubing"] },
  plugins: [
    react(),
    licenses(),
    VitePWA({
      registerType: "autoUpdate",
      // index.html has its own light/dark theme-color tags (switched by lib/theme.ts).
      pwaAssets: { config: true, injectThemeColor: false },
      manifest: {
        name: "Cube Timer",
        short_name: "Cube Timer",
        description: "Speedcubing timer with scrambles, inspection and averages.",
        display: "standalone",
        orientation: "portrait",
        background_color: "#131a23",
        theme_color: "#131a23",
        start_url: ".",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // Only the latin font files go in the offline copy; the other subsets load if a character ever needs them.
        globIgnores: ["**/*-{latin-ext,vietnamese,cyrillic,cyrillic-ext,greek,greek-ext}-wght-normal-*.woff2"],
        // Firebase Hosting serves the Google sign-in handler under /__/; let those requests reach the network.
        // The privacy policy and licenses are their own pages, not the app.
        navigateFallbackDenylist: [/^\/__\//, /^\/privacy\.html$/, /^\/licenses\.txt$/],
      },
    }),
  ],
});
