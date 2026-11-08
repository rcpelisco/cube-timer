import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// Generates favicon, PWA icons and the 180×180 apple-touch-icon iOS uses on the home screen.
export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: "#131a23" } },
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: "#131a23" } },
  },
  images: ["public/icon.svg"],
});
