import { memo, useEffect, useMemo, useState } from "react";
import type { Session } from "../lib/sessions";
import { useDailyTarget } from "../lib/dailyTarget";

const R = 15, C = 2 * Math.PI * R;

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

// Today's solves (in every session) against your daily target, as a ring in the corner of the
// timer that fills as you go and gets a tick once you're there. Nothing shows without a target.
export const TodayRing = memo(function TodayRing({ sessions }: { sessions: Session[] }) {
  const [target] = useDailyTarget();
  // Moves on to a new day at midnight even if the page stays open.
  const [dayStart, setDayStart] = useState(startOfToday);
  useEffect(() => {
    const next = new Date(dayStart); next.setDate(next.getDate() + 1);
    const id = setTimeout(() => setDayStart(startOfToday()), next.getTime() - Date.now() + 1000);
    return () => clearTimeout(id);
  }, [dayStart]);

  // Solves are kept oldest first, so each session is read back from its newest solve to the
  // first one from before today.
  const done = useMemo(() => {
    let n = 0;
    for (const { solves } of sessions) for (let i = solves.length - 1; i >= 0 && solves[i].at >= dayStart; i--) n++;
    return n;
  }, [sessions, dayStart]);

  if (!target) return null;
  const met = done >= target;
  const left = target - done;
  return (
    <div className={`today-ring dimmable${met ? " met" : ""}`} role="img"
      aria-label={met ? `Daily target met: ${done} solves today` : `${done} of ${target} solves today, ${left} to go`}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle cx={18} cy={18} r={R} className="ring-track" />
        <circle cx={18} cy={18} r={R} className="ring-fill"
          strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, done / target))} transform="rotate(-90 18 18)" />
        {met && <path d="M12 18.5l4 4 8-9" className="ring-tick" />}
      </svg>
      <span><b>{done}</b>/{target}<small>{met ? "done today" : "today"}</small></span>
    </div>
  );
});
