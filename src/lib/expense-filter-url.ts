import { isExpenseSortKey, type ExpenseSortKey } from "@/lib/expense-sorting";

export type ExpenseFilterParams = {
  from?: string | null;
  to?: string | null;
  year?: string | null;
  month?: string | null;
  label?: string | string[] | null;
  category?: string | string[] | null;
  kind?: "expense" | "income" | string | null;
  paymentMethod?: string | string[] | null;
  source?: "manual" | "contract" | "fuel" | "recurring" | string | string[] | null;
  q?: string | null;
  sort?: ExpenseSortKey | string | null;
  view?: "entries" | "categories" | "analysis" | "compare" | "overview" | "budgets" | "labels" | "periods" | string | null;
  compareA?: string | null;
  compareB?: string | null;
  compareMode?: "month" | "year" | "custom" | string | null;
  compareMonth?: string | null;
  compareYear?: string | null;
  compareFrom?: string | null;
  compareTo?: string | null;
  chartDimension?: "category" | "label" | string | null;
  chartMetric?: "spending" | "income" | "saldo" | "net" | string | null;
  chartTop?: string | null;
  chartMonths?: string | null;
};

const orderedKeys = ["from", "to", "year", "month", "label", "category", "kind", "paymentMethod", "source", "q", "sort", "view", "compareA", "compareB", "compareMode", "compareMonth", "compareYear", "compareFrom", "compareTo", "chartDimension", "chartMetric", "chartTop", "chartMonths"] as const;
const expenseViewKeys = ["entries", "categories", "analysis", "compare", "overview", "budgets", "labels", "periods"] as const;
const chartDimensionKeys = ["category", "label"] as const;
const chartMetricKeys = ["spending", "income", "saldo", "net"] as const;
const kindKeys = ["expense", "income"] as const;
const sourceKeys = ["manual", "contract", "fuel", "recurring"] as const;
const compareModeKeys = ["month", "year", "custom"] as const;

export function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function addMonthsToMonthKey(monthKey: string, amount: number) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return monthKey;
  const date = new Date(year, month - 1 + amount, 1);
  return getMonthKey(date);
}

export function buildExpensesHref(params: ExpenseFilterParams, overrides: ExpenseFilterParams = {}) {
  const next = normalizeExpenseParams({ ...params, ...overrides });
  return toExpensesHref(next);
}

export function getCanonicalExpensesHref(params: ExpenseFilterParams) {
  return toExpensesHref(normalizeExpenseParams(params));
}

export function getRawExpensesHref(params: ExpenseFilterParams) {
  const search = new URLSearchParams();
  for (const key of orderedKeys) {
    const value = params[key];
    for (const item of toValues(value)) search.append(key, item);
  }
  const query = search.toString();
  return query ? `/ausgaben?${query}` : "/ausgaben";
}

export function buildPeriodHref(params: ExpenseFilterParams, period: Pick<ExpenseFilterParams, "year" | "month">) {
  return buildExpensesHref(params, {
    from: undefined,
    to: undefined,
    year: period.year,
    month: period.month
  });
}

export function buildMonthNavigationHref(params: ExpenseFilterParams, monthKey: string, amount: number) {
  return buildPeriodHref(params, { month: addMonthsToMonthKey(monthKey, amount) });
}

export function buildYearNavigationHref(params: ExpenseFilterParams, year: number, amount: number) {
  return buildPeriodHref(params, { year: String(year + amount) });
}

export function buildFilterHref(params: ExpenseFilterParams, values: Pick<ExpenseFilterParams, "from" | "to" | "category" | "label" | "kind" | "paymentMethod" | "source" | "q">) {
  const hasCustomRange = Boolean(cleanValue(values.from) || cleanValue(values.to));
  return buildExpensesHref(params, {
    q: values.q,
    category: values.category,
    label: values.label,
    kind: values.kind,
    paymentMethod: values.paymentMethod,
    source: values.source,
    from: values.from,
    to: values.to,
    ...(hasCustomRange ? { year: undefined, month: undefined } : {})
  });
}

function normalizeExpenseParams(params: ExpenseFilterParams) {
  const next: ExpenseFilterParams = {};
  for (const key of orderedKeys) {
    const value = key === "category" || key === "label" || key === "paymentMethod" || key === "source" ? cleanValues(params[key]) : cleanValue(singleValue(params[key]));
    if (Array.isArray(value)) {
      if (value.length > 0) (next as Record<string, string | string[]>)[key] = value;
    } else if (value) {
      (next as Record<string, string | string[]>)[key] = value;
    }
  }

  if (next.month && /^\d{2}$/.test(next.month) && next.year) {
    next.month = `${next.year}-${next.month}`;
  } else if (next.month && !/^\d{4}-\d{2}$/.test(next.month)) {
    delete next.month;
  }

  if (next.from || next.to) {
    delete next.year;
    delete next.month;
  } else if (next.month) {
    delete next.year;
  } else if (next.year) {
    delete next.month;
  }

  if (next.sort && !isExpenseSortKey(next.sort)) delete next.sort;
  if (next.view && !expenseViewKeys.includes(next.view as typeof expenseViewKeys[number])) delete next.view;
  if (next.kind && !kindKeys.includes(next.kind as typeof kindKeys[number])) delete next.kind;
  if (next.compareMode && !compareModeKeys.includes(next.compareMode as typeof compareModeKeys[number])) delete next.compareMode;
  if (next.compareMonth && !/^\d{4}-\d{2}$/.test(next.compareMonth)) delete next.compareMonth;
  if (next.compareYear) {
    const year = Number(next.compareYear);
    if (!Number.isInteger(year) || year < 1900 || year > 2200) delete next.compareYear;
  }
  if (!next.compareMode) {
    if (next.compareFrom || next.compareTo) next.compareMode = "custom";
    else if (next.compareYear) next.compareMode = "year";
    else if (next.compareMonth) next.compareMode = "month";
  }
  if (next.compareMode === "month") {
    delete next.compareYear;
    delete next.compareFrom;
    delete next.compareTo;
  } else if (next.compareMode === "year") {
    delete next.compareMonth;
    delete next.compareFrom;
    delete next.compareTo;
  } else if (next.compareMode === "custom") {
    delete next.compareMonth;
    delete next.compareYear;
  } else {
    delete next.compareMonth;
    delete next.compareYear;
    delete next.compareFrom;
    delete next.compareTo;
  }
  if (next.source) {
    const sources = cleanValues(next.source).filter((source) => sourceKeys.includes(source as typeof sourceKeys[number]));
    if (sources.length > 0) next.source = sources;
    else delete next.source;
  }
  if (next.chartDimension && !chartDimensionKeys.includes(next.chartDimension as typeof chartDimensionKeys[number])) delete next.chartDimension;
  if (next.chartMetric && !chartMetricKeys.includes(next.chartMetric as typeof chartMetricKeys[number])) delete next.chartMetric;
  if (next.chartTop) {
    const top = Number(next.chartTop);
    if (!Number.isInteger(top) || top < 3 || top > 8) delete next.chartTop;
  }
  if (next.chartMonths) {
    const months = Number(next.chartMonths);
    if (months !== 6 && months !== 12) delete next.chartMonths;
  }
  return next;
}

function toExpensesHref(params: ExpenseFilterParams) {
  const search = new URLSearchParams();
  for (const key of orderedKeys) {
    const value = params[key];
    for (const item of toValues(value)) search.append(key, item);
  }
  const query = search.toString();
  return query ? `/ausgaben?${query}` : "/ausgaben";
}

function cleanValue(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function cleanValues(value: string | string[] | null | undefined) {
  return [...new Set((Array.isArray(value) ? value : [value])
    .map((item) => cleanValue(item ?? undefined))
    .filter((item): item is string => Boolean(item)))];
}

function singleValue(value: string | string[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toValues(value: string | string[] | null | undefined) {
  return cleanValues(value);
}
