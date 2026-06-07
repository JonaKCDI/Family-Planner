export type ExpenseFilterParams = {
  from?: string | null;
  to?: string | null;
  year?: string | null;
  month?: string | null;
  label?: string | null;
  category?: string | null;
  q?: string | null;
  compareA?: string | null;
  compareB?: string | null;
};

const orderedKeys = ["from", "to", "year", "month", "label", "category", "q", "compareA", "compareB"] as const;

export function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
    if (value !== undefined && value !== null) search.set(key, String(value));
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

export function buildFilterHref(params: ExpenseFilterParams, values: Pick<ExpenseFilterParams, "from" | "to" | "category" | "label" | "q">) {
  const hasCustomRange = Boolean(cleanValue(values.from) || cleanValue(values.to));
  return buildExpensesHref(params, {
    q: values.q,
    category: values.category,
    label: values.label,
    from: values.from,
    to: values.to,
    ...(hasCustomRange ? { year: undefined, month: undefined } : {})
  });
}

function normalizeExpenseParams(params: ExpenseFilterParams) {
  const next: ExpenseFilterParams = {};
  for (const key of orderedKeys) {
    const value = cleanValue(params[key]);
    if (value) next[key] = value;
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

  return next;
}

function toExpensesHref(params: ExpenseFilterParams) {
  const search = new URLSearchParams();
  for (const key of orderedKeys) {
    const value = params[key];
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/ausgaben?${query}` : "/ausgaben";
}

function cleanValue(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return text || undefined;
}
