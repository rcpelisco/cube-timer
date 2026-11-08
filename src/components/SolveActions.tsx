import { useEffect, useState } from "react";
import { eff, fmt, type Solve } from "../lib/stats";

// "Copy times" and "Clear solves" (with a second tap to confirm) for the current session.
export function SolveActions({ solves, onClear }: { solves: Solve[]; onClear: () => void }) {
  const [copyLabel, setCopyLabel] = useState("Copy times");
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  const copy = () => {
    const text = solves.map((s, i) => `${i + 1}. ${fmt(eff(s))}${s.pen === 2 ? "+" : ""}   ${s.scr}`).join("\n") || "No solves";
    const done = (msg: string) => { setCopyLabel(msg); setTimeout(() => setCopyLabel("Copy times"), 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => done("Copied"), () => done("Copy blocked"));
    else done("Copy blocked");
  };

  return (
    <>
      <button type="button" onClick={copy}>{copyLabel}</button>
      <button type="button" className={`danger${armed ? " on" : ""}`}
        onClick={() => { if (armed) { setArmed(false); onClear(); } else if (solves.length) setArmed(true); }}>
        {armed ? `Delete ${solves.length} solves?` : "Clear solves"}
      </button>
    </>
  );
}
