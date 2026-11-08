import type { ReactNode } from "react";
import type { View } from "../hooks/useView";

// Bottom tab bar (phones): Timer, Solves, Algorithms, Settings.
const TABS: { view: View; label: string; icon: ReactNode }[] = [
  {
    view: "timer", label: "Timer",
    icon: <path d="M12 7.5v5l3 2M9.5 2.5h5M12 4.5a8 8 0 1 0 0 16 8 8 0 0 0 0-16z" />,
  },
  {
    view: "solves", label: "Solves",
    icon: <path d="M4 6.5h16M4 12h16M4 17.5h10" />,
  },
  {
    view: "algs", label: "Algorithms",
    icon: <path d="M4.5 4.5h4.5v4.5H4.5zM9.75 4.5h4.5v4.5h-4.5zM15 4.5h4.5v4.5H15zM4.5 9.75h4.5v4.5H4.5zM9.75 9.75h4.5v4.5h-4.5zM15 9.75h4.5v4.5H15zM4.5 15h4.5v4.5H4.5zM9.75 15h4.5v4.5h-4.5zM15 15h4.5v4.5H15z" />,
  },
  {
    view: "settings", label: "Settings",
    icon: <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-.9a7.6 7.6 0 0 0 2.6 1.5l.5 2.5h4l.5-2.5a7.6 7.6 0 0 0 2.6-1.5l2.3.9 2-3.4z" />,
  },
];

export function TabBar({ view, onView }: { view: View; onView: (v: View) => void }) {
  return (
    <nav className="tabbar dimmable" aria-label="Pages">
      {TABS.map(t => {
        // The trainer is part of the Algorithms tab.
        const on = view === t.view || (t.view === "algs" && view === "train");
        return (
        <button key={t.view} type="button" className={on ? "on" : ""} aria-current={on ? "page" : undefined}
          onClick={() => onView(t.view)}>
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
            strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
          <span>{t.label}</span>
        </button>
        );
      })}
    </nav>
  );
}
