import { boolPref } from "./boolPref";

// A short buzz when the timer turns green, at each split and when you stop it, so you can feel
// the timer without looking. Only phones that let web pages vibrate can do it (Android; not
// iPhones, where Safari has no vibration).
export const hapticsPref = boolPref("cubeTimer.haptics", true);
// Desktop Chrome has navigator.vibrate too but does nothing with it, so only touch screens count.
export const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
  && typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

export const BUZZ = { ready: 15, mark: 12, stop: [25, 40, 25] } as const;

export function buzz(pattern: number | readonly number[]) {
  if (!canVibrate || !hapticsPref.get()) return;
  try { navigator.vibrate(pattern as number | number[]); } catch { /* ignore */ }
}
