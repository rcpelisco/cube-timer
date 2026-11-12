import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DNF, eff, fmt, type Solve } from "../lib/stats";
import type { AverageWindow } from "../lib/stats";
import { useLeave } from "../hooks/useLeave";
import { useFlyIn } from "../hooks/useFlyIn";
import { ShareCard } from "./ShareCard";
import type { CardData } from "../lib/shareCard";

// A solve's time as listed in an average: "12.34", "14.34+" for +2, "DNF".
const timeText = (s: Solve) => (s.pen === DNF ? "DNF" : `${fmt(eff(s))}${s.pen === 2 ? "+" : ""}`);

// Long averages (Ao1000 and up) list their solves a page at a time: drawing thousands of rows at
// once holds up the opening by a second or more.
const PAGE = 100, MORE = 500;

const dateText = (at: number) =>
  new Date(at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Full-screen list of the solves behind one average (Mo3, Ao5, Ao12, Ao100), with the times a
// trimmed average leaves out in brackets.
// origin: the tapped value in Statistics. The big value flies up out of it as this opens; closing
// is the usual slide down.
export function AverageDetail({ label, which, win, origin, puzzle, cube, isBest, onClose }: {
  label: string; which: "current" | "best"; win: AverageWindow; origin?: HTMLElement; puzzle?: string; cube?: string;
  isBest?: boolean; // the session's best (a current average can be it too)
  onClose: () => void;
}) {
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [limit, setLimit] = useState(PAGE);
  const valueRef = useRef<HTMLDivElement>(null);
  const { leaving, close } = useLeave(onClose);
  const fly = useFlyIn(origin, valueRef, leaving);
  const [sharing, setSharing] = useState<CardData | null>(null);


  // Esc closes. Space is swallowed so it doesn't arm the timer behind this view. While the share
  // view is open over this one, it handles the keys.
  useEffect(() => {
    if (sharing) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); if (e.type === "keydown") close(); }
      else if (e.code === "Space") { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("keyup", key, true);
    return () => { window.removeEventListener("keydown", key, true); window.removeEventListener("keyup", key, true); };
  }, [close, sharing]);

  const shown = (s: Solve, i: number) => (win.trimmed.has(i) ? `(${timeText(s)})` : timeText(s));
  const first = win.solves[0].at, last = win.solves[win.solves.length - 1].at;

  const copy = () => {
    const text = [
      `${label}: ${fmt(win.value)}`,
      ...win.solves.map((s, i) => `${i + 1}. ${shown(s, i)}   ${s.scr}`),
    ].join("\n");
    const done = (msg: string) => { setCopyLabel(msg); setTimeout(() => setCopyLabel("Copy"), 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => done("Copied"), () => done("Copy blocked"));
    else done("Copy blocked");
  };

  // Up to 12 solves go on the card one by one; a longer average gets a summary instead.
  const share = () => {
    const ok = win.solves.filter(s => s.pen !== DNF).map(eff);
    setSharing({
      kind: puzzle ? `${puzzle} · ${label}` : label,
      value: fmt(win.value),
      badge: which === "best" || isBest ? "Session best" : undefined,
      times: win.solves.length <= 12 ? win.solves.map((s, i) => ({ text: timeText(s), dim: win.trimmed.has(i) })) : undefined,
      note: win.solves.length > 12
        ? `${win.solves.length} solves${ok.length ? ` · fastest ${fmt(Math.min(...ok))} · slowest ${fmt(Math.max(...ok))}` : ""}`
        : undefined,
      date: new Date(last).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }),
      cube,
    });
  };

  return createPortal(
    <div className={`avg-detail${fly && !leaving ? " fly" : ""}${leaving ? " leaving" : ""}`} role="dialog" aria-modal="true" aria-label={`${label} ${which === "best" ? "best" : "current"}`}>
      <div className="avg-detail-inner">
        <div className="avg-detail-head">
          <div>
            <span className="label">{label} · {which === "best" ? "Best" : "Current"}</span>
            <div className="avg-detail-value" ref={valueRef}>{fmt(win.value)}</div>
            <small className="avg-detail-when">
              Solves {win.start + 1}–{win.start + win.solves.length} · {dateText(first)}
              {first !== last && ` – ${new Date(first).toDateString() === new Date(last).toDateString()
                ? new Date(last).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
                : dateText(last)}`}
            </small>
          </div>
          <div className="avg-detail-actions">
            <button type="button" onClick={share}>Share</button>
            <button type="button" onClick={copy}>{copyLabel}</button>
            <button type="button" className="overlay-close" aria-label="Close" onClick={close}>✕</button>
          </div>
        </div>
        {win.trimmed.size > 0 && (
          <p className="setting-note">Times in brackets are the fastest and slowest, left out of the average.</p>
        )}
        <ol className="avg-detail-list">
          {win.solves.slice(0, limit).map((s, i) => (
            <li key={s.at + ":" + i} className={win.trimmed.has(i) ? "trimmed" : ""}>
              <span className="avg-n">{win.start + i + 1}</span>
              <span className={`avg-time${s.pen === DNF ? " dnf" : ""}`}>{shown(s, i)}</span>
              <span className="avg-scr">{s.scr || "—"}</span>
              <span className="avg-date">{dateText(s.at)}</span>
              {s.note && <span className="avg-note">{s.note}</span>}
            </li>
          ))}
        </ol>
        {win.solves.length > limit && (
          <button type="button" className="show-more" onClick={() => setLimit(l => l + MORE)}>
            Show {Math.min(MORE, win.solves.length - limit)} more · {win.solves.length - limit} left
          </button>
        )}
      </div>
      {sharing && <ShareCard data={sharing} onClose={() => setSharing(null)} />}
    </div>,
    document.body,
  );
}
