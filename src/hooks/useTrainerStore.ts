import { useCallback, useEffect, useState, type SetStateAction } from "react";
import { loadTrainer, saveTrainer, type TrainerState, type TrainerTimes } from "../lib/trainer";

// The Trainer's settings and times for the whole app, so the times sync even while another page
// is showing. Every change to a case's times dates it (timesAt), which is how devices decide whose
// copy of a case wins (mergeTrainerTimes); `replaceTimes` takes a synced copy as-is.
export function useTrainerStore() {
  const [store, setRaw] = useState<TrainerState>(loadTrainer);
  useEffect(() => saveTrainer(store), [store]);

  const setStore = useCallback((action: SetStateAction<TrainerState>) => setRaw(prev => {
    const next = typeof action === "function" ? action(prev) : action;
    if (next.times === prev.times) return next;
    const now = Date.now(), timesAt = { ...next.timesAt };
    for (const k of new Set([...Object.keys(prev.times), ...Object.keys(next.times)])) {
      if (prev.times[k] !== next.times[k]) timesAt[k] = now;
    }
    return { ...next, timesAt };
  }), []);

  const replaceTimes = useCallback(({ times, timesAt }: TrainerTimes) => setRaw(s => ({ ...s, times, timesAt })), []);

  return { store, setStore, replaceTimes };
}
