import { useCallback, useLayoutEffect, useState } from "react";

// A chart's drawn width in CSS pixels, kept up to date as it resizes. Charts draw in a viewBox
// this wide (and their fixed CSS height tall), so one unit is one pixel: labels keep their true
// shape instead of being stretched to fit, as a fixed-width viewBox with no aspect ratio did.
export function useChartWidth(fallback = 400): [(el: SVGSVGElement | null) => void, number] {
  const [el, setEl] = useState<SVGSVGElement | null>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    if (!el) return;
    const read = () => { const w = Math.round(el.getBoundingClientRect().width); if (w > 0) setWidth(w); };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [useCallback((node: SVGSVGElement | null) => setEl(node), []), width];
}
