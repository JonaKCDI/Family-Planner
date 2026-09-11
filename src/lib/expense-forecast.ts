export type ForecastExpense = { kind: string; amountCents: number; date: Date | string; categoryId?: string | null };
export type MonthTotal = { month: string; value: number };

export function forecastReference(entries: ForecastExpense[], year: string | string[] | undefined, today = new Date()) {
  const currentYear = today.getUTCFullYear();
  const years = [...new Set(entries.map((entry) => new Date(entry.date).getUTCFullYear()))]
    .filter((value) => Number.isFinite(value) && value < currentYear).sort((a, b) => b - a);
  const selectedYear = typeof year === "string" && /^\d{4}$/.test(year) && years.includes(Number(year)) ? Number(year) : null;
  return {
    years,
    selectedYear,
    date: selectedYear === null ? today : new Date(Date.UTC(selectedYear + 1, 0, 1)),
    query: selectedYear === null ? "" : `?year=${selectedYear}`
  };
}

export function withoutExcludedCategories<T extends ForecastExpense>(entries: T[], categories: { id: string; excludeFromForecast: boolean }[]): T[] {
  const ids = new Set(categories.filter((category) => category.excludeFromForecast).map((category) => category.id));
  return entries.filter((entry) => !entry.categoryId || !ids.has(entry.categoryId));
}

// UTC keeps date-only database values independent of the container timezone.
export function monthKey(date: Date | string) {
  return new Date(date).toISOString().slice(0, 7);
}

export function monthOffset(reference: Date, offset: number) {
  return monthKey(new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + offset, 1)));
}

export function monthlyTotals(entries: ForecastExpense[], now: Date, count: number): MonthTotal[] {
  const sums = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind !== "EXPENSE") continue;
    const key = monthKey(entry.date);
    sums.set(key, (sums.get(key) ?? 0) + entry.amountCents);
  }
  return Array.from({ length: count }, (_, i) => {
    const month = monthOffset(now, i - count);
    return { month, value: sums.get(month) ?? 0 };
  });
}

export function monthlySaldo(entries: ForecastExpense[], now: Date, count: number): MonthTotal[] {
  return monthlyTotals(entries.filter((entry) => entry.kind === "INCOME" || entry.kind === "EXPENSE").map((entry) => ({
    ...entry,
    kind: "EXPENSE",
    amountCents: entry.kind === "INCOME" ? entry.amountCents : -entry.amountCents
  })), now, count);
}

export function smoothedForecast(entries: ForecastExpense[], reference: Date): MonthTotal[] {
  const months = recordedMonths(entries, reference);
  if (!months) return [];
  // Six valid rolling averages need eleven completed calendar months.
  const history = monthlyTotals(entries, reference, Math.max(6, Math.min(11, months)));
  const smoothed = movingAverage(history).filter((point): point is MonthTotal => point.value !== null);
  if (smoothed.length < 2) {
    return [0, 1].map((offset) => ({ month: monthOffset(reference, offset), value: Math.round(smoothed[0].value) }));
  }
  return fitForecast(smoothed, reference);
}

export function forecastOverview(entries: ForecastExpense[], categories: { id: string; excludeFromForecast: boolean }[], reference: Date, offset: 0 | 1 = 0) {
  const included = withoutExcludedCategories(entries, categories);
  const spending = smoothedForecast(included, reference)[offset]?.value ?? 0;
  const income = smoothedForecast(included.filter((entry) => entry.kind === "INCOME").map((entry) => ({ ...entry, kind: "EXPENSE" })), reference)[offset]?.value ?? 0;
  const hasHistory = included.some((entry) => (entry.kind === "INCOME" || entry.kind === "EXPENSE") && monthKey(entry.date) < monthOffset(reference, 0));
  return { spending, income, saldo: income - spending, hasHistory };
}

export function movingAverage(points: MonthTotal[], window = 6) {
  return points.map((point, index) => ({
    month: point.month,
    value: index < window - 1 ? null : points.slice(index - window + 1, index + 1).reduce((sum, item) => sum + item.value, 0) / window
  }));
}

export function fitForecast(points: MonthTotal[], now: Date) {
  if (points.length < 2) return [];
  const center = (points.length - 1) / 2;
  const mean = points.reduce((sum, p) => sum + p.value, 0) / points.length;
  const denominator = points.reduce((sum, _, i) => sum + (i - center) ** 2, 0);
  const slope = points.reduce((sum, p, i) => sum + (i - center) * (p.value - mean), 0) / denominator;
  return [0, 1].map((offset) => ({ month: monthOffset(now, offset), value: Math.max(0, Math.round(mean + slope * (points.length + offset - center))) }));
}

export function boxStatistics(points: MonthTotal[]) {
  if (!points.length) return null;
  const sorted = points.map((p) => p.value).sort((a, b) => a - b);
  const quantile = (p: number) => {
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower);
  };
  const q1 = quantile(0.25), median = quantile(0.5), q3 = quantile(0.75);
  const iqr = q3 - q1;
  const inner = sorted.filter((value) => value >= q1 - 1.5 * iqr && value <= q3 + 1.5 * iqr);
  return { q1, median, q3, low: inner[0], high: inner[inner.length - 1], outliers: points.filter((p) => p.value < q1 - 1.5 * iqr || p.value > q3 + 1.5 * iqr) };
}

export function recordedMonths(entries: ForecastExpense[], now: Date) {
  const dates = entries.filter((e) => e.kind === "EXPENSE" && monthKey(e.date) < monthOffset(now, 0)).map((e) => monthKey(e.date)).sort();
  if (!dates.length) return 0;
  const [year, month] = dates[0].split("-").map(Number);
  return (now.getUTCFullYear() - year) * 12 + now.getUTCMonth() - month + 1;
}
