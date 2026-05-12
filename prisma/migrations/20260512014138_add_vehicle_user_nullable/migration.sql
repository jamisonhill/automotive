-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "nickname" TEXT,
    "year" INTEGER NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "trim" TEXT,
    "vin" TEXT,
    "engine" TEXT,
    "transmission" TEXT,
    "drivetrain" TEXT,
    "color" TEXT,
    "licensePlate" TEXT,
    "purchaseDate" DATETIME,
    "purchaseMileage" INTEGER,
    "purchasePrice" REAL,
    "photoPath" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Vehicle" ("color", "createdAt", "drivetrain", "engine", "id", "isActive", "licensePlate", "make", "model", "nickname", "notes", "photoPath", "purchaseDate", "purchaseMileage", "purchasePrice", "transmission", "trim", "updatedAt", "vin", "year") SELECT "color", "createdAt", "drivetrain", "engine", "id", "isActive", "licensePlate", "make", "model", "nickname", "notes", "photoPath", "purchaseDate", "purchaseMileage", "purchasePrice", "transmission", "trim", "updatedAt", "vin", "year" FROM "Vehicle";
DROP TABLE "Vehicle";
ALTER TABLE "new_Vehicle" RENAME TO "Vehicle";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
