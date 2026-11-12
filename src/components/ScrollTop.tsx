import { useEffect, useState } from "react";

// A round "back to top" button that shows once a page has been scrolled down more than a screen.
// Phones scroll inside .page-scroll (see App.css); computers scroll the window.
export function ScrollTop({ phone }: { phone: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = phone ? document.querySelector<HTMLElement>(".page-scroll") : null;
    const target: HTMLElement | Window = el ?? window;
    let frame = 0;
    const read = () => {
      frame = 0;
      const top = el ? el.scrollTop : window.scrollY;
      const height = el ? el.clientHeight : window.innerHeight;
      setShow(top > height);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read); };
    read();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => { target.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, [phone]);

  const toTop = () => {
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = phone ? document.querySelector(".page-scroll") : null;
    (el ?? window).scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
  };

  return (
    <button type="button" className={`scroll-top${show ? " on" : ""}`} aria-label="Scroll to top"
      tabIndex={show ? 0 : -1} aria-hidden={!show} onClick={toTop}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" /></svg>
    </button>
  );
}
