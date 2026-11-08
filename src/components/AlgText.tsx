import { Fragment } from "react";
import { splitTriggers } from "../lib/triggers";
import { useShowTriggers } from "../hooks/useShowTriggers";

// An algorithm with its triggers marked: each trigger is a colored chunk, named underneath when
// `labels` is on (detail views) or in a tooltip otherwise (small cards). Turned off in Settings,
// it's the plain algorithm.
export function AlgText({ alg, labels = false }: { alg: string; labels?: boolean }) {
  const [show] = useShowTriggers();
  if (!show) return <>{alg}</>;
  return (
    <span className={`alg-text${labels ? " labelled" : ""}`}>
      {splitTriggers(alg).map((p, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          {p.trigger ? (
            <span className={`trig trig-${p.trigger.family}`} title={labels ? undefined : p.trigger.name}>
              <span className="trig-moves">{p.moves}</span>
              {labels && <span className="trig-name">{p.trigger.name}</span>}
            </span>
          ) : <span className="trig-loose">{p.moves}</span>}
        </Fragment>
      ))}
    </span>
  );
}
