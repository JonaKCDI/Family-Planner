-- Link fuel entries to optional generated personal expenses and store per-user booking defaults.
ALTER TABLE "Expense" ADD COLUMN "fuelEntryId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "generatedByFuelEntry" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "FuelExpenseSettings" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "autoCreateExpense" BOOLEAN NOT NULL DEFAULT false,
    "defaultCategoryId" TEXT,
    "defaultLabelId" TEXT,
    "defaultPaymentMethod" TEXT NOT NULL DEFAULT '',
    "defaultStore" TEXT NOT NULL DEFAULT '',
    "defaultDescription" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelExpenseSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Expense_fuelEntryId_key" ON "Expense"("fuelEntryId");
CREATE INDEX "Expense_fuelEntryId_idx" ON "Expense"("fuelEntryId");
CREATE UNIQUE INDEX "FuelExpenseSettings_familyId_userId_key" ON "FuelExpenseSettings"("familyId", "userId");
CREATE INDEX "FuelExpenseSettings_defaultCategoryId_idx" ON "FuelExpenseSettings"("defaultCategoryId");
CREATE INDEX "FuelExpenseSettings_defaultLabelId_idx" ON "FuelExpenseSettings"("defaultLabelId");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_fuelEntryId_fkey" FOREIGN KEY ("fuelEntryId") REFERENCES "FuelEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FuelExpenseSettings" ADD CONSTRAINT "FuelExpenseSettings_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FuelExpenseSettings" ADD CONSTRAINT "FuelExpenseSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FuelExpenseSettings" ADD CONSTRAINT "FuelExpenseSettings_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FuelExpenseSettings" ADD CONSTRAINT "FuelExpenseSettings_defaultLabelId_fkey" FOREIGN KEY ("defaultLabelId") REFERENCES "ExpenseLabel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
