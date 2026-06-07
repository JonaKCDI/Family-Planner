-- Add family-shared cars and fuel/odometer entries.
CREATE TABLE "Car" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "name" TEXT NOT NULL,
    "licensePlate" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#16776f',
    "notes" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Car_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FuelEntry" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "odometerKm" INTEGER NOT NULL,
    "litersMilli" INTEGER NOT NULL,
    "costCents" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FuelEntry_carId_odometerKm_key" ON "FuelEntry"("carId", "odometerKm");
CREATE INDEX "Car_familyId_archivedAt_idx" ON "Car"("familyId", "archivedAt");
CREATE INDEX "Car_createdByUserId_idx" ON "Car"("createdByUserId");
CREATE INDEX "FuelEntry_familyId_date_idx" ON "FuelEntry"("familyId", "date");
CREATE INDEX "FuelEntry_carId_date_idx" ON "FuelEntry"("carId", "date");
CREATE INDEX "FuelEntry_createdByUserId_idx" ON "FuelEntry"("createdByUserId");

ALTER TABLE "Car" ADD CONSTRAINT "Car_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Car" ADD CONSTRAINT "Car_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FuelEntry" ADD CONSTRAINT "FuelEntry_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FuelEntry" ADD CONSTRAINT "FuelEntry_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FuelEntry" ADD CONSTRAINT "FuelEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
