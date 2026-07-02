import { currentUsers } from "@/lib/auth";
import { json } from "@/lib/api";

export async function GET() {
  const { session, actingUser } = await currentUsers();
  return json({
    authenticated: !!session,
    userId: session?.uid ?? null,
    actingUserId: actingUser?.id ?? session?.uid ?? null,
  });
}
