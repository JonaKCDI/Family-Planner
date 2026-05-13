-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('EXPENSE', 'INCOME');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "kind" "TransactionKind" NOT NULL DEFAULT 'EXPENSE';

-- CreateIndex
CREATE INDEX "Expense_familyId_kind_idx" ON "Expense"("familyId", "kind");
