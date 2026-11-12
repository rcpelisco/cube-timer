import { useSyncExternalStore } from "react";
import { useHideTime } from "../hooks/useHideTime";
import { liveTime } from "../hooks/useTimer";

// The big time on the stage. While a solve runs it reads the live clock itself (see liveTime), so
// only this redraws each frame. With "Hide time while solving" on, a running solve shows "Solving"
// instead of the counting clock (inspection still counts down).
export function TimeDisplay({ shown, running }: { shown: string; running: boolean }) {
  const [hide] = useHideTime();
  if (hide && running) return <div className="time time-hidden" aria-live="off">Solving</div>;
  return running ? <LiveTime /> : <div className="time">{shown}</div>;
}

function LiveTime() {
  const text = useSyncExternalStore(liveTime.subscribe, liveTime.get);
  return <div className="time">{text}</div>;
}
