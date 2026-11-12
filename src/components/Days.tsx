import { useMemo } from "react";
import type { Session } from "../lib/sessions";
import { useDailyTarget } from "../lib/dailyTarget";

const WEEKS = 26, CELL = 14, GAP = 3, LEFT = 28, TOP = 14;
const W = LEFT + WEEKS * CELL, H = TOP + 7 * CELL;
const DAY_MS = 86_400_000;

// A local calendar day as a whole number, so days can be counted and stepped through without
// daylight-saving changes getting in the way.
const dayOf = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS;
const dateOf = (day: number) => { const u = new Date(day * DAY_MS); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()); };

// The days you practised (solves in any session), the last six months as a grid of weeks, plus
// your streak of days in a row. A streak still counts today until the day is over. With a daily
// target set, the days you reached it get a dot.
export function Days({ sessions }: { sessions: Session[] }) {
  const [target] = useDailyTarget();
  const data = useMemo(() => {
    const counts = new Map<number, number>();
    for (const s of sessions) for (const solve of s.solves) {
      const d = dayOf(new Date(solve.at));
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    const today = dayOf(new Date());
    const has = (d: number) => (counts.get(d) ?? 0) > 0;

    let streak = 0;
    for (let d = has(today) ? today : today - 1; has(d); d--) streak++;
    let best = 0, run = 0, prev = -Infinity;
    for (const d of [...counts.keys()].sort((a, b) => a - b)) {
      run = d === prev + 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    }
    let last30 = 0, met30 = 0;
    for (let d = today - 29; d <= today; d++) {
      if (has(d)) last30++;
      if (target && (counts.get(d) ?? 0) >= target) met30++;
    }

    // Weeks start on Monday; the last column is this week.
    const monday = today - ((dateOf(today).getDay() + 6) % 7);
    const first = monday - (WEEKS - 1) * 7;
    let max = 0;
    for (let d = first; d <= today; d++) max = Math.max(max, counts.get(d) ?? 0);
    return { counts, today, first, max, streak, best, last30, met30 };
  }, [sessions, target]);

  const { counts, today, first, max } = data;
  const cells = [];
  const months = [];
  for (let k = 0; first + k <= today; k++) {
    const day = first + k, c = counts.get(day) ?? 0;
    const col = Math.floor(k / 7), row = k % 7;
    const date = dateOf(day);
    const level = c ? Math.min(4, Math.ceil((4 * c) / max)) : 0;
    const met = target > 0 && c >= target;
    const x = LEFT + col * CELL, y = TOP + row * CELL;
    cells.push(
      <g key={day}>
        <rect x={x} y={y} width={CELL - GAP} height={CELL - GAP} rx={2} className={`day-${level}${day === today ? " day-today" : ""}`}>
          <title>{`${date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}: ${c} ${c === 1 ? "solve" : "solves"}${met ? " · target met" : ""}`}</title>
        </rect>
        {met && <circle cx={x + (CELL - GAP) / 2} cy={y + (CELL - GAP) / 2} r={2} className="day-met" pointerEvents="none" />}
      </g>,
    );
    // Month names over the week a month starts in (skipping one too close to the left edge).
    if (row === 0) {
      const end = dateOf(day + 6);
      if ((col === 0 && date.getDate() <= 14) || (col > 0 && end.getDate() <= 7)) {
        const m = col === 0 ? date : end;
        months.push(<text key={`m${col}`} x={LEFT + col * CELL} y={TOP - 4} fontSize={10} fill="var(--muted)">{m.toLocaleDateString(undefined, { month: "short" })}</text>);
      }
    }
  }

  return (
    <>
      <h2><span>Practice days</span><span>{data.last30} of the last 30</span></h2>
      <svg className="days-grid" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Days practised over the last ${WEEKS} weeks. Current streak ${data.streak} days, best ${data.best}.`}>
        {months}
        {["Mon", "Wed", "Fri"].map((d, i) => (
          <text key={d} x={0} y={TOP + i * 2 * CELL + CELL - 5} fontSize={9} fill="var(--muted)">{d}</text>
        ))}
        {cells}
      </svg>
      <div className="legend days-legend">
        <span>Streak <b>{data.streak} {data.streak === 1 ? "day" : "days"}</b></span>
        <span>Best <b>{data.best} {data.best === 1 ? "day" : "days"}</b></span>
        {target > 0 && <span><i className="days-met-key" aria-hidden="true" />Target met <b>{data.met30} of 30</b></span>}
        <span className="days-scale" aria-hidden="true">Less {[0, 1, 2, 3, 4].map(l => <i key={l} className={`day-${l}`} />)} More</span>
      </div>
    </>
  );
}
