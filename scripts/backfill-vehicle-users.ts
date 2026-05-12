#!/usr/bin/env -S npx tsx
/*
 * One-off script to assign all vehicles that have no userId to a specific
 * user. Run once on the prod DB (and on dev if you have legacy data)
 * during the Phase 9d cutover.
 *
 * Usage:
 *   npx tsx scripts/backfill-vehicle-users.ts <userId>
 *
 * To find the userId after signing up the owner account, hit the DB:
 *   npx prisma studio
 *   (or)
 *   sqlite3 prod.db "SELECT id, email FROM User"
 *
 * What it does:
 *   - Counts vehicles with userId IS NULL.
 *   - Updates them all to point at the supplied userId.
 *   - Prints the rowcount and exits.
 *
 * Idempotent: re-running once everything is backfilled is a no-op.
 *
 * After this lands and you've verified two accounts can't see each other's
 * data, run the next migration (9d.3) to make Vehicle.userId NOT NULL so
 * future writes can't accidentally orphan rows.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("Usage: npx tsx scripts/backfill-vehicle-users.ts <userId>");
    process.exit(1);
  }

  // Confirm the target user exists so we don't assign rows to a typo.
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error(`User not found: ${userId}`);
    process.exit(1);
  }

  const orphans = await prisma.vehicle.count({ where: { userId: null } });
  console.log(`Found ${orphans} vehicle(s) with no owner.`);

  if (orphans === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  const result = await prisma.vehicle.updateMany({
    where: { userId: null },
    data: { userId },
  });
  console.log(`Assigned ${result.count} vehicle(s) to ${user.email} (${userId}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
