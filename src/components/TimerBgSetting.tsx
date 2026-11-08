import { useRef, useState } from "react";
import { timerBgStore } from "../lib/timerBg";
import { useTimerBg } from "../hooks/useTimerBg";

// Settings → Appearance: pick a photo for behind the timer, see a preview with the dim applied,
// and adjust dim and blur.
export function TimerBgSetting() {
  const { url, dim, blur } = useTimerBg();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null);
    try { await timerBgStore.setImage(file); }
    catch { setError("Couldn't use that image. Try a JPEG or PNG."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  };

  return (
    <div className="bg-setting">
      <div className="setting-row">
        <span><b>Timer background</b><small>A photo behind the timer and trainer. Saved on this device only.</small></span>
      </div>
      <div className={`bg-preview${url ? "" : " empty"}`} style={{ ["--dim" as string]: `${dim}%` }}>
        {url ? <><img src={url} alt="" style={blur ? { filter: "blur(6px)", transform: "scale(1.1)" } : undefined} /><span>12.34</span></> : "No background"}
      </div>
      <div className="bg-actions">
        <input ref={input} type="file" accept="image/*" hidden onChange={e => pick(e.target.files?.[0])} />
        <button type="button" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? "Loading…" : url ? "Change photo" : "Choose photo"}
        </button>
        {url && <button type="button" className="danger" onClick={() => timerBgStore.clear()}>Remove</button>}
      </div>
      {error && <p className="account-error" role="alert">{error}</p>}
      {url && <>
        <label className="bg-slider">
          <span>Dim</span>
          <input type="range" min={0} max={85} step={5} value={dim} onChange={e => timerBgStore.setDim(Number(e.target.value))}
            aria-label="Dim the background" />
          <output>{dim}%</output>
        </label>
        <label className="setting-row" htmlFor="opt-bg-blur">
          <span><b>Blur</b><small>Softens busy photos so the time stands out.</small></span>
          <input type="checkbox" className="switch" id="opt-bg-blur" checked={blur} onChange={e => timerBgStore.setBlur(e.target.checked)} />
        </label>
      </>}
    </div>
  );
}
