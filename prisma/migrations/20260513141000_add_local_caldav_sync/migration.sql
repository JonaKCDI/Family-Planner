-- AlterTable
ALTER TABLE "CalendarIntegration"
ADD COLUMN "calendarUrl" TEXT,
ADD COLUMN "username" TEXT,
ADD COLUMN "encryptedPassword" TEXT,
ADD COLUMN "lastSyncError" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_integrationId_externalEventId_key" ON "CalendarEvent"("integrationId", "externalEventId");
