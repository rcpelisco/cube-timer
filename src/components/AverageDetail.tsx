import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DNF, eff, fmt, type Solve } from "../lib/stats";
import type { AverageWindow } from "../lib/stats";

// A solve's time as listed in an average: "12.34", "14.34+" for +2, "DNF".
const timeText = (s: Solve) => (s.pen === DNF ? "DNF" : `${fmt(eff(s))}${s.pen === 2 ? "+" : ""}`);

const dateText = (at: number) =>
  new Date(at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Full-screen list of the solves behind one average (Mo3, Ao5, Ao12, Ao100), with the times a
// trimmed average leaves out in brackets.
export function AverageDetail({ label, which, win, onClose }: {
  label: string; which: "current" | "best"; win: AverageWindow; onClose: () => void;
}) {
  const [copyLabel, setCopyLabel] = useState("Copy");

  // Esc closes. Space is swallowed so it doesn't arm the timer behind this view.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); if (e.type === "keydown") onClose(); }
      else if (e.code === "Space") { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("keyup", key, true);
    return () => { window.removeEventListener("keydown", key, true); window.removeEventListener("keyup", key, true); };
  }, [onClose]);

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

  return createPortal(
    <div className="avg-detail" role="dialog" aria-modal="true" aria-label={`${label} ${which === "best" ? "best" : "current"}`}>
      <div className="avg-detail-inner">
        <div className="avg-detail-head">
          <div>
            <span className="label">{label} · {which === "best" ? "Best" : "Current"}</span>
            <div className="avg-detail-value">{fmt(win.value)}</div>
            <small className="avg-detail-when">
              Solves {win.start + 1}–{win.start + win.solves.length} · {dateText(first)}
              {first !== last && ` – ${new Date(first).toDateString() === new Date(last).toDateString()
                ? new Date(last).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
                : dateText(last)}`}
            </small>
          </div>
          <div className="avg-detail-actions">
            <button type="button" onClick={copy}>{copyLabel}</button>
            <button type="button" className="overlay-close" aria-label="Close" onClick={onClose}>✕</button>
          </div>
        </div>
        {win.trimmed.size > 0 && (
          <p className="setting-note">Times in brackets are the fastest and slowest, left out of the average.</p>
        )}
        <ol className="avg-detail-list">
          {win.solves.map((s, i) => (
            <li key={s.at + ":" + i} className={win.trimmed.has(i) ? "trimmed" : ""}>
              <span className="avg-n">{win.start + i + 1}</span>
              <span className={`avg-time${s.pen === DNF ? " dnf" : ""}`}>{shown(s, i)}</span>
              <span className="avg-scr">{s.scr || "—"}</span>
              <span className="avg-date">{dateText(s.at)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>,
    document.body,
  );
}
