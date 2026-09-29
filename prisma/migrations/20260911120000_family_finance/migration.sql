-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "sharedWithFamily" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "FuelExpenseSettings" ADD COLUMN     "sharedWithFamily" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "expenseSharedWithFamily" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RecurringTransaction" ADD COLUMN     "sharedWithFamily" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FamilyFinanceCategory" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#16776f',
    "icon" TEXT NOT NULL DEFAULT 'tag',
    "monthlyBudgetCents" INTEGER NOT NULL DEFAULT 0,
    "excludeFromForecast" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "FamilyFinanceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyCategoryMapping" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personalId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "FamilyCategoryMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyFinanceLabel" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#16776f',
    "budgetCents" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "FamilyFinanceLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyLabelMapping" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personalId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "FamilyLabelMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FamilyFinanceCategory_familyId_name_key" ON "FamilyFinanceCategory"("familyId", "name");

-- CreateIndex
CREATE INDEX "FamilyCategoryMapping_targetId_idx" ON "FamilyCategoryMapping"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyCategoryMapping_familyId_userId_personalId_key" ON "FamilyCategoryMapping"("familyId", "userId", "personalId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyFinanceLabel_familyId_name_key" ON "FamilyFinanceLabel"("familyId", "name");

-- CreateIndex
CREATE INDEX "FamilyLabelMapping_targetId_idx" ON "FamilyLabelMapping"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyLabelMapping_familyId_userId_personalId_key" ON "FamilyLabelMapping"("familyId", "userId", "personalId");

-- AddForeignKey
ALTER TABLE "FamilyFinanceCategory" ADD CONSTRAINT "FamilyFinanceCategory_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyCategoryMapping" ADD CONSTRAINT "FamilyCategoryMapping_personalId_fkey" FOREIGN KEY ("personalId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyCategoryMapping" ADD CONSTRAINT "FamilyCategoryMapping_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "FamilyFinanceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyFinanceLabel" ADD CONSTRAINT "FamilyFinanceLabel_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyLabelMapping" ADD CONSTRAINT "FamilyLabelMapping_personalId_fkey" FOREIGN KEY ("personalId") REFERENCES "ExpenseLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyLabelMapping" ADD CONSTRAINT "FamilyLabelMapping_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "FamilyFinanceLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Never interpret legacy scope as consent. All explicit sharing starts false.
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_shared_expense_only" CHECK (NOT "sharedWithFamily" OR "kind" = 'EXPENSE');
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_shared_expense_only" CHECK (NOT "sharedWithFamily" OR "kind" = 'EXPENSE');
CREATE INDEX "Expense_family_shared_date_idx" ON "Expense" ("familyId", "sharedWithFamily", "date");
-- Split legacy expense categories, preserving every referenced user's settings.
DO $$
DECLARE c RECORD; u RECORD; clone_id TEXT;
BEGIN
  FOR c IN SELECT * FROM "Category" WHERE "type" = 'EXPENSE' LOOP
    FOR u IN
      SELECT DISTINCT "userId" FROM (
        SELECT "userId" FROM "FamilyMember" WHERE "familyId" = c."familyId" AND c."scope" = 'FAMILY'
        UNION SELECT "ownerUserId" FROM "Expense" WHERE "categoryId" = c.id
        UNION SELECT "ownerUserId" FROM "RecurringTransaction" WHERE "categoryId" = c.id
        UNION SELECT "ownerUserId" FROM "Contract" WHERE "expenseCategoryId" = c.id
        UNION SELECT "userId" FROM "FuelExpenseSettings" WHERE "defaultCategoryId" = c.id
        UNION SELECT "ownerUserId" FROM "ExpensePlanningRule" WHERE "categoryId" = c.id
      ) users WHERE "userId" IS NOT NULL AND "userId" IS DISTINCT FROM c."ownerUserId"
    LOOP
      clone_id := 'fc_' || md5(c.id || ':' || u."userId");
      INSERT INTO "Category" (id, "familyId", "ownerUserId", type, name, color, icon, "monthlyBudgetCents", "excludeFromForecast", scope)
      VALUES (clone_id, c."familyId", u."userId", 'EXPENSE', c.name, c.color, c.icon, c."monthlyBudgetCents", c."excludeFromForecast", 'PRIVATE');
      UPDATE "Expense" SET "categoryId" = clone_id WHERE "categoryId" = c.id AND "ownerUserId" = u."userId";
      UPDATE "RecurringTransaction" SET "categoryId" = clone_id WHERE "categoryId" = c.id AND "ownerUserId" = u."userId";
      UPDATE "Contract" SET "expenseCategoryId" = clone_id WHERE "expenseCategoryId" = c.id AND "ownerUserId" = u."userId";
      UPDATE "FuelExpenseSettings" SET "defaultCategoryId" = clone_id WHERE "defaultCategoryId" = c.id AND "userId" = u."userId";
      UPDATE "ExpensePlanningRule" SET "patternValue" = CASE
        WHEN "patternType" = 'CATEGORY' THEN clone_id
        WHEN "patternType" = 'CATEGORY_STORE' THEN clone_id || substring("patternValue" FROM length(c.id) + 1)
        ELSE "patternValue" END, "categoryId" = clone_id WHERE "categoryId" = c.id AND "ownerUserId" = u."userId";
      UPDATE "ExpensePlanningTreatment" SET "groupKey" = 'category:' || clone_id || substring("groupKey" FROM length('category:' || c.id) + 1)
        WHERE "ownerUserId" = u."userId" AND "familyId" = c."familyId" AND left("groupKey", length('category:' || c.id || ':')) = 'category:' || c.id || ':';
    END LOOP;
    UPDATE "Category" SET scope = 'PRIVATE' WHERE id = c.id;
  END LOOP;
END $$;
