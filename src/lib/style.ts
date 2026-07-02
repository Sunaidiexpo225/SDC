import type { CSSProperties } from "react";

function kebabToCamel(p: string): string {
  return p.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

// Parse a CSS declaration string into a React style object.
// Mirrors the DC runtime's cssToObj so ported markup can keep its inline CSS.
export function s(css: string): CSSProperties {
  const out: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    if (!prop) continue;
    out[prop.startsWith("--") ? prop : kebabToCamel(prop)] = decl.slice(i + 1).trim();
  }
  return out as CSSProperties;
}
