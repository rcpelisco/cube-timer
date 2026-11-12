// A reminder in the timer's corner that split timing is on, so a press mid-solve marking a phase
// (instead of stopping) isn't a surprise. Shows the phases, e.g. "Cross · F2L · OLL · PLL".
export function SplitsBadge({ names }: { names: string[] }) {
  if (names.length < 2) return null;
  const shown = names.map((n, i) => n.trim() || `Part ${i + 1}`);
  return (
    <div className="splits-badge dimmable" role="note" aria-label={`Split timing on: ${shown.join(", ")}`}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2 8h12M5 5v6M11 5v6" />
      </svg>
      <span>Splits <b>{shown.join(" · ")}</b></span>
    </div>
  );
}
