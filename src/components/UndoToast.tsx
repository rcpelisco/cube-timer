import { useEffect } from "react";
import type { Undo } from "../lib/solveEdits";

const SHOW_MS = 8000;

// "Deleted 12.34 · Undo" after a delete or move, for a few seconds. Ctrl/⌘+Z also undoes it
// (except while typing in a field, where it undoes the typing).
export function UndoToast({ undo, onUndo, onDismiss }: { undo: Undo; onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, SHOW_MS);
    return () => clearTimeout(t);
  }, [undo, onDismiss]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "z") return;
      if ((e.target as Element | null)?.matches?.("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      onUndo();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onUndo]);

  return (
    <div className="undo-toast" role="status">
      <span>{undo.label}</span>
      <button type="button" className="link-btn" onClick={onUndo}>Undo</button>
      <button type="button" className="undo-close" aria-label="Dismiss" onClick={onDismiss}>✕</button>
    </div>
  );
}
