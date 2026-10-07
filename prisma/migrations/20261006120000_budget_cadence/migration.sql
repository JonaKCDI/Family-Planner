CREATE TYPE "BudgetCadence" AS ENUM ('MONTHLY', 'YEARLY', 'ALL_TIME');

ALTER TABLE "Category"
  ADD COLUMN "budgetCadence" "BudgetCadence" NOT NULL DEFAULT 'MONTHLY';

ALTER TABLE "ExpenseLabel"
  ADD COLUMN "budgetCadence" "BudgetCadence" NOT NULL DEFAULT 'ALL_TIME';

ALTER TABLE "FamilyFinanceCategory"
  ADD COLUMN "budgetCadence" "BudgetCadence" NOT NULL DEFAULT 'MONTHLY';

ALTER TABLE "FamilyFinanceLabel"
  ADD COLUMN "budgetCadence" "BudgetCadence" NOT NULL DEFAULT 'ALL_TIME';
