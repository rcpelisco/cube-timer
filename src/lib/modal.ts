// Whether a popup is open on screen. Pages you leave stay built but hidden (see App.tsx), and a
// popup left open on one stays in the document, hidden with it, so only a visible one counts.
export function modalOpen(): boolean {
  return [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')].some(el => el.getClientRects().length > 0);
}
