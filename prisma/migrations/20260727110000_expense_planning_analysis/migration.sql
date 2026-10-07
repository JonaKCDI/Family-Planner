-- CreateEnum
CREATE TYPE "ExpensePlanningTreatmentType" AS ENUM ('NORMAL', 'FIXED_COST', 'SPECIAL_EFFECT', 'REIMBURSEMENT', 'IGNORE_FOR_PLANNING', 'SAVINGS_INVESTMENT');

-- CreateEnum
CREATE TYPE "ExpensePlanningRulePatternType" AS ENUM ('CATEGORY', 'STORE', 'DESCRIPTION', 'CATEGORY_STORE', 'REIMBURSEMENT_TEXT');

-- CreateTable
CREATE TABLE "ExpensePlanningTreatment" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "expenseId" TEXT,
    "groupKey" TEXT,
    "treatment" "ExpensePlanningTreatmentType" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpensePlanningTreatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpensePlanningRule" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "patternType" "ExpensePlanningRulePatternType" NOT NULL,
    "patternValue" TEXT NOT NULL,
    "categoryId" TEXT,
    "treatment" "ExpensePlanningTreatmentType" NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 70,
    "sourceTreatmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpensePlanningRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpensePlanningTreatment_ownerUserId_expenseId_key" ON "ExpensePlanningTreatment"("ownerUserId", "expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpensePlanningTreatment_ownerUserId_groupKey_key" ON "ExpensePlanningTreatment"("ownerUserId", "groupKey");

-- CreateIndex
CREATE INDEX "ExpensePlanningTreatment_familyId_ownerUserId_idx" ON "ExpensePlanningTreatment"("familyId", "ownerUserId");

-- CreateIndex
CREATE INDEX "ExpensePlanningTreatment_expenseId_idx" ON "ExpensePlanningTreatment"("expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpensePlanningRule_ownerUserId_patternType_patternValue_categoryId_key" ON "ExpensePlanningRule"("ownerUserId", "patternType", "patternValue", "categoryId");

-- CreateIndex
CREATE INDEX "ExpensePlanningRule_familyId_ownerUserId_idx" ON "ExpensePlanningRule"("familyId", "ownerUserId");

-- CreateIndex
CREATE INDEX "ExpensePlanningRule_categoryId_idx" ON "ExpensePlanningRule"("categoryId");

-- AddForeignKey
ALTER TABLE "ExpensePlanningTreatment" ADD CONSTRAINT "ExpensePlanningTreatment_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePlanningTreatment" ADD CONSTRAINT "ExpensePlanningTreatment_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePlanningTreatment" ADD CONSTRAINT "ExpensePlanningTreatment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePlanningRule" ADD CONSTRAINT "ExpensePlanningRule_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePlanningRule" ADD CONSTRAINT "ExpensePlanningRule_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePlanningRule" ADD CONSTRAINT "ExpensePlanningRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePlanningRule" ADD CONSTRAINT "ExpensePlanningRule_sourceTreatmentId_fkey" FOREIGN KEY ("sourceTreatmentId") REFERENCES "ExpensePlanningTreatment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
