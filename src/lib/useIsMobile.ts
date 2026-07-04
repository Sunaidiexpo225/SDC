import { useEffect, useState } from "react";

// Returns true when ANY of the given media queries currently match.
// SSR-safe: renders the desktop assumption (false) first, corrects on mount.
function useMediaQueries(queries: string[]): boolean {
  const [match, setMatch] = useState(false);

  useEffect(() => {
    const mqls = queries.map((q) => window.matchMedia(q));
    const sync = () => setMatch(mqls.some((m) => m.matches));
    sync();
    mqls.forEach((m) => m.addEventListener("change", sync));
    return () => mqls.forEach((m) => m.removeEventListener("change", sync));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queries.join("|")]);

  return match;
}

// Phone-sized viewport. Kept in sync with the `@media (max-width: 768px)`
// grid-reflow layer in globals.css. Drives the single-column auth/marketing
// switches.
export function useIsMobile(breakpoint = 768): boolean {
  return useMediaQueries([`(max-width: ${breakpoint}px)`]);
}

// "Compact shell" — when the app chrome should collapse the sidebar into a
// hamburger drawer instead of a fixed rail. True for phones, for tablets held
// in portrait (an iPad in portrait doesn't have room for a 224px rail + the
// dashboard grids), and for short landscape screens (phones on their side).
// Tablets in landscape and real desktops keep the rail.
export function useCompactShell(): boolean {
  return useMediaQueries([
    "(max-width: 768px)",
    "(max-width: 1024px) and (orientation: portrait)",
    "(max-height: 520px)",
  ]);
}
