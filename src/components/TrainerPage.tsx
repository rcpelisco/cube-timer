import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction, type CSSProperties } from "react";
import { puzzleOf, SET_LABEL, SETS, type AlgCase, type AlgPuzzle, type AlgSet } from "../lib/algs";
import { mainAlg } from "../lib/algChoice";
import type { AlgPrefs } from "../lib/algPrefs";
import { STATUS_LABEL, STATUS_ORDER, statusOf, type LearnStatus } from "../lib/algStatus";
import { CROSS_COLORS } from "../lib/crossColor";
import { fmt } from "../lib/stats";
import { CROSS_LEVELS, type Drill } from "../lib/drills";
import { DrillRun } from "./TrainerDrill";
import { addTime, caseScramble, caseStats, casesFor, caseWeights, nextCase, type TrainerState } from "../lib/trainer";
import type { useTrainerStore } from "../hooks/useTrainerStore";
import { useTimer } from "../hooks/useTimer";
import { useFocusMode } from "../hooks/useFocusMode";
import type { useAlgPrefs } from "../hooks/useAlgPrefs";
import { CaseDiagram } from "./CaseDiagram";
import { CasePicker } from "./CasePicker";
import { AlgText } from "./AlgText";
import { TimeDisplay } from "./TimeDisplay";

const isTouch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
const COLOR_NAME: Record<string, string> = Object.fromEntries(CROSS_COLORS.map(c => [c.swatch, c.id]));

interface Attempt { c: AlgCase; scramble: string | null; failed?: boolean }

// "Drill my worst": the slowest cases you've tried, a few times each, then a before and after.
const WORST = 5, REPS = 3;
interface Worst { ids: string[]; before: Record<string, number | null>; done: Record<string, number[]> }
interface WorstResult { rows: { c: AlgCase; before: number | null; after: number }[] }
const remaining = (w: Worst) => w.ids.filter(id => w.done[id].length < REPS);

// OLL/PLL trainer: scramble into a random case from the ones you pick, solve it with the timer, and
// see your times per case. The case is only shown after the solve, so recognising it is part of
// the practice.
export function TrainerPage({ prefs: { prefs }, trainer: { store, setStore } }: {
  prefs: ReturnType<typeof useAlgPrefs>; trainer: ReturnType<typeof useTrainerStore>;
}) {
  const { statuses, cross } = prefs;

  const all = casesFor(store.set);
  const puzzle = puzzleOf(store.set);
  const picked = store.picked[store.set] ?? null;
  // Cases with a chosen status; the picker narrows those down to the ones you've picked.
  const byStatus = useMemo(
    () => all.filter(c => store.pool.includes(statusOf(statuses, c.id))),
    [all, store.pool, statuses],
  );
  const pool = useMemo(
    () => (picked ? byStatus.filter(c => picked.includes(c.id)) : byStatus),
    [byStatus, picked],
  );
  const poolKey = `${store.set}|${pool.map(c => c.id).join(",")}|${cross}`;

  const setSet = (set: AlgSet) => setStore(s => ({ ...s, set, drill: null }));
  const setDrill = (drill: Drill) => setStore(s => ({ ...s, drill }));
  // Last layer and cross practice sit with the 3×3 sets.
  const drill = puzzle === "3x3" ? store.drill : null;
  const modes: { id: string; label: string; on: boolean; pick: () => void }[] = [
    ...SETS[puzzle].map(set => ({ id: set, label: SET_LABEL[set], on: !drill && store.set === set, pick: () => setSet(set) })),
    ...(puzzle === "3x3" ? ([["LL", "Last layer"], ["cross", "Cross"]] as const).map(([id, label]) => (
      { id, label, on: drill === id, pick: () => setDrill(id) })) : []),
  ];
  const togglePool = (st: LearnStatus) => setStore(s => ({
    ...s, pool: s.pool.includes(st) ? s.pool.filter(x => x !== st) : [...s.pool, st],
  }));
  const setPicked = (ids: string[] | null) => setStore(s => {
    const next = { ...s.picked };
    if (ids) next[s.set] = ids; else delete next[s.set];
    return { ...s, picked: next };
  });
  return (
    <section className="trainer">
      <div className="trainer-controls dimmable">
        <div className="trainer-sets">
          <div className="view-tabs" role="radiogroup" aria-label="Puzzle">
            {(["3x3", "2x2", "4x4"] as AlgPuzzle[]).map(p => (
              <button key={p} type="button" role="radio" aria-checked={puzzle === p} className={puzzle === p ? "on" : ""}
                onClick={() => { if (p !== puzzle) setSet(SETS[p][0]); }}>{p.replace("x", "×")}</button>
            ))}
          </div>
          <div className="segmented trainer-modes" role="radiogroup" aria-label="What to practise" style={{ "--modes": modes.length } as CSSProperties}>
            {modes.map(m => (
              <button key={m.id} type="button" role="radio" aria-checked={m.on} className={m.on ? "on" : ""}
                onClick={m.pick}>{m.label}</button>
            ))}
          </div>
        </div>
        {drill === "cross" && (
          <div className="trainer-sets">
            <div className="view-tabs" role="radiogroup" aria-label="Cross difficulty">
              {CROSS_LEVELS.map(l => (
                <button key={l.id} type="button" role="radio" aria-checked={store.level === l.id} title={l.note}
                  className={store.level === l.id ? "on" : ""} onClick={() => setStore(s => ({ ...s, level: l.id }))}>{l.label}</button>
              ))}
            </div>
            <label className="trainer-plan">
              <input type="checkbox" className="switch" checked={store.plan} onChange={e => setStore(s => ({ ...s, plan: e.target.checked }))} />
              15 s planning
            </label>
          </div>
        )}
        {!drill && <>
        <div className="status-filter" role="group" aria-label="Cases to practise">
          {STATUS_ORDER.map(st => {
            const n = all.filter(c => statusOf(statuses, c.id) === st).length;
            const on = store.pool.includes(st);
            return (
              <button key={st} type="button" className={`status-${st}${on ? " on" : ""}`} aria-pressed={on} onClick={() => togglePool(st)}>
                <i className="status-dot" aria-hidden="true" />{STATUS_LABEL[st]} <span>{n}</span>
              </button>
            );
          })}
        </div>
        <label className="trainer-plan">
          <input type="checkbox" className="switch" checked={store.focus} onChange={e => setStore(s => ({ ...s, focus: e.target.checked }))} />
          Favour slow cases
        </label>
        {byStatus.length > 0 && (
          <CasePicker cases={byStatus} allIds={all.map(c => c.id)} picked={picked} onChange={setPicked}
            picks={prefs} cross={cross} />
        )}
        </>}
      </div>

      {drill ? (
        <DrillRun drill={drill} level={store.level} plan={store.plan} cross={cross} picks={prefs} times={store.times} setStore={setStore} />
      ) : pool.length === 0 ? (
        <p className="trainer-empty panel">
          {byStatus.length === 0
            ? <>No {puzzle === "3x3" ? "" : `${puzzle.replace("x", "×")} `}{SET_LABEL[store.set]} cases to practise. Turn on a status above, or mark cases as Learning on the Algorithms page.</>
            : <>No cases picked. Open <b>Cases</b> above and choose some.</>}
        </p>
      ) : (
        <TrainerRun pool={pool} poolKey={poolKey} set={store.set} times={store.times} focus={store.focus} setStore={setStore} prefs={prefs} />
      )}
    </section>
  );
}

// The timed part: mounted only while there are cases, so the timer always has its stage.
function TrainerRun({ pool, poolKey, set, times, focus, setStore, prefs }: {
  pool: AlgCase[]; poolKey: string; set: AlgSet; times: TrainerState["times"]; focus: boolean;
  setStore: Dispatch<SetStateAction<TrainerState>>; prefs: AlgPrefs;
}) {
  const { cross, choices, custom } = prefs;
  const crossInfo = CROSS_COLORS.find(c => c.id === cross)!;
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [last, setLast] = useState<{ c: AlgCase; t: number } | null>(null);
  const [worst, setWorstState] = useState<Worst | null>(null);
  const [worstResult, setWorstResult] = useState<WorstResult | null>(null);
  // Kept in a ref too, so picking the next case right after a solve sees the update.
  const worstRef = useRef<Worst | null>(null);
  const setWorst = useCallback((w: Worst | null) => { worstRef.current = w; setWorstState(w); }, []);
  const request = useRef(0);

  const load = useCallback((c: AlgCase | null) => {
    const id = ++request.current;
    if (!c) { setAttempt(null); return; }
    setAttempt({ c, scramble: null });
    // 4×4 parity: set up from the case's first algorithm, as its picture is (your own algorithm
    // may also move top pieces, and only has to fix the parity).
    caseScramble(c.set === "PAR4" ? c.algs[0] : mainAlg(c, { choices, custom }), cross, c.set).then(
      scramble => { if (id === request.current) setAttempt({ c, scramble }); },
      () => { if (id === request.current) setAttempt({ c, scramble: null, failed: true }); },
    );
  }, [choices, custom, cross]);

  // New case whenever the pool (set, statuses, cross color) changes.
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  const poolRef = useRef(pool);
  useEffect(() => { poolRef.current = pool; }, [pool]);
  const timesRef = useRef(times);
  useEffect(() => { timesRef.current = times; }, [times]);
  const focusRef = useRef(focus);
  useEffect(() => { focusRef.current = focus; }, [focus]);
  // The next case: during a worst-cases drill, one of those that still needs reps; otherwise
  // favouring slow and little-practised ones when that's on.
  const pickNext = useCallback((previous?: string, t = timesRef.current) => {
    const p = poolRef.current;
    const w = worstRef.current;
    if (w) { const left = remaining(w); return nextCase(p.filter(c => left.includes(c.id)), previous); }
    return nextCase(p, previous, focusRef.current ? caseWeights(p, t) : undefined);
  }, []);
  // A new pool (set, statuses, picked cases, cross color) ends a drill and starts afresh.
  useEffect(() => { setWorst(null); loadRef.current(pickNext()); }, [poolKey, pickNext, setWorst]);

  const attemptRef = useRef(attempt);
  useEffect(() => { attemptRef.current = attempt; }, [attempt]);
  const onFinish = useCallback((t: number) => {
    const a = attemptRef.current;
    if (!a?.scramble) return;
    setStore(s => ({ ...s, times: { ...s.times, [a.c.id]: addTime(s.times[a.c.id], t) } }));
    setLast({ c: a.c, t });
    const w = worstRef.current;
    if (w?.ids.includes(a.c.id) && w.done[a.c.id].length < REPS) {
      const next = { ...w, done: { ...w.done, [a.c.id]: [...w.done[a.c.id], t] } };
      if (remaining(next).length) setWorst(next);
      else {
        setWorst(null);
        setWorstResult({ rows: next.ids.map(id => ({
          c: poolRef.current.find(c => c.id === id)!, before: next.before[id],
          after: next.done[id].reduce((x, y) => x + y, 0) / next.done[id].length,
        })).filter(r => r.c) });
      }
    }
    // Weighed with this time included, so a slow solve makes the case come up sooner.
    const now = timesRef.current;
    loadRef.current(pickNext(a.c.id, { ...now, [a.c.id]: addTime(now[a.c.id], t) }));
  }, [setStore, pickNext, setWorst]);

  const stageRef = useRef<HTMLDivElement>(null);
  const timer = useTimer({ stageRef, inspection: false, onFinish, enabled: !!attempt?.scramble });
  const active = timer.phase !== "idle";
  useFocusMode(active);

  const deleteLast = () => {
    if (!last) return;
    setStore(s => ({ ...s, times: { ...s.times, [last.c.id]: (s.times[last.c.id] ?? []).slice(0, -1) } }));
    const w = worstRef.current;
    if (w?.done[last.c.id]?.length) setWorst({ ...w, done: { ...w.done, [last.c.id]: w.done[last.c.id].slice(0, -1) } });
    setLast(null);
  };

  // The slowest cases you've tried, by their recent average.
  const tried = pool
    .map(c => ({ c, avg: caseStats(times[c.id]).avg }))
    .filter((r): r is { c: AlgCase; avg: number } => r.avg != null)
    .sort((a, b) => b.avg - a.avg);
  const worstCount = Math.min(WORST, tried.length);
  const canDrill = !worst && tried.length >= 2 && pool.length > 2;
  const startWorst = () => {
    const picks = tried.slice(0, worstCount);
    setWorstResult(null);
    setWorst({
      ids: picks.map(r => r.c.id),
      before: Object.fromEntries(picks.map(r => [r.c.id, r.avg])),
      done: Object.fromEntries(picks.map(r => [r.c.id, []])),
    });
    load(pickNext());
  };
  const stopWorst = () => { setWorst(null); load(pickNext(attempt?.c.id)); };

  const shown = timer.display ?? (last ? fmt(last.t) : "0.00");
  const act = isTouch ? "Touch and hold" : <>Hold <kbd>Space</kbd></>;
  const hint = timer.phase === "running" ? (isTouch ? "Tap to stop" : "Any key to stop") : <>{act} until green, release to start</>;
  const stageClass = ["stage", timer.holding && !timer.ready && "holding", timer.ready && "ready"].filter(Boolean).join(" ");

  // Slowest first, so the cases that need work are at the top.
  const weights = focus && !worst ? caseWeights(pool, times) : null;
  const weightSum = weights ? weights.reduce((a, b) => a + b, 0) : 0;
  const rows = pool
    .map((c, i) => ({ c, ...caseStats(times[c.id]), chance: weights ? weights[i] / weightSum : null }))
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  const lastStats = last ? caseStats(times[last.c.id]) : null;
  const front = COLOR_NAME[crossInfo.faces.F];


  const worstTotal = worst ? worst.ids.length * REPS : 0;
  const worstDone = worst ? worst.ids.reduce((n, id) => n + worst.done[id].length, 0) : 0;

  return (
        <>
          {worst && (
            <div className="panel worst-bar dimmable" role="status">
              <div className="worst-head">
                <b>Drilling your {worst.ids.length} slowest · {worstDone} of {worstTotal}</b>
                <button type="button" className="link-btn" onClick={stopWorst}>Stop</button>
              </div>
              <div className="worst-cases">
                {worst.ids.map(id => {
                  const c = pool.find(x => x.id === id);
                  const n = worst.done[id].length;
                  return c && <span key={id} className={n >= REPS ? "done" : ""}>{c.name} <i>{n}/{REPS}</i></span>;
                })}
              </div>
            </div>
          )}
          {worstResult && !worst && (
            <div className="panel worst-result dimmable">
              <div className="worst-head">
                <h2>Worst cases drill · done</h2>
                <button type="button" className="overlay-close" aria-label="Close" onClick={() => setWorstResult(null)}>✕</button>
              </div>
              <table>
                <thead><tr><th>Case</th><th>Before</th><th>Drill</th><th>Change</th></tr></thead>
                <tbody>
                  {worstResult.rows.map(r => {
                    const d = r.before != null ? r.after - r.before : null;
                    return (
                      <tr key={r.c.id}>
                        <td>{r.c.name}</td><td>{fmt(r.before)}</td><td>{fmt(r.after)}</td>
                        <td className={d == null ? "" : d < 0 ? "faster" : "slower"}>{d == null ? "–" : `${d < 0 ? "−" : "+"}${fmt(Math.abs(d))}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <small>Before is each case's average of 5 when the drill started; Drill is the mean of its {REPS} drill times.</small>
            </div>
          )}
          <div className="scramble dimmable">
            <div className="scramble-text">
              <span className="label">
                {puzzleOf(set) === "3x3" ? "" : `${puzzleOf(set).replace("x", "×")} `}{SET_LABEL[set]} trainer · {pool.length} {pool.length === 1 ? "case" : "cases"} · scramble white top, green front,
                then hold {crossInfo.top} on top{front && front !== "green" ? `, ${front} in front` : ""}
              </span>
              {attempt?.scramble
                ? <span className="moves">{attempt.scramble}</span>
                : attempt?.failed
                  ? <span className="moves pending" role="alert">Couldn't make a scramble for this case.</span>
                  : <span className="moves pending" aria-live="polite">Generating scramble…</span>}
            </div>
            <button type="button" onClick={() => load(pickNext(attempt?.c.id))}>Skip case</button>
          </div>

          <div className={stageClass} ref={stageRef}>
            <TimeDisplay shown={shown} running={timer.phase === "running"} />
            <div className="hint dimmable">{hint}</div>
            <div className="last-actions dimmable">
              {last && !active && <>
                <button type="button" onClick={() => load(last.c)}>Practise {last.c.name} again</button>
                <button type="button" className="danger" onClick={deleteLast}>Delete</button>
              </>}
            </div>
          </div>

          {last && lastStats && (
            <div className="panel trainer-last dimmable">
              <CaseDiagram c={last.c} alg={mainAlg(last.c, prefs)} cross={cross} className="trainer-diagram" />
              <div>
                <h2>Last case</h2>
                <b className="trainer-case">{last.c.name} <span>{fmt(last.t)}</span></b>
                <code className="trainer-alg"><AlgText alg={mainAlg(last.c, prefs)} labels /></code>
                <small>Avg of 5 {fmt(lastStats.avg)} · best {fmt(lastStats.best)} · {lastStats.reps} {lastStats.reps === 1 ? "time" : "times"}</small>
              </div>
            </div>
          )}

          <div className="panel trainer-stats dimmable">
            <div className="worst-head">
              <h2>Your cases · slowest first</h2>
              {canDrill && <button type="button" className="link-btn" onClick={startWorst}
                title={`The ${worstCount} slowest cases you've tried, ${REPS} times each`}>Drill my worst {worstCount}</button>}
            </div>
            <table>
              <thead><tr><th>Case</th><th>Avg 5</th><th>Best</th><th>Times</th>{weights && <th title="How likely the case is to come up next">Odds</th>}</tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.c.id} className={[r.reps ? "" : "untried", worst?.ids.includes(r.c.id) ? "drilling" : ""].filter(Boolean).join(" ") || undefined}>
                    <td>{r.c.name}</td><td>{fmt(r.avg)}</td><td>{fmt(r.best)}</td><td>{r.reps}</td>
                    {r.chance != null && <td className="odds">{r.chance >= 0.095 ? Math.round(r.chance * 100) : (r.chance * 100).toFixed(1)}%</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
  );
}
