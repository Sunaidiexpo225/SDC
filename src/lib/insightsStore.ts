// DB-backed cache of each account's raw Instagram data. Reading analytics hits
// this table (fast, shared across all serverless instances) instead of calling
// the Graph API live. Entries are refreshed on read when stale and in bulk by
// the cron endpoint, so the Analytics screen almost always serves a warm
// snapshot.

import { prisma } from "./db";
import {
  fetchInstagramAccountData,
  type IgAccountData,
} from "./publishers/instagramInsights";

// How long a stored snapshot is considered fresh before a read refreshes it.
export const SNAPSHOT_TTL = 20 * 60 * 1000; // 20 min

// Return the account's data: a fresh stored snapshot if we have one, otherwise
// fetch from Instagram, store it, and return that. If the live fetch fails but
// we have an older snapshot, serve the stale one rather than nothing.
export async function getAccountData(
  externalId: string,
  token: string,
  maxAgeMs = SNAPSHOT_TTL,
): Promise<IgAccountData | null> {
  const row = await prisma.insightSnapshot.findUnique({ where: { externalId } });
  if (row && Date.now() - row.fetchedAt.getTime() < maxAgeMs) {
    return row.data as unknown as IgAccountData;
  }
  const fresh = await fetchInstagramAccountData(externalId, token, 200, 60);
  if (fresh) {
    await prisma.insightSnapshot
      .upsert({
        where: { externalId },
        create: { externalId, data: fresh as unknown as object },
        update: { data: fresh as unknown as object, fetchedAt: new Date() },
      })
      .catch(() => {});
    return fresh;
  }
  return row ? (row.data as unknown as IgAccountData) : null;
}

// Force-refresh one account's snapshot (used by the cron job).
export async function refreshAccount(externalId: string, token: string): Promise<boolean> {
  const fresh = await fetchInstagramAccountData(externalId, token, 200, 60);
  if (!fresh) return false;
  await prisma.insightSnapshot
    .upsert({
      where: { externalId },
      create: { externalId, data: fresh as unknown as object },
      update: { data: fresh as unknown as object, fetchedAt: new Date() },
    })
    .catch(() => {});
  return true;
}
