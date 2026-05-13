-- Add personal expense labels for project/trip-style grouping across categories.
CREATE TABLE "ExpenseLabel" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#16776f',
    "budgetCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseLabel_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Expense" ADD COLUMN "labelId" TEXT;

CREATE UNIQUE INDEX "ExpenseLabel_ownerUserId_name_key" ON "ExpenseLabel"("ownerUserId", "name");
CREATE INDEX "ExpenseLabel_familyId_ownerUserId_idx" ON "ExpenseLabel"("familyId", "ownerUserId");
CREATE INDEX "Expense_labelId_idx" ON "Expense"("labelId");

ALTER TABLE "ExpenseLabel" ADD CONSTRAINT "ExpenseLabel_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseLabel" ADD CONSTRAINT "ExpenseLabel_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "ExpenseLabel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
