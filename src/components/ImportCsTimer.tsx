import { useRef, useState } from "react";
import { exportCsTimer, type ImportResult } from "../lib/csTimer";
import { PUZZLES } from "../lib/puzzles";
import type { Session } from "../lib/sessions";
import { exportFileName, saveTextFile } from "../lib/saveFile";

const n = (x: number, word: string) => `${x.toLocaleString()} ${word}${x === 1 ? "" : "s"}`;

// Settings card: import a csTimer export file, or export every session in the same format.
export function ImportCsTimer({ sessions, onImport }: { sessions: Session[]; onImport: (text: string) => ImportResult }) {
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [exportNote, setExportNote] = useState("");
  const solveCount = sessions.reduce((a, s) => a + s.solves.length, 0);

  const exportFile = async () => {
    try {
      if (await saveTextFile(exportFileName(), exportCsTimer(sessions))) {
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
          {result.tooBigToSync && (
            <p className="account-error import-error">That's a lot of solves: they're saved on this device, but may be too many to sync to your account.</p>
          )}
        </div>
      )}

      <div className="setting-row export-row">
        <span>
          <b>Export</b>
          <small>Saves all {n(sessions.length, "session")} ({n(solveCount, "solve")}) as a csTimer file, which csTimer or this app can import. To export one session, use the export button on it under Sessions.</small>
        </span>
      </div>
      <button type="button" className="wide" disabled={!solveCount} onClick={exportFile}>Export to file</button>
      {exportNote && <p className="setting-note" role="status">{exportNote}</p>}
    </div>
  );
}
