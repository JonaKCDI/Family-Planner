CREATE TYPE "RecurringTransactionStatus" AS ENUM ('ACTIVE', 'PAUSED');

ALTER TABLE "Contract"
  ADD COLUMN "expenseCategoryId" TEXT,
  ADD COLUMN "expenseLabelId" TEXT;

ALTER TABLE "Expense"
  ADD COLUMN "recurringTransactionId" TEXT,
  ADD COLUMN "generatedByRecurringTransaction" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ContractPricePhase" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractPricePhase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecurringTransaction" (
  "id" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "kind" "TransactionKind" NOT NULL DEFAULT 'EXPENSE',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "paymentMethod" TEXT NOT NULL DEFAULT 'Nicht angegeben',
  "store" TEXT NOT NULL DEFAULT '',
  "categoryId" TEXT,
  "labelId" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "nextDueDate" TIMESTAMP(3),
  "status" "RecurringTransactionStatus" NOT NULL DEFAULT 'ACTIVE',
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecurringTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecurringTransactionPricePhase" (
  "id" TEXT NOT NULL,
  "recurringTransactionId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecurringTransactionPricePhase_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ContractPricePhase" (
  "id",
  "contractId",
  "amountCents",
  "currency",
  "billingInterval",
  "validFrom",
  "createdAt",
  "updatedAt"
)
SELECT
  'cphase_' || md5("id"),
  "id",
  "costCents",
  "currency",
  "billingInterval",
  "startDate",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Contract";

CREATE INDEX "Contract_expenseCategoryId_idx" ON "Contract"("expenseCategoryId");
CREATE INDEX "Contract_expenseLabelId_idx" ON "Contract"("expenseLabelId");
CREATE INDEX "ContractPricePhase_contractId_validFrom_idx" ON "ContractPricePhase"("contractId", "validFrom");
CREATE INDEX "RecurringTransaction_familyId_ownerUserId_status_idx" ON "RecurringTransaction"("familyId", "ownerUserId", "status");
CREATE INDEX "RecurringTransaction_categoryId_idx" ON "RecurringTransaction"("categoryId");
CREATE INDEX "RecurringTransaction_labelId_idx" ON "RecurringTransaction"("labelId");
CREATE INDEX "RecurringTransactionPricePhase_recurringTransactionId_validFrom_idx" ON "RecurringTransactionPricePhase"("recurringTransactionId", "validFrom");
CREATE INDEX "Expense_recurringTransactionId_idx" ON "Expense"("recurringTransactionId");

CREATE UNIQUE INDEX "Expense_auto_recurring_payment_unique"
  ON "Expense"("ownerUserId", "recurringTransactionId", "date")
  WHERE "generatedByRecurringTransaction" = true AND "recurringTransactionId" IS NOT NULL;

ALTER TABLE "Contract"
  ADD CONSTRAINT "Contract_expenseCategoryId_fkey"
  FOREIGN KEY ("expenseCategoryId") REFERENCES "Category"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Contract"
  ADD CONSTRAINT "Contract_expenseLabelId_fkey"
  FOREIGN KEY ("expenseLabelId") REFERENCES "ExpenseLabel"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_recurringTransactionId_fkey"
  FOREIGN KEY ("recurringTransactionId") REFERENCES "RecurringTransaction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContractPricePhase"
  ADD CONSTRAINT "ContractPricePhase_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "Contract"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecurringTransaction"
  ADD CONSTRAINT "RecurringTransaction_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "Family"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecurringTransaction"
  ADD CONSTRAINT "RecurringTransaction_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecurringTransaction"
  ADD CONSTRAINT "RecurringTransaction_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecurringTransaction"
  ADD CONSTRAINT "RecurringTransaction_labelId_fkey"
  FOREIGN KEY ("labelId") REFERENCES "ExpenseLabel"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecurringTransactionPricePhase"
  ADD CONSTRAINT "RecurringTransactionPricePhase_recurringTransactionId_fkey"
  FOREIGN KEY ("recurringTransactionId") REFERENCES "RecurringTransaction"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
