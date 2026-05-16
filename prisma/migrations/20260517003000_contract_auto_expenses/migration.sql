ALTER TABLE "Expense" ADD COLUMN "generatedByContract" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Contract" ADD COLUMN "autoCreateExpenses" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contract" ADD COLUMN "expensePaymentDay" INTEGER;

CREATE UNIQUE INDEX "Expense_auto_contract_payment_unique"
  ON "Expense"("ownerUserId", "contractId", "date")
  WHERE "generatedByContract" = true AND "contractId" IS NOT NULL;
