import type { CSSProperties } from "react";
import { ACCENT_ORDER, ACCENTS, accentStore, blackPref, useAccent } from "../lib/accent";
import { useBoolPref } from "../lib/boolPref";
import { setBlack } from "../lib/theme";
import { useIsDark } from "../hooks/useThemePref";

// Settings → Appearance: the accent colour (a row of swatches) and pure black for dark mode.
export function AccentSetting() {
  const accent = useAccent();
  const [black] = useBoolPref(blackPref);
  const dark = useIsDark();
  return (
    <>
      <div className="setting-row stacked theme-setting">
        <span><b>Accent colour</b><small>Tabs, links, inspection, charts, the logo and share cards.</small></span>
        <div className="accent-choice" role="radiogroup" aria-label="Accent colour">
          {ACCENT_ORDER.map(id => (
            <button key={id} type="button" role="radio" aria-checked={accent === id} className={accent === id ? "on" : ""}
              style={{ "--swatch-l": ACCENTS[id].light, "--swatch-d": ACCENTS[id].dark } as CSSProperties}
              onClick={() => accentStore.set(id)}>
              <i aria-hidden="true" />
              {ACCENTS[id].label}
            </button>
          ))}
        </div>
      </div>
      {/* Only does anything in dark mode, so it's greyed out in light mode (kept as set). */}
      <label className={`setting-row${dark ? "" : " off"}`} htmlFor="opt-black">
        <span>
          <b>Pure black</b>
          <small>{dark ? "Black backgrounds in dark mode. Saves battery on OLED screens." : "Only works in dark mode."}</small>
        </span>
        <input type="checkbox" className="switch" id="opt-black" checked={black} disabled={!dark} onChange={e => setBlack(e.target.checked)} />
      </label>
    </>
  );
}
