import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
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
        // Firebase Hosting serves the Google sign-in handler under /__/; let those requests reach the network.
        navigateFallbackDenylist: [/^\/__\//],
      },
    }),
  ],
});
