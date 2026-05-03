-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Baseline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mileageAtBaseline" INTEGER NOT NULL,
    "treadFL" INTEGER,
    "treadFR" INTEGER,
    "treadRL" INTEGER,
    "treadRR" INTEGER,
    "tireBrand" TEXT,
    "tireModel" TEXT,
    "tireDotDate" TEXT,
    "brakePadFront" REAL,
    "brakePadRear" REAL,
    "rotorConditionFront" TEXT,
    "rotorConditionRear" TEXT,
    "batteryAgeMonths" INTEGER,
    "batteryCca" INTEGER,
    "batteryBrand" TEXT,
    "oilCondition" TEXT,
    "coolantCondition" TEXT,
    "brakeFluidCondition" TEXT,
    "transFluidCondition" TEXT,
    "diffFluidCondition" TEXT,
    "powerSteeringCondition" TEXT,
    "beltsCondition" TEXT,
    "hosesCondition" TEXT,
    "knownIssues" TEXT,
    "recentService" TEXT,
    "notes" TEXT,
    CONSTRAINT "Baseline_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OdometerReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "miles" INTEGER NOT NULL,
    "recordedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OdometerReading_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FuelEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "filledAt" DATETIME NOT NULL,
    "odometer" INTEGER NOT NULL,
    "gallons" REAL NOT NULL,
    "pricePerGallon" REAL,
    "totalCost" REAL,
    "octane" INTEGER,
    "station" TEXT,
    "partialFill" BOOLEAN NOT NULL DEFAULT false,
    "missedFill" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "tripMiles" INTEGER,
    "tripMpg" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FuelEntry_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "customLabel" TEXT,
    "performedAt" DATETIME NOT NULL,
    "odometer" INTEGER NOT NULL,
    "partBrand" TEXT,
    "partNumber" TEXT,
    "partCondition" TEXT,
    "supplier" TEXT,
    "warrantyMonths" INTEGER,
    "warrantyMiles" INTEGER,
    "partsCost" REAL,
    "laborCost" REAL,
    "totalCost" REAL,
    "diy" BOOLEAN NOT NULL DEFAULT false,
    "shopName" TEXT,
    "symptoms" TEXT,
    "diagnosis" TEXT,
    "notes" TEXT,
    "receiptPath" TEXT,
    "oilType" TEXT,
    "oilViscosity" TEXT,
    "oilFilterPart" TEXT,
    "resolvedIssueId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServiceEntry_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TireSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "loadIndex" TEXT,
    "speedRating" TEXT,
    "treadwear" INTEGER,
    "installedAt" DATETIME NOT NULL,
    "installMileage" INTEGER NOT NULL,
    "removedAt" DATETIME,
    "removeMileage" INTEGER,
    "removeReason" TEXT,
    "cost" REAL,
    "notes" TEXT,
    CONSTRAINT "TireSet_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TirePressureLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "tireSetId" TEXT,
    "recordedAt" DATETIME NOT NULL,
    "ambientF" REAL,
    "flBefore" REAL,
    "frBefore" REAL,
    "rlBefore" REAL,
    "rrBefore" REAL,
    "flAfter" REAL,
    "frAfter" REAL,
    "rlAfter" REAL,
    "rrAfter" REAL,
    "notes" TEXT,
    CONSTRAINT "TirePressureLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TirePressureLog_tireSetId_fkey" FOREIGN KEY ("tireSetId") REFERENCES "TireSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TreadDepthLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tireSetId" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL,
    "mileage" INTEGER NOT NULL,
    "fl" INTEGER NOT NULL,
    "fr" INTEGER NOT NULL,
    "rl" INTEGER NOT NULL,
    "rr" INTEGER NOT NULL,
    "notes" TEXT,
    CONSTRAINT "TreadDepthLog_tireSetId_fkey" FOREIGN KEY ("tireSetId") REFERENCES "TireSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "serviceType" TEXT,
    "intervalMiles" INTEGER,
    "intervalMonths" INTEGER,
    "lastDoneMiles" INTEGER,
    "lastDoneAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    CONSTRAINT "Reminder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportedMileage" INTEGER,
    "status" TEXT NOT NULL,
    "symptom" TEXT NOT NULL,
    "diagnosis" TEXT,
    "dtcCodes" TEXT,
    "resolvedAt" DATETIME,
    "resolvedServiceEntryId" TEXT,
    "notes" TEXT,
    CONSTRAINT "Issue_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Baseline_vehicleId_key" ON "Baseline"("vehicleId");

-- CreateIndex
CREATE INDEX "OdometerReading_vehicleId_recordedAt_idx" ON "OdometerReading"("vehicleId", "recordedAt");

-- CreateIndex
CREATE INDEX "FuelEntry_vehicleId_filledAt_idx" ON "FuelEntry"("vehicleId", "filledAt");

-- CreateIndex
CREATE INDEX "ServiceEntry_vehicleId_performedAt_idx" ON "ServiceEntry"("vehicleId", "performedAt");

-- CreateIndex
CREATE INDEX "ServiceEntry_vehicleId_serviceType_idx" ON "ServiceEntry"("vehicleId", "serviceType");

-- CreateIndex
CREATE INDEX "ServiceEntry_vehicleId_category_idx" ON "ServiceEntry"("vehicleId", "category");

-- CreateIndex
CREATE INDEX "TireSet_vehicleId_installedAt_idx" ON "TireSet"("vehicleId", "installedAt");

-- CreateIndex
CREATE INDEX "TirePressureLog_vehicleId_recordedAt_idx" ON "TirePressureLog"("vehicleId", "recordedAt");

-- CreateIndex
CREATE INDEX "TreadDepthLog_tireSetId_recordedAt_idx" ON "TreadDepthLog"("tireSetId", "recordedAt");

-- CreateIndex
CREATE INDEX "Reminder_vehicleId_isActive_idx" ON "Reminder"("vehicleId", "isActive");

-- CreateIndex
CREATE INDEX "Issue_vehicleId_status_idx" ON "Issue"("vehicleId", "status");
