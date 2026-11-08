import { useEffect, useSyncExternalStore } from "react";
import { timerBgStore } from "../lib/timerBg";

export function useTimerBg() {
  return useSyncExternalStore(timerBgStore.subscribe, timerBgStore.get);
}

// Shows the chosen background while `on` (the timer and trainer pages). The image, dim and blur go
// on <html> as CSS variables, so the page layer and the full-screen solving stage use the same.
export function useTimerBgLayer(on: boolean) {
  const { url, dim, blur } = useTimerBg();
  const show = on && !!url;
  useEffect(() => {
    const root = document.documentElement;
    if (!show) { root.classList.remove("timer-bg"); return; }
    root.classList.add("timer-bg");
    root.style.setProperty("--timer-bg-image", `url("${url}")`);
    root.style.setProperty("--timer-bg-dim", `${dim}%`);
    root.style.setProperty("--timer-bg-blur", blur ? "18px" : "0px");
    return () => root.classList.remove("timer-bg");
  }, [show, url, dim, blur]);
  return show;
}
