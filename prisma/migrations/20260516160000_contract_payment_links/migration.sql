-- Link personal expenses to contracts and store yearly cancellation deadlines.
ALTER TABLE "Expense" ADD COLUMN "contractId" TEXT;

ALTER TABLE "Contract" ADD COLUMN "cancellationDeadlineMonth" INTEGER;
ALTER TABLE "Contract" ADD COLUMN "cancellationDeadlineDay" INTEGER;

CREATE INDEX "Expense_contractId_idx" ON "Expense"("contractId");

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "Contract"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
