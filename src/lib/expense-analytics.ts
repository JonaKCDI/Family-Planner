export type AnalyticsExpense = {
  kind: "EXPENSE" | "INCOME";
  amountCents: number;
  date: Date | string;
  category?: { id?: string; name: string; color: string; icon?: string | null; monthlyBudgetCents: number } | null;
  label?: { id?: string; name: string; color: string; budgetCents: number } | null;
};

export type AnalyticsCategory = {
  id?: string;
  name: string;
  color: string;
  icon?: string | null;
  monthlyBudgetCents: number;
};

export type AnalyticsLabel = {
  id?: string;
  name: string;
  color: string;
  budgetCents: number;
  lastUsedAt?: Date | string | null;
};

export type PeriodRow = { label: string; income: number; spending: number; budget: number; saldo: number };
export type ExpenseChartDimension = "category" | "label";
export type ExpenseChartMetric = "spending" | "income" | "saldo" | "net";
export type DonutSegment = {
  id?: string;
  name: string;
  color: string;
  value: number;
  percent: number;
  strokeDasharray: string;
  strokeDashoffset: number;
};
export type DominantDonutSegment = DonutSegment & {
  remainingValue: number;
};
export type ExpenseTrendSeries = {
  id?: string;
  name: string;
  color: string;
  total: number;
  points: { period: string; value: number }[];
};
export type ExpenseTrendChart = {
  periods: string[];
  series: ExpenseTrendSeries[];
  maxValue: number;
};
export type CategoryTrendPoint = {
  period: string;
  spending: number;
  income: number;
  saldo: number;
};
export type CategoryTrendChart = {
  categoryId?: string;
  categoryName: string;
  color: string;
  periods: string[];
  points: CategoryTrendPoint[];
  maxValue: number;
  totalSpending: number;
};

export function sumByKind(entries: AnalyticsExpense[], kind: "EXPENSE" | "INCOME") {
  return entries.filter((entry) => entry.kind === kind).reduce((sum, entry) => sum + entry.amountCents, 0);
}

export function buildCategoryRows(entries: AnalyticsExpense[], categories: AnalyticsCategory[], totalSpending: number, showBudget: boolean) {
  const rows = new Map<string, { income: number; spending: number; color: string; icon?: string | null; category?: AnalyticsCategory; id?: string }>();
  for (const entry of entries) {
    const name = entry.category?.name ?? "Ohne Kategorie";
    const current = rows.get(name) ?? {
      income: 0,
      spending: 0,
      color: entry.category?.color ?? "#6b6f76",
      icon: entry.category?.icon,
      category: entry.category ?? undefined,
      id: entry.category?.id
    };
    if (entry.kind === "INCOME") current.income += entry.amountCents;
    if (entry.kind === "EXPENSE") current.spending += entry.amountCents;
    rows.set(name, current);
  }
  if (showBudget) {
    for (const category of categories) {
      if (category.monthlyBudgetCents <= 0 || rows.has(category.name)) continue;
      rows.set(category.name, { income: 0, spending: 0, color: category.color, icon: category.icon, category });
    }
  }

  return [...rows.entries()].map(([name, row]) => {
    const budget = showBudget ? row.category?.monthlyBudgetCents ?? 0 : 0;
    const amount = row.spending;
    const saldo = row.income - row.spending;
    const netConsumption = Math.max(0, row.spending - row.income);
    return {
      id: row.id ?? row.category?.id,
      name,
      amount,
      income: row.income,
      spending: row.spending,
      saldo,
      netConsumption,
      color: row.color,
      icon: row.icon ?? row.category?.icon,
      budget,
      remaining: budget - netConsumption,
      budgetUsage: budget > 0 ? Math.min(100, (netConsumption / budget) * 100) : netConsumption > 0 ? 100 : 0,
      percent: totalSpending > 0 ? (row.spending / totalSpending) * 100 : 0
    };
  }).sort((a, b) => (b.income + b.spending) - (a.income + a.spending));
}

export function buildLabelRows(entries: AnalyticsExpense[], labels: AnalyticsLabel[]) {
  const rows = new Map<string, { income: number; spending: number; color: string; budget: number; neverUsed: boolean; id?: string }>();
  const labelsByName = new Map(labels.map((label) => [label.name, label]));
  for (const label of labels) {
    if (label.lastUsedAt !== null) continue;
    rows.set(label.name, { income: 0, spending: 0, color: label.color, budget: label.budgetCents, neverUsed: true, id: label.id });
  }
  for (const entry of entries) {
    if (!entry.label) continue;
    const configuredLabel = labelsByName.get(entry.label.name);
    const current = rows.get(entry.label.name) ?? {
      income: 0,
      spending: 0,
      color: configuredLabel?.color ?? entry.label.color,
      budget: configuredLabel?.budgetCents ?? entry.label.budgetCents,
      neverUsed: false,
      id: configuredLabel?.id ?? entry.label.id
    };
    if (entry.kind === "INCOME") current.income += entry.amountCents;
    if (entry.kind === "EXPENSE") current.spending += entry.amountCents;
    current.neverUsed = false;
    rows.set(entry.label.name, current);
  }
  return [...rows.entries()].map(([name, row]) => {
    const amount = row.spending;
    const saldo = row.income - row.spending;
    const netConsumption = Math.max(0, row.spending - row.income);
    return {
      id: row.id,
      name,
      amount,
      income: row.income,
      spending: row.spending,
      saldo,
      netConsumption,
      color: row.color,
      budget: row.budget,
      neverUsed: row.neverUsed,
      remaining: row.budget - netConsumption,
      budgetUsage: row.budget > 0 ? Math.min(100, (netConsumption / row.budget) * 100) : netConsumption > 0 ? 100 : 0
    };
  }).filter((row) => row.income > 0 || row.spending > 0 || row.neverUsed).sort((a, b) => (b.income + b.spending) - (a.income + a.spending));
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

export function buildDonutSegments(
  rows: Array<{ id?: string; name: string; color?: string | null; spending: number }>,
  options: { maxSegments?: number } = {}
): DonutSegment[] {
  const maxSegments = clampInteger(options.maxSegments ?? 7, 3, 12);
  const positiveRows = rows
    .filter((row) => row.spending > 0)
    .sort((a, b) => b.spending - a.spending || a.name.localeCompare(b.name, "de"));
  const visibleRows = positiveRows.slice(0, maxSegments);
  const remaining = positiveRows.slice(maxSegments);
  const overflow = remaining.reduce((sum, row) => sum + row.spending, 0);
  const chartRows = overflow > 0
    ? [...visibleRows, { name: "Weitere", color: "#8a9290", spending: overflow }]
    : visibleRows;
  const total = chartRows.reduce((sum, row) => sum + row.spending, 0);
  if (total <= 0) return [];

  let offset = 25;
  return chartRows.map((row, index) => {
    const percent = (row.spending / total) * 100;
    const segment = {
      id: row.id,
      name: row.name,
      color: normalizeChartColor(row.color, index),
      value: row.spending,
      percent,
      strokeDasharray: `${Math.max(0.6, percent)} ${Math.max(0, 100 - percent)}`,
      strokeDashoffset: offset
    };
    offset -= percent;
    return segment;
  });
}

export function formatDonutPercent(percent: number) {
  if (!Number.isFinite(percent) || percent <= 0) return "0%";
  if (percent < 0.5) return "<1%";
  return `${Math.round(percent)}%`;
}

export function findDominantDonutSegment(segments: DonutSegment[], thresholdPercent = 85): DominantDonutSegment | null {
  if (segments.length < 2) return null;
  const [first] = [...segments].sort((a, b) => b.percent - a.percent);
  if (!first || first.percent < thresholdPercent) return null;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return {
    ...first,
    remainingValue: Math.max(0, total - first.value)
  };
}

export function buildExpenseTrendChart(
  entries: AnalyticsExpense[],
  options: {
    dimension: ExpenseChartDimension;
    metric: ExpenseChartMetric;
    months: number;
    topN: number;
    endDate?: Date | string;
  }
): ExpenseTrendChart {
  const months = clampInteger(options.months, 6, 12);
  const topN = clampInteger(options.topN, 3, 8);
  const periods = buildMonthPeriods(entries, months, options.endDate);
  const rows = new Map<string, { id?: string; name: string; color?: string | null; income: number; spending: number; byPeriod: Map<string, { income: number; spending: number }> }>();

  for (const entry of entries) {
    const period = monthKey(entry.date);
    if (!periods.includes(period)) continue;
    const facet = getTrendFacet(entry, options.dimension);
    if (!facet) continue;
    const row = rows.get(facet.name) ?? {
      id: facet.id,
      name: facet.name,
      color: facet.color,
      income: 0,
      spending: 0,
      byPeriod: new Map()
    };
    const bucket = row.byPeriod.get(period) ?? { income: 0, spending: 0 };
    if (entry.kind === "INCOME") {
      row.income += entry.amountCents;
      bucket.income += entry.amountCents;
    }
    if (entry.kind === "EXPENSE") {
      row.spending += entry.amountCents;
      bucket.spending += entry.amountCents;
    }
    row.byPeriod.set(period, bucket);
    rows.set(facet.name, row);
  }

  const series = [...rows.values()]
    .map((row, index) => {
      const points = periods.map((period) => {
        const bucket = row.byPeriod.get(period) ?? { income: 0, spending: 0 };
        return { period, value: metricValue(bucket.income, bucket.spending, options.metric) };
      });
      return {
        id: row.id,
        name: row.name,
        color: normalizeChartColor(row.color, index),
        total: points.reduce((sum, point) => sum + Math.abs(point.value), 0),
        points
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "de"))
    .slice(0, topN);

  const maxValue = Math.max(1, ...series.flatMap((row) => row.points.map((point) => Math.abs(point.value))));
  return { periods, series, maxValue };
}

export function buildCategoryTrendChart(
  entries: AnalyticsExpense[],
  categories: AnalyticsCategory[],
  options: {
    categoryId?: string | null;
    months: number;
    endDate?: Date | string;
  } = { months: 6 }
): CategoryTrendChart {
  const months = clampInteger(options.months, 3, 12);
  const periods = buildMonthPeriods(entries, months, options.endDate);
  const spendingByCategory = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind !== "EXPENSE") continue;
    const id = entry.category?.id ?? "";
    spendingByCategory.set(id, (spendingByCategory.get(id) ?? 0) + entry.amountCents);
  }
  const fallbackCategory = [...spendingByCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const categoryId = options.categoryId ?? fallbackCategory ?? categories[0]?.id ?? "";
  const configuredCategory = categories.find((category) => (category.id ?? "") === categoryId);
  const categoryName = configuredCategory?.name ?? "Ohne Kategorie";
  const color = normalizeChartColor(configuredCategory?.color ?? "#6b6f76", 0);
  const buckets = new Map<string, { income: number; spending: number }>();

  for (const entry of entries) {
    const entryCategoryId = entry.category?.id ?? "";
    if (entryCategoryId !== categoryId) continue;
    const period = monthKey(entry.date);
    if (!periods.includes(period)) continue;
    const bucket = buckets.get(period) ?? { income: 0, spending: 0 };
    if (entry.kind === "INCOME") bucket.income += entry.amountCents;
    if (entry.kind === "EXPENSE") bucket.spending += entry.amountCents;
    buckets.set(period, bucket);
  }

  const points = periods.map((period) => {
    const bucket = buckets.get(period) ?? { income: 0, spending: 0 };
    return {
      period,
      spending: bucket.spending,
      income: bucket.income,
      saldo: bucket.income - bucket.spending
    };
  });
  const maxValue = Math.max(1, ...points.map((point) => point.spending));
  return {
    categoryId: categoryId || undefined,
    categoryName,
    color,
    periods,
    points,
    maxValue,
    totalSpending: points.reduce((sum, point) => sum + point.spending, 0)
  };
}

function getTrendFacet(entry: AnalyticsExpense, dimension: ExpenseChartDimension) {
  if (dimension === "label") {
    if (!entry.label) return null;
    return { id: entry.label.id, name: entry.label.name, color: entry.label.color };
  }
  return {
    id: entry.category?.id,
    name: entry.category?.name ?? "Ohne Kategorie",
    color: entry.category?.color ?? "#6b6f76"
  };
}

function metricValue(income: number, spending: number, metric: ExpenseChartMetric) {
  if (metric === "income") return income;
  if (metric === "saldo") return income - spending;
  if (metric === "net") return Math.max(0, spending - income);
  return spending;
}

function buildMonthPeriods(entries: AnalyticsExpense[], months: number, endDate?: Date | string) {
  const fallbackEnd = entries.length > 0
    ? new Date(Math.max(...entries.map((entry) => new Date(entry.date).getTime())))
    : new Date();
  const end = endDate ? new Date(endDate) : fallbackEnd;
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(end.getFullYear(), end.getMonth() - (months - index - 1), 1);
    return monthKey(date);
  });
}

function monthKey(dateLike: Date | string) {
  const date = new Date(dateLike);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeChartColor(value: string | null | undefined, index: number) {
  const fallback = ["#16776f", "#2e6fea", "#1c8c55", "#b7791f", "#b94242", "#7b61d1", "#2f7f9f", "#8a6f3d"];
  const text = String(value ?? "").trim();
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(text)) return text;
  return fallback[index % fallback.length];
}
