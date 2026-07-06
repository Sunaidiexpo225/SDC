import type { NextRequest } from "next/server";

// Lightweight in-memory fixed-window rate limiter for the auth endpoints.
//
// NOTE: state lives in the instance's memory, so on a multi-instance /
// serverless deployment each instance counts independently — this raises the
// bar against brute force but is not a global limit. For strict guarantees,
// back this with a shared store (e.g. Redis or a Postgres counter).
const hits = new Map<string, { count: number; resetAt: number }>();

// Returns true when the caller has exceeded `max` requests in `windowMs`.
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || now > rec.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    // Opportunistic cleanup so the map doesn't grow unbounded.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    return false;
  }
  rec.count += 1;
  return rec.count > max;
}

export function clientIp(req: NextRequest): string {
  // Prefer the platform-set x-real-ip (Vercel sets this to the true client IP
  // and a client can't forge it past the proxy). Fall back to the LAST hop of
  // x-forwarded-for — the entry appended by the trusted proxy — rather than the
  // first, which is attacker-controlled and would let them rotate the rate-limit
  // key on every request.
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "unknown";
}
