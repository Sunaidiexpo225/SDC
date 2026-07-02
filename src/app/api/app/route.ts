import { loadAppData, requireAuth, error } from "@/lib/api";
import { json } from "@/lib/api";

// Full application snapshot for the signed-in client.
export async function GET() {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  return json(await loadAppData());
}
