UPDATE "Category"
SET "monthlyBudgetCents" = CASE "name"
  WHEN 'Lebensmittel' THEN 50000
  WHEN 'Wohnen' THEN 120000
  WHEN 'Mobilität' THEN 25000
  WHEN 'Freizeit' THEN 20000
  ELSE "monthlyBudgetCents"
END
WHERE "type" = 'EXPENSE'
  AND "monthlyBudgetCents" = 0
  AND "name" IN ('Lebensmittel', 'Wohnen', 'Mobilität', 'Freizeit');
