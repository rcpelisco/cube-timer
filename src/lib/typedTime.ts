import { boolPref } from "./boolPref";
import { DNF, type Penalty } from "./stats";

// Typing in times instead of timing on the page (e.g. from a Stackmat or at a meetup).
export const typingPref = boolPref("cubeTimer.typing", false);

export interface TypedTime { t: number; pen: Penalty }

// How a typed time is read. Returns null if it can't be read.
// - 12.34, 1:02.34, 12. (seconds), or digits only as on csTimer: the last two are hundredths,
//   so 1234 is 12.34 and 10234 is 1:02.34.
// - A + or +2 after it is a +2 (the time typed is without the penalty).
// - DNF on its own, or with the time: DNF(12.34), 12.34 DNF.
export function parseTyped(input: string): TypedTime | null {
  let s = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return null;
  let pen: Penalty = 0;
  const dnf = /^dnf\s*\((.*)\)$/.exec(s) ?? /^dnf\s*(.*)$/.exec(s) ?? /^(.*?)\s*dnf$/.exec(s);
  if (dnf) {
    pen = DNF;
    s = dnf[1].trim();
    if (!s) return { t: 0, pen };
  } else if (/\s*\+2?$/.test(s)) {
    pen = 2;
    s = s.replace(/\s*\+2?$/, "");
  }
  const t = parseClock(s);
  return t == null ? null : { t, pen };
}

const MAX_MS = 10 * 3600 * 1000;

function parseClock(s: string): number | null {
  let ms: number;
  if (/^\d+$/.test(s)) {
    // csTimer style: …mm ss cc
    const d = s.padStart(5, "0");
    const cs = +d.slice(-2), sec = +d.slice(-4, -2), min = +d.slice(0, -4);
    if (sec >= 60) return null;
    ms = (min * 60 + sec) * 1000 + cs * 10;
  } else {
    const m = /^(?:(\d+):)?(\d+(?:\.\d*)?|\.\d+)$/.exec(s);
    if (!m) return null;
    const min = m[1] ? +m[1] : 0, sec = parseFloat(m[2]);
    if (m[1] && sec >= 60) return null;
    // Kept to the hundredth, as timed solves are shown.
    ms = Math.round((min * 60 + sec) * 100) * 10;
  }
  return ms > 0 && ms < MAX_MS ? ms : null;
}
