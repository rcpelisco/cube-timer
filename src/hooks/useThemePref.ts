import { useSyncExternalStore } from "react";
import { themeStore } from "../lib/theme";

// The current theme choice, shared by every theme control.
export const useThemePref = () => useSyncExternalStore(themeStore.subscribe, themeStore.get);

const darkQuery = () => matchMedia("(prefers-color-scheme: dark)");
const subscribeSystem = (fn: () => void) => {
  const q = darkQuery();
  q.addEventListener("change", fn);
  return () => q.removeEventListener("change", fn);
};

// Whether the app is showing its dark palette: forced Dark, or System on a device in dark mode.
export function useIsDark() {
  const pref = useThemePref();
  const systemDark = useSyncExternalStore(subscribeSystem, () => darkQuery().matches);
  return pref === "dark" || (pref === "system" && systemDark);
}
