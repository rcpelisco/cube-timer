import { useHideTime } from "../hooks/useHideTime";

// The big time on the stage. With "Hide time while solving" on, a running solve shows "Solving"
// instead of the counting clock (inspection still counts down).
export function TimeDisplay({ shown, running }: { shown: string; running: boolean }) {
  const [hide] = useHideTime();
  if (hide && running) return <div className="time time-hidden" aria-live="off">Solving</div>;
  return <div className="time">{shown}</div>;
}
