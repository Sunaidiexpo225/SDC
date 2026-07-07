import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth, json, error } from "@/lib/api";
import { audit, actorOf } from "@/lib/audit";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const Body = z.object({
  context: z.string().max(200).optional(),
  message: z.string().min(1).max(1000),
});

// Records a browser-side error (e.g. a direct-to-Cloudinary upload that Cloudinary
// rejected) into the audit log so it shows up in Admin → Audit log → Errors, not
// just the browser console. Auth-gated + rate-limited so it can't be used to
// flood the log.
export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

  const actor = actorOf(ctx);
  if (rateLimit(`clienterr:${actor.id ?? "anon"}`, 30, 60_000)) {
    return json({ ok: true }); // silently drop excess
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid body", 400);

  await audit({
    action: "client_error",
    actor,
    target: parsed.data.context || "client",
    detail: parsed.data.message,
    level: "error",
    ip: clientIp(req),
  });
  return json({ ok: true });
}
