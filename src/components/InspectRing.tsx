import type { CSSProperties } from "react";

const R = 46, C = 2 * Math.PI * R;

// A ring around the inspection countdown that empties over the 15 seconds, easier to follow from
// the corner of your eye than the numbers. It's drawn by a CSS animation that starts when the ring
// mounts (with inspection), and takes its colour from the stage: accent, then the 8 s and 12 s
// warning colours, pulsing once you're into the +2 time.
export function InspectRing() {
  return (
    <svg className="insp-ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx={50} cy={50} r={R} className="insp-track" />
      <circle cx={50} cy={50} r={R} className="insp-fill" strokeDasharray={C} transform="rotate(-90 50 50)"
        style={{ "--insp-c": C } as CSSProperties} />
    </svg>
  );
}
