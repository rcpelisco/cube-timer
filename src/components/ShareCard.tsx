import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cardFileName, drawCard, type CardData } from "../lib/shareCard";
import { useLeave } from "../hooks/useLeave";

// A preview of the result as an image, and ways to get it out: the share sheet (phones, and
// browsers that have one), saving it as a file, or copying it to paste into a chat.
export function ShareCard({ data, onClose }: { data: CardData; onClose: () => void }) {
  const { leaving, close } = useLeave(onClose);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let gone = false, made: string | null = null;
    drawCard(data).then(blob => {
      if (gone) return;
      made = URL.createObjectURL(blob);
      setFile(new File([blob], cardFileName(data), { type: "image/png" }));
      setUrl(made);
    }, () => { if (!gone) setFailed(true); });
    return () => { gone = true; if (made) URL.revokeObjectURL(made); };
  }, [data]);

  // Esc closes. Space is swallowed so it doesn't arm the timer behind this view.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); if (e.type === "keydown") close(); }
      else if (e.code === "Space") { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("keyup", key, true);
    return () => { window.removeEventListener("keydown", key, true); window.removeEventListener("keyup", key, true); };
  }, [close]);

  const flash = (msg: string) => { setStatus(msg); setTimeout(() => setStatus(""), 1800); };
  const canShare = !!file && !!navigator.canShare?.({ files: [file] });
  const canCopy = !!file && typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;

  const share = async () => {
    if (!file) return;
    try { await navigator.share({ files: [file] }); } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) flash("Couldn't share");
    }
  };
  const save = () => {
    if (!url || !file) return;
    const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
    document.body.append(a); a.click(); a.remove();
  };
  const copy = async () => {
    if (!file) return;
    try { await navigator.clipboard.write([new ClipboardItem({ "image/png": file })]); flash("Copied"); }
    catch { flash("Copy blocked"); }
  };

  return createPortal(
    <div className={`avg-detail share-card${leaving ? " leaving" : ""}`} role="dialog" aria-modal="true" aria-label="Share">
      <div className="avg-detail-inner">
        <div className="avg-detail-head">
          <div>
            <span className="label">Share · {data.kind}</span>
            <small className="avg-detail-when">An image of this result to post or send.</small>
          </div>
          <div className="avg-detail-actions">
            <button type="button" className="overlay-close" aria-label="Close" onClick={close}>✕</button>
          </div>
        </div>
        <div className="share-preview">
          {url ? <img src={url} alt={`${data.kind}: ${data.value}`} />
            : <span className="share-wait">{failed ? "Couldn't make the image." : "Making the image…"}</span>}
        </div>
        <div className="share-actions">
          {canShare && <button type="button" className="share-main" onClick={share}>Share</button>}
          <button type="button" className={canShare ? "" : "share-main"} disabled={!file} onClick={save}>Save image</button>
          {canCopy && <button type="button" disabled={!file} onClick={copy}>Copy image</button>}
          <span className="share-status" role="status">{status}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
