import { useEffect, useMemo, useRef, useState } from "react";
import type { TwistyPlayer } from "cubing/twisty";
import { aspectStyle, PUZZLES, type PuzzleId } from "../lib/puzzles";
import { loadNet, netColors, type NetLayout } from "../lib/cubeNet";

// Flat drawing of the scrambled puzzle. Cubes get our own net (rounded stickers with gaps); the
// other puzzles use cubing.js's viewer. Each is sized by its shape (--aspect, width / height). cubing.js loads on first use so it doesn't slow down
// the app's first paint.
export function ScramblePreview({ puzzle, moves, className = "" }: { puzzle: PuzzleId; moves: string | null; className?: string }) {
  const label = `${PUZZLES[puzzle].label} after scramble`;
  const classes = `preview preview-${puzzle}${moves ? "" : " pending"} ${className}`;
  return PUZZLES[puzzle].cube
    ? <CubeNet puzzle={puzzle} moves={moves} className={classes} label={label} />
    : <TwistyNet puzzle={puzzle} moves={moves} className={classes} label={label} />;
}

function CubeNet({ puzzle, moves, className, label }: { puzzle: PuzzleId; moves: string | null; className: string; label: string }) {
  const viewer = PUZZLES[puzzle].viewer;
  const [layout, setLayout] = useState<{ viewer: string; net: NetLayout } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadNet(viewer).then(net => { if (!cancelled) setLayout({ viewer, net }); }, () => {});
    return () => { cancelled = true; };
  }, [viewer]);

  const net = layout?.viewer === viewer ? layout.net : null;
  const colors = useMemo(() => {
    if (!net) return null;
    try { return netColors(net, moves ?? ""); } catch { return net.colors; }
  }, [net, moves]);

  return (
    <div className={className} style={aspectStyle(puzzle)} role="img" aria-label={label}>
      {net && colors && (
        <svg className="cube-net" viewBox={net.viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {net.stickers.map(s => {
            const gap = s.size * 0.07;
            return (
              <rect key={s.id} x={s.x + gap} y={s.y + gap} width={s.size - 2 * gap} height={s.size - 2 * gap}
                rx={s.size * 0.16} fill={colors[s.id]} />
            );
          })}
        </svg>
      )}
    </div>
  );
}

function TwistyNet({ puzzle, moves, className, label }: { puzzle: PuzzleId; moves: string | null; className: string; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<TwistyPlayer | null>(null);

  // A new player per puzzle, made with its puzzle from the start: one made as a 3×3 and switched
  // can end up drawing both.
  useEffect(() => {
    let cancelled = false;
    let created: TwistyPlayer | null = null;
    import("cubing/twisty").then(({ TwistyPlayer }) => {
      if (cancelled || !host.current) return;
      created = new TwistyPlayer({
        puzzle: PUZZLES[puzzle].viewer as TwistyPlayer["puzzle"],
        visualization: "2D",
        background: "none",
        controlPanel: "none",
        hintFacelets: "none",
        viewerLink: "none",
        experimentalDragInput: "none",
      });
      host.current.append(created);
      setPlayer(created);
    });
    return () => { cancelled = true; created?.remove(); setPlayer(null); };
  }, [puzzle]);

  useEffect(() => {
    if (!player) return;
    player.experimentalSetupAlg = moves ?? "";
    player.alg = "";
  }, [player, moves]);

  return <div className={className} style={aspectStyle(puzzle)} ref={host} role="img" aria-label={label} />;
}
