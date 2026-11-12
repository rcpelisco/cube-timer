import { useMemo, useState } from "react";
import {
  ALGS,
  isAlgSet,
  puzzleOf,
  setupFor,
  SET_LABEL,
  SETS,
  type AlgCase,
  type AlgPuzzle,
  type AlgSet,
} from "../lib/algs";
import { CaseDiagram } from "./CaseDiagram";
import { CaseDetail } from "./CaseDetail";
import { AlgText } from "./AlgText";
import { CROSS_COLORS } from "../lib/crossColor";
import { mainAlg } from "../lib/algChoice";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  statusOf,
  type LearnStatus,
} from "../lib/algStatus";
import type { useAlgPrefs } from "../hooks/useAlgPrefs";

const TAB_KEY = "cubeTimer.algTab";

function loadTab(): AlgSet {
  try {
    const v = localStorage.getItem(TAB_KEY);
    return isAlgSet(v) ? v : "OLL";
  } catch {
    return "OLL";
  }
}

const PLACEHOLDER: Record<AlgSet, string> = {
  OLL: "Filter: 21, dot, line…",
  PLL: "Filter: T, J, edges…",
  OLL2: "Filter: sune, H, pi…",
  PBL: "Filter: adj, diag…",
};
const INTRO: Record<AlgSet, string> = {
  OLL: "Orient the last layer: make the top all one color. Gray stickers don't matter for the case.",
  PLL: "Permute the last layer: move the oriented pieces into place.",
  OLL2: "Ortega step 2: with one face solved on the bottom, make the top all one color. Gray stickers don't matter for the case.",
  PBL: "Ortega step 3: both faces are done; swap corners in both layers at once. If the swap is only on the bottom, or diagonal on top and adjacent below, turn the cube over (x2) first.",
};

// Statuses, main algorithms and cross color live in the app (useAlgPrefs) so they can sync.
export function AlgorithmsPage({
  prefs: { prefs, setStatus: setCaseStatus, setMain, setCross },
}: {
  prefs: ReturnType<typeof useAlgPrefs>;
}) {
  const [tab, setTab] = useState<AlgSet>(loadTab);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const { cross, choices, statuses } = prefs;
  const crossInfo = CROSS_COLORS.find((c) => c.id === cross)!;
  // Filters: selected groups (none = all) and a status (null = all).
  const [groupFilter, setGroupFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<LearnStatus | null>(null);

  const choose = (t: AlgSet) => {
    setTab(t);
    setGroupFilter(new Set());
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* ignore */
    }
  };
  const toggleGroup = (g: string) =>
    setGroupFilter((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  const puzzle = puzzleOf(tab);
  const choosePuzzle = (p: AlgPuzzle) => {
    if (p !== puzzle) choose(SETS[p][0]);
  };
  const all = ALGS[tab];
  // Every group in this set, with its cases and how many are learned (for the filter tiles).
  const allGroups = useMemo(() => {
    const byGroup = new Map<string, AlgCase[]>();
    for (const c of all)
      byGroup.set(c.group, [...(byGroup.get(c.group) ?? []), c]);
    return [...byGroup];
  }, [all]);
  const statusCounts = Object.fromEntries(
    STATUS_ORDER.map((s) => [
      s,
      all.filter((c) => statusOf(statuses, c.id) === s).length,
    ]),
  ) as Record<LearnStatus, number>;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allGroups
      .filter(([g]) => groupFilter.size === 0 || groupFilter.has(g))
      .map(
        ([g, cases]) =>
          [
            g,
            cases.filter(
              (c) =>
                (!statusFilter || statusOf(statuses, c.id) === statusFilter) &&
                (!q ||
                  c.name.toLowerCase().includes(q) ||
                  c.group.toLowerCase().includes(q) ||
                  c.name.replace(/\D/g, "") === q),
            ),
          ] as const,
      )
      .filter(([, cases]) => cases.length > 0);
  }, [allGroups, groupFilter, statusFilter, statuses, query]);

  const filtering =
    groupFilter.size > 0 || statusFilter !== null || query.trim() !== "";
  const open = openId ? (all.find((c) => c.id === openId) ?? null) : null;
  // Swiping in the detail view moves through the cases currently shown, in page order.
  const visible = groups.flatMap(([, cases]) => cases);
  const openIndex = open ? visible.findIndex((c) => c.id === open.id) : -1;

  return (
    <section className="algs">
      <div
        className="view-tabs algs-puzzle"
        role="radiogroup"
        aria-label="Puzzle"
      >
        {(["3x3", "2x2"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={puzzle === p}
            className={puzzle === p ? "on" : ""}
            onClick={() => choosePuzzle(p)}
          >
            {p.replace("x", "×")}
          </button>
        ))}
      </div>
      <div className="algs-bar">
        <div className="algs-tabs" role="tablist" aria-label="Algorithm set">
          {SETS[puzzle].map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? "on" : ""}
              onClick={() => choose(t)}
            >
              {SET_LABEL[t]}{" "}
              <span className="algs-count">
                {ALGS[t].filter((c) => statuses[c.id] === "learned").length}/
                {ALGS[t].length}
              </span>
            </button>
          ))}
        </div>
        <input
          id="alg-filter"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={PLACEHOLDER[tab]}
          aria-label="Filter cases"
        />
      </div>

      <div className="group-tiles" role="group" aria-label="Filter by group">
        {allGroups.map(([g, cases]) => {
          const learned = cases.filter(
            (c) => statuses[c.id] === "learned",
          ).length;
          const on = groupFilter.has(g);
          return (
            <button
              key={g}
              type="button"
              className={`group-tile${on ? " on" : ""}`}
              aria-pressed={on}
              onClick={() => toggleGroup(g)}
            >
              <CaseDiagram
                c={cases[0]}
                alg={mainAlg(cases[0], choices)}
                cross={cross}
                className="group-tile-diagram"
              />
              <span className="group-tile-name">{g}</span>
              <span
                className={`group-tile-count${learned === cases.length ? " done" : ""}`}
              >
                {learned}/{cases.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="algs-row">
        <div
          className="status-filter"
          role="radiogroup"
          aria-label="Filter by status"
        >
          <button
            type="button"
            role="radio"
            aria-checked={statusFilter === null}
            className={statusFilter === null ? "on" : ""}
            onClick={() => setStatusFilter(null)}
          >
            All <span>{all.length}</span>
          </button>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={statusFilter === s}
              className={`status-${s}${statusFilter === s ? " on" : ""}`}
              onClick={() => setStatusFilter(statusFilter === s ? null : s)}
            >
              <i className="status-dot" aria-hidden="true" />
              {STATUS_LABEL[s]} <span>{statusCounts[s]}</span>
            </button>
          ))}
        </div>
        {filtering && (
          <button
            type="button"
            className="clear-filters"
            onClick={() => {
              setGroupFilter(new Set());
              setStatusFilter(null);
              setQuery("");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="cross-pick">
        <span className="label" id="cross-label">
          {puzzle === "2x2" ? "First face" : "Cross"}
        </span>
        <div
          className="cross-swatches"
          role="radiogroup"
          aria-labelledby="cross-label"
        >
          {CROSS_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={cross === c.id}
              aria-label={`${c.label} ${puzzle === "2x2" ? "first face" : "cross"}`}
              title={`${c.label} ${puzzle === "2x2" ? "face" : "cross"}, ${c.top} on top`}
              className={cross === c.id ? "on" : ""}
              style={{ background: c.swatch }}
              onClick={() => setCross(c.id)}
            />
          ))}
        </div>
        <span className="cross-note">
          {crossInfo.label} {puzzle === "2x2" ? "face down" : "cross"} ·{" "}
          {crossInfo.top} on top
        </span>
      </div>
      <p className="algs-intro">
        {INTRO[tab]} Tap a case to watch it and set whether you're learning it.
      </p>

      {groups.length === 0 && (
        <p className="algs-empty">
          No {SET_LABEL[tab]} cases match these filters.
        </p>
      )}
      {groups.map(([group, cases]) => (
        <div key={group} className="algs-group">
          <h2>
            {group} <span>{cases.length}</span>
          </h2>
          <div className="algs-grid">
            {cases.map((c) => {
              const alg = mainAlg(c, choices);
              const st = statusOf(statuses, c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`case-card status-${st}`}
                  onClick={() => setOpenId(c.id)}
                >
                  <CaseDiagram c={c} alg={alg} cross={cross} />
                  <span className="case-name">
                    {c.name}
                    {c.algs.length > 1 && (
                      <span className="case-count">{c.algs.length} algs</span>
                    )}
                  </span>
                  {st !== "none" && (
                    <span className="case-status">
                      <i className="status-dot" aria-hidden="true" />
                      {STATUS_LABEL[st]}
                    </span>
                  )}
                  <span className="case-alg">
                    <AlgText alg={alg} />
                  </span>
                  <span className="case-setup">
                    <b>Setup</b> {setupFor(alg)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {open && (
        <CaseDetail
          c={open}
          cross={cross}
          main={mainAlg(open, choices)}
          onChooseMain={(alg) => setMain(open, alg)}
          status={statusOf(statuses, open.id)}
          onStatus={(s) => setCaseStatus(open, s)}
          onClose={() => setOpenId(null)}
          position={
            openIndex >= 0 ? { index: openIndex, total: visible.length } : null
          }
          onPrev={
            openIndex > 0 ? () => setOpenId(visible[openIndex - 1].id) : null
          }
          onNext={
            openIndex >= 0 && openIndex < visible.length - 1
              ? () => setOpenId(visible[openIndex + 1].id)
              : null
          }
        />
      )}
    </section>
  );
}
