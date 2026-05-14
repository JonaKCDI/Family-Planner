UPDATE "DocumentReference"
SET "linkedEntityType" = 'GENERAL',
    "linkedEntityId" = NULL
WHERE "linkedEntityType" = 'CALENDAR_EVENT';

DROP TABLE IF EXISTS "CalendarSourceVisibility";
DROP TABLE IF EXISTS "CalendarEvent";
DROP TABLE IF EXISTS "CalendarIntegration";

ALTER TYPE "LinkedEntityType" RENAME TO "LinkedEntityType_old";
CREATE TYPE "LinkedEntityType" AS ENUM ('EXPENSE', 'TASK', 'CONTRACT', 'GENERAL');
ALTER TABLE "DocumentReference"
  ALTER COLUMN "linkedEntityType" DROP DEFAULT,
  ALTER COLUMN "linkedEntityType" TYPE "LinkedEntityType" USING "linkedEntityType"::text::"LinkedEntityType",
  ALTER COLUMN "linkedEntityType" SET DEFAULT 'GENERAL';
DROP TYPE "LinkedEntityType_old";

DROP TYPE IF EXISTS "CalendarProvider";
DROP TYPE IF EXISTS "CalendarVisibility";
DROP TYPE IF EXISTS "CalendarSource";
