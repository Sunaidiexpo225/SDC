import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth, json, error } from "@/lib/api";
import { generateCaption } from "@/lib/content";

const Body = z.object({
  lang: z.enum(["en", "ar"]).default("en"),
  tone: z.enum(["punchy", "professional", "friendly"]).default("punchy"),
  index: z.number().int().nonnegative().default(0),
});

// Mock "Generate with AI". In production this route would call an LLM
// (server-side, with the key kept off the client); here it returns
// deterministic sample copy keyed by tone/language/index.
export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid body", 400);
  const { lang, tone, index } = parsed.data;

  return json(generateCaption(lang, tone, index));
}
