UPDATE "Category"
SET "name" = 'Mobilität',
    "monthlyBudgetCents" = CASE
      WHEN "monthlyBudgetCents" = 0 THEN 25000
      ELSE "monthlyBudgetCents"
    END
WHERE "type" = 'EXPENSE'
  AND "name" IN ('Mobilitaet', 'Mobilitaet');
