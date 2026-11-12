import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "@fontsource-variable/archivo/wght.css";
import "@fontsource-variable/chivo-mono/wght.css";
import App from "./App.tsx";
import { applyTheme, themeStore } from "./lib/theme";

// Saved Light/Dark choice: index.html already set the colors; this also sets the status-bar color.
applyTheme(themeStore.get());

// Browsers without view transitions (iOS before 18) get a simple fade into focus mode instead.
if (typeof (document as Partial<Document>).startViewTransition !== "function") {
  document.documentElement.classList.add("no-vt");
}

// iOS Safari only applies :active (the press feedback on buttons) once the page listens for touches.
document.addEventListener("touchstart", () => {}, { passive: true });

// Cache the app for offline use and pick up new versions on next launch.
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
