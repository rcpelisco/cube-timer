import { useEffect, useRef, useState } from "react";
import type { TwistyPlayer } from "cubing/twisty";

export type TwistyOptions = NonNullable<ConstructorParameters<typeof TwistyPlayer>[0]>;

// A cubing.js player built from fixed options. With `lazy`, it's only created once it scrolls
// near the screen, so a grid of dozens of cases stays light. cubing/twisty loads on first use.
export function TwistyView({ options, lazy = false, className = "", label }: {
  options: TwistyOptions; lazy?: boolean; className?: string; label: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!lazy);
  const key = JSON.stringify(options);

  useEffect(() => {
    if (visible || !host.current) return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setVisible(true); io.disconnect(); }
    }, { rootMargin: "200px" });
    io.observe(host.current);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let created: TwistyPlayer | null = null;
    import("cubing/twisty").then(({ TwistyPlayer }) => {
      if (cancelled || !host.current) return;
      created = new TwistyPlayer(JSON.parse(key) as TwistyOptions);
      host.current.append(created);
    });
    return () => { cancelled = true; created?.remove(); };
  }, [visible, key]);

  return <div className={`twisty-view ${className}`} ref={host} role="img" aria-label={label} />;
}
