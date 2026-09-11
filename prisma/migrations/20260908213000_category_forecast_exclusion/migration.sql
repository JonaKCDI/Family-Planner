ALTER TABLE "Category" ADD COLUMN "excludeFromForecast" BOOLEAN NOT NULL DEFAULT false;

-- Preserve the previously name-based exclusion once; subsequent changes are explicit.
UPDATE "Category" SET "excludeFromForecast" = true
WHERE "type" = 'EXPENSE' AND lower(trim("name")) = 'auslagen';
