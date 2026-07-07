// DB-backed cache of each account's raw Instagram data. Reading analytics hits
// this table (fast, shared across all serverless instances) instead of calling
// the Graph API live. Entries are refreshed on read when stale and in bulk by
// the cron endpoint, so the Analytics screen almost always serves a warm
// snapshot.

import { prisma } from "./db";
import { fetchInstagramAccountData, type IgAccountData } from "./publishers/instagramInsights";
import { fetchFacebookAccountData } from "./publishers/facebookInsights";

// How long a stored snapshot is considered fresh before a read refreshes it.
export const SNAPSHOT_TTL = 20 * 60 * 1000; // 20 min

function fetchFor(platform: string, externalId: string, token: string): Promise<IgAccountData | null> {
  return platform === "facebook"
    ? fetchFacebookAccountData(externalId, token)
    : fetchInstagramAccountData(externalId, token, 200, 60);
}
// Composite key so an IG account and a FB Page can never collide in the table.
const keyOf = (platform: string, externalId: string) => `${platform}:${externalId}`;

// Return the account's data: a fresh stored snapshot if we have one, otherwise
// fetch from the platform, store it, and return that. If the live fetch fails
// but we have an older snapshot, serve the stale one rather than nothing.
export async function getAccountData(
  externalId: string,
  token: string,
  platform: string,
  maxAgeMs = SNAPSHOT_TTL,
): Promise<IgAccountData | null> {
  const key = keyOf(platform, externalId);
  const row = await prisma.insightSnapshot.findUnique({ where: { externalId: key } });
  if (row && Date.now() - row.fetchedAt.getTime() < maxAgeMs) {
    return row.data as unknown as IgAccountData;
  }
  const fresh = await fetchFor(platform, externalId, token);
  if (fresh) {
    await prisma.insightSnapshot
      .upsert({
        where: { externalId: key },
        create: { externalId: key, data: fresh as unknown as object },
        update: { data: fresh as unknown as object, fetchedAt: new Date() },
      })
      .catch(() => {});
    return fresh;
  }
  return row ? (row.data as unknown as IgAccountData) : null;
}

// Force-refresh one account's snapshot (used by the cron job).
export async function refreshAccount(externalId: string, token: string, platform: string): Promise<boolean> {
  const fresh = await fetchFor(platform, externalId, token);
  if (!fresh) return false;
  const key = keyOf(platform, externalId);
  await prisma.insightSnapshot
    .upsert({
      where: { externalId: key },
      create: { externalId: key, data: fresh as unknown as object },
      update: { data: fresh as unknown as object, fetchedAt: new Date() },
    })
    .catch(() => {});
  return true;
}
