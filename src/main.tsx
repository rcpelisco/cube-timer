import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "@fontsource-variable/archivo/wght.css";
import "@fontsource-variable/chivo-mono/wght.css";
import App from "./App.tsx";
import { applyTheme, themeStore } from "./lib/theme";
import { watchCspReports } from "./lib/cspReports";
import { loadStored } from "./lib/storage";

// Before anything renders, so a blocked request during start-up is caught too.
watchCspReports();

// Saved Light/Dark choice: index.html already set the colors; this also sets the status-bar color.
applyTheme(themeStore.get());

// Browsers without view transitions (iOS before 18) get a simple fade into focus mode instead.
if (typeof (document as Partial<Document>).startViewTransition !== "function") {
  document.documentElement.classList.add("no-vt");
}

// iOS home-screen app: some iOS versions (26 and 27 so far; WebKit bug 301994) end the app above
// the home indicator and draw a strip of their own below it that the page can't paint, while
// still reporting a bottom safe-area inset. The tab bar would then leave that space empty twice,
// so it drops its home-indicator padding when the app's height falls short of the screen's.
// Upright only: iOS reports the screen's size as if held upright.
const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
if (standalone) {
  const check = () => {
    const upright = innerHeight > innerWidth;
    document.documentElement.classList.toggle("ios-short", upright && screen.height - innerHeight > 20);
  };
  check();
  addEventListener("resize", check);
}

// iOS Safari only applies :active (the press feedback on buttons) once the page listens for touches.
document.addEventListener("touchstart", () => {}, { passive: true });

// Cache the app for offline use and pick up new versions on next launch.
registerSW({ immediate: true });

// Solves are read from IndexedDB first (a few milliseconds), so the app starts with them.
loadStored().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
