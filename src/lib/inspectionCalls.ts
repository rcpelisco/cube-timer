import { boolPref } from "./boolPref";

// Spoken calls during inspection, as a WCA judge gives them: "Eight seconds", "Twelve seconds".
export const inspectionCallsPref = boolPref("cubeTimer.inspectionCalls", true);

const synth = () => (typeof speechSynthesis === "undefined" ? null : speechSynthesis);

// iOS only lets a page speak once speech has started inside a tap or key press; the calls come
// from the timer's clock, so say nothing (silently) on the first tap or key to unlock it.
let unlocked = false;
export function unlockSpeech() {
  const s = synth();
  if (unlocked || !s) return;
  unlocked = true;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  s.speak(u);
}

export function callOut(seconds: 8 | 12) {
  const s = synth();
  if (!s) return;
  s.cancel();
  const u = new SpeechSynthesisUtterance(seconds === 8 ? "Eight seconds" : "Twelve seconds");
  u.rate = 1.1;
  s.speak(u);
}
