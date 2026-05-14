export type AnalyticsExpense = {
  kind: "EXPENSE" | "INCOME";
  amountCents: number;
  date: Date | string;
  category?: { name: string; color: string; monthlyBudgetCents: number } | null;
  label?: { name: string; color: string; budgetCents: number } | null;
};

export type AnalyticsCategory = {
  name: string;
  color: string;
  monthlyBudgetCents: number;
};

export type AnalyticsLabel = {
  name: string;
  color: string;
  budgetCents: number;
};

export type PeriodRow = { label: string; income: number; spending: number; budget: number; saldo: number };

export function sumByKind(entries: AnalyticsExpense[], kind: "EXPENSE" | "INCOME") {
  return entries.filter((entry) => entry.kind === kind).reduce((sum, entry) => sum + entry.amountCents, 0);
}

export function buildCategoryRows(entries: AnalyticsExpense[], categories: AnalyticsCategory[], totalSpending: number, showBudget: boolean) {
  const rows = new Map<string, { amount: number; color: string; category?: AnalyticsCategory }>();
  for (const entry of entries) {
    if (entry.kind !== "EXPENSE") continue;
    const name = entry.category?.name ?? "Ohne Kategorie";
    const current = rows.get(name) ?? { amount: 0, color: entry.category?.color ?? "#6b6f76", category: entry.category ?? undefined };
    current.amount += entry.amountCents;
    rows.set(name, current);
  }
  if (showBudget) {
    for (const category of categories) {
      if (category.monthlyBudgetCents <= 0 || rows.has(category.name)) continue;
      rows.set(category.name, { amount: 0, color: category.color, category });
    }
  }

  return [...rows.entries()].map(([name, row]) => {
    const budget = showBudget ? row.category?.monthlyBudgetCents ?? 0 : 0;
    return {
      name,
      amount: row.amount,
      color: row.color,
      budget,
      remaining: budget - row.amount,
      budgetUsage: budget > 0 ? Math.min(100, (row.amount / budget) * 100) : 0,
      percent: totalSpending > 0 ? (row.amount / totalSpending) * 100 : 0
    };
  }).sort((a, b) => b.amount - a.amount);
}

export function buildLabelRows(entries: AnalyticsExpense[], labels: AnalyticsLabel[]) {
  const rows = new Map<string, { amount: number; color: string; budget: number }>();
  for (const label of labels) rows.set(label.name, { amount: 0, color: label.color, budget: label.budgetCents });
  for (const entry of entries) {
    if (entry.kind !== "EXPENSE" || !entry.label) continue;
    const current = rows.get(entry.label.name) ?? { amount: 0, color: entry.label.color, budget: entry.label.budgetCents };
    current.amount += entry.amountCents;
    rows.set(entry.label.name, current);
  }
  return [...rows.entries()].map(([name, row]) => ({
    name,
    ...row,
    remaining: row.budget - row.amount,
    budgetUsage: row.budget > 0 ? Math.min(100, (row.amount / row.budget) * 100) : 0
  })).filter((row) => row.amount > 0 || row.budget > 0).sort((a, b) => b.amount - a.amount);
}

export function buildPeriodRows(entries: AnalyticsExpense[], categories: AnalyticsCategory[], mode: "month" | "year"): PeriodRow[] {
  const rows = new Map<string, PeriodRow>();
  for (const entry of entries) {
    const date = new Date(entry.date);
    const label = mode === "month" ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : String(date.getFullYear());
    const row = rows.get(label) ?? { label, income: 0, spending: 0, budget: mode === "month" ? monthlyBudget(categories) : 0, saldo: 0 };
    if (entry.kind === "INCOME") row.income += entry.amountCents;
    if (entry.kind === "EXPENSE") row.spending += entry.amountCents;
    row.saldo = row.income - row.spending;
    rows.set(label, row);
  }
  return [...rows.values()].sort((a, b) => b.label.localeCompare(a.label)).slice(0, 12);
}

export function monthlyBudget(categories: AnalyticsCategory[]) {
  return categories.reduce((sum, category) => sum + category.monthlyBudgetCents, 0);
}
