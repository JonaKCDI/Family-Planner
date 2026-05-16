UPDATE "DocumentReference"
SET "linkedEntityType" = 'GENERAL',
    "linkedEntityId" = NULL
WHERE "linkedEntityType" = 'CALENDAR_EVENT';

DO $$
BEGIN
  IF to_regclass('"CalendarSourceVisibility"') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS "CalendarSourceVisibilityArchive_20260514120000" AS TABLE "CalendarSourceVisibility" WITH DATA';
  END IF;
  IF to_regclass('"CalendarEvent"') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS "CalendarEventArchive_20260514120000" AS TABLE "CalendarEvent" WITH DATA';
  END IF;
  IF to_regclass('"CalendarIntegration"') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS "CalendarIntegrationArchive_20260514120000" AS TABLE "CalendarIntegration" WITH DATA';
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'CalendarIntegrationArchive_20260514120000'
        AND column_name = 'encryptedPassword'
    ) THEN
      EXECUTE 'UPDATE "CalendarIntegrationArchive_20260514120000" SET "encryptedPassword" = NULL';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'CalendarIntegrationArchive_20260514120000'
        AND column_name = 'encryptedAccessToken'
    ) THEN
      EXECUTE 'UPDATE "CalendarIntegrationArchive_20260514120000" SET "encryptedAccessToken" = NULL';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'CalendarIntegrationArchive_20260514120000'
        AND column_name = 'encryptedRefreshToken'
    ) THEN
      EXECUTE 'UPDATE "CalendarIntegrationArchive_20260514120000" SET "encryptedRefreshToken" = NULL';
    END IF;
  END IF;
END $$;

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
