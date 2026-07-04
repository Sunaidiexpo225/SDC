import { useEffect, useState } from "react";

// Tracks whether the viewport is phone-sized. Kept in sync with the
// `@media (max-width: 768px)` breakpoint used in globals.css so the JS
// layout switches (drawer nav, single-column auth) line up with the CSS
// grid reflows. SSR-safe: renders desktop first, then corrects on mount.
export function useIsMobile(breakpoint = 768): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [breakpoint]);

  return mobile;
}
