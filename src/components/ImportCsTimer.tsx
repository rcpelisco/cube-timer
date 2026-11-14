import { useRef, useState } from "react";
import { exportCsTimer, type ImportResult } from "../lib/csTimer";
import { exportCsv } from "../lib/csv";
import { PUZZLES } from "../lib/puzzles";
import type { Session } from "../lib/sessions";
import { exportFileName, saveTextFile } from "../lib/saveFile";

const n = (x: number, word: string) => `${x.toLocaleString()} ${word}${x === 1 ? "" : "s"}`;

// Settings card: import a csTimer export file, or export every session as a csTimer file or a CSV.
export function ImportCsTimer({ sessions, onImport }: { sessions: Session[]; onImport: (text: string) => ImportResult }) {
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [exportNote, setExportNote] = useState("");
  const solveCount = sessions.reduce((a, s) => a + s.solves.length, 0);

  const exportFile = async (format: "cstimer" | "csv") => {
    try {
      const saved = format === "csv"
        ? await saveTextFile(exportFileName(undefined, "csv"), exportCsv(sessions), "text/csv")
        : await saveTextFile(exportFileName(), exportCsTimer(sessions));
      if (saved) {
        setExportNote(`Exported ${n(solveCount, "solve")} from ${n(sessions.length, "session")}.`);
      }
    } catch {
      setExportNote("Couldn't export the file.");
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(""); setResult(null);
    try {
      setResult(onImport(await file.text()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = ""; // so picking the same file again still fires
    }
  };

  const total = result?.added.reduce((a, s) => a + s.solves, 0) ?? 0;

  return (
    <div className="panel settings-group">
      <h2>Import &amp; export</h2>
      <div className="setting-row">
        <span>
          <b>From csTimer</b>
          <small>In csTimer, open Export and choose "Export to file", then pick that file here. Each csTimer session becomes a session here; importing the same file again only adds new solves.</small>
        </span>
      </div>
      <input ref={input} type="file" accept=".txt,.json,text/plain,application/json" hidden
        onChange={e => pick(e.target.files?.[0])} />
      <button type="button" className="wide" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Importing…" : "Choose csTimer file"}
      </button>
      {error && <p className="account-error import-error" role="alert">{error}</p>}
      {result && (
        <div className="import-result" role="status">
          <p className="setting-note">
            {result.added.length
              ? <>Imported <b>{n(total, "solve")}</b> into {n(result.added.length, "session")}.</>
              : "Nothing new to import."}
          </p>
          <ul>
            {result.added.map(s => (
              <li key={s.name + s.puzzle}>{s.name} · {PUZZLES[s.puzzle].label} · {s.merged ? "+" : ""}{n(s.solves, "solve")}</li>
            ))}
            {result.skipped.map(s => (
              <li key={"skip" + s.name} className="muted">Skipped {s.name} ({n(s.solves, "solve")}): {s.reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="setting-row export-row">
        <span>
          <b>Export</b>
          <small>Saves all {n(sessions.length, "session")} ({n(solveCount, "solve")}). A csTimer file can be imported into csTimer or this app; a spreadsheet (CSV) file opens in Excel, Numbers or Google Sheets, one row per solve. To export one session as a csTimer file, use the export button on it under Sessions.</small>
        </span>
      </div>
      <div className="export-buttons">
        <button type="button" className="wide" disabled={!solveCount} onClick={() => exportFile("cstimer")}>csTimer file</button>
        <button type="button" className="wide" disabled={!solveCount} onClick={() => exportFile("csv")}>Spreadsheet (CSV)</button>
      </div>
      {exportNote && <p className="setting-note" role="status">{exportNote}</p>}
    </div>
  );
}
