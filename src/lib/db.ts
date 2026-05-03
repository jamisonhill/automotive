import { PrismaClient } from "@prisma/client";

/*
 * Prisma client singleton.
 *
 * In dev, Next.js hot-reloads modules, which would create a new PrismaClient
 * on every save and quickly exhaust SQLite connections. Stashing the client
 * on globalThis keeps a single instance across reloads.
 *
 * In production this branch is harmless — the module is loaded once.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
