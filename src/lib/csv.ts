import { DNF, eff, fmt, type Solve } from "./stats";
import { PUZZLES, toPuzzle } from "./puzzles";
import type { Session } from "./sessions";

// Every solve as a CSV file for spreadsheets: one row per solve, oldest first within each session.
// Times are given both as shown (with any penalty, "1:02.34", "DNF") and as plain seconds, so they
// can be charted or averaged.
const HEADER = [
  "Session", "Puzzle", "Cube", "No.", "Date", "Result", "Result (s)", "Time (s)", "Penalty", "Splits (s)", "Scramble", "Note",
];

const seconds = (ms: number) => (ms / 1000).toFixed(2);
const pad = (n: number) => String(n).padStart(2, "0");
// Local time, "2026-11-14 08:18:03": spreadsheets read this as a date and time.
const date = (at: number) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// Quoted when needed. Text that a spreadsheet would run as a formula (starting with = + - @) gets
// a leading apostrophe, which spreadsheets show as plain text.
function cell(v: string, text = false): string {
  const s = text && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(s: Session, v: Solve, i: number): string {
  const e = eff(v);
  return [
    cell(s.name, true),
    cell(PUZZLES[toPuzzle(s.puzzle)].label),
    cell(s.cube ?? "", true),
    String(i + 1),
    date(v.at),
    cell(fmt(e)),
    isFinite(e) ? seconds(e) : "",
    seconds(v.t),
    v.pen === DNF ? "DNF" : v.pen === 2 ? "+2" : "",
    cell(v.sp?.map(seconds).join(" / ") ?? ""),
    cell(v.scr, true),
    cell(v.note ?? "", true),
  ].join(",");
}

export function exportCsv(sessions: Session[]): string {
  const lines = [HEADER.join(",")];
  for (const s of sessions) s.solves.forEach((v, i) => lines.push(row(s, v, i)));
  // The byte-order mark tells Excel the file is UTF-8 (names and notes can have any characters).
  return "﻿" + lines.join("\r\n") + "\r\n";
}
