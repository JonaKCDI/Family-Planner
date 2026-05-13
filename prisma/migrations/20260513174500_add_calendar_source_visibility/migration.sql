CREATE TABLE "CalendarSourceVisibility" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "sourceCalendarId" TEXT NOT NULL,
    "sourceCalendarName" TEXT NOT NULL,
    "visibilityToFamily" "CalendarVisibility" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarSourceVisibility_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalendarSourceVisibility_integrationId_sourceCalendarId_key" ON "CalendarSourceVisibility"("integrationId", "sourceCalendarId");
CREATE INDEX "CalendarSourceVisibility_integrationId_idx" ON "CalendarSourceVisibility"("integrationId");

ALTER TABLE "CalendarSourceVisibility" ADD CONSTRAINT "CalendarSourceVisibility_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "CalendarIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
