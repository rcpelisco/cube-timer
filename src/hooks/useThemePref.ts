import { useSyncExternalStore } from "react";
import { themeStore } from "../lib/theme";

// The current theme choice, shared by every theme control.
export const useThemePref = () => useSyncExternalStore(themeStore.subscribe, themeStore.get);
