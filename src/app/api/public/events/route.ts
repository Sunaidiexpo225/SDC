import { prisma } from "@/lib/db";
import { json } from "@/lib/api";
import { ensureSeeded } from "@/lib/seedData";

export const dynamic = "force-dynamic";

// Minimal, unauthenticated list for the landing / login chips
// (names + colours only — no followers, tokens, or counts).
export async function GET() {
  await ensureSeeded();
  const events = await prisma.event.findMany({
    orderBy: { order: "asc" },
    select: { id: true, nameEn: true, nameAr: true, color: true },
  });
  return json({ events });
}
