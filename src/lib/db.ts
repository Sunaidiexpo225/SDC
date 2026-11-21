import { PrismaClient } from "@prisma/client";

// Each serverless instance gets its own Prisma pool, and Prisma sizes it from
// the CPU count (num_cpus * 2 + 1) unless told otherwise — so a handful of warm
// instances can hold dozens of connections. Against a pooler in session mode
// every one of those is a dedicated Postgres connection, which exhausts first
// the pooler and then the database itself. Pin each instance to a single
// connection unless the URL already says otherwise; serverless handlers are
// short-lived and run their queries sequentially, so one is enough.
function databaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }
    // Wait a little for a free connection instead of failing instantly when
    // the instance is briefly busy.
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "20");
    }
    return url.toString();
  } catch {
    // Not a URL we can parse — leave it exactly as configured.
    return raw;
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const url = databaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(url ? { datasources: { db: { url } } } : {}),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
