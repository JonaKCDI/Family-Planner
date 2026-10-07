import type { ExpenseFilterParams } from "./expense-filter-url";

/** Normalize untrusted GET values, including repeated scalar parameters. */
export function normalizeFamilyFinanceParams(input: ExpenseFilterParams): ExpenseFilterParams {
  const params: ExpenseFilterParams = { ...input };
  for (const key of ["q", "month", "year", "from", "to", "person", "currency", "sort", "view"] as const) {
    const value = input[key];
    params[key] = String(Array.isArray(value) ? value[0] ?? "" : value ?? "").trim() || undefined;
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(params.month ?? "")) delete params.month;
  if (!/^(19|20|21)\d{2}$/.test(params.year ?? "")) delete params.year;
  for (const key of ["from", "to"] as const) {
    const value = params[key];
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) delete params[key];
  }
  if (params.from || params.to) { delete params.month; delete params.year; }
  else if (params.year) delete params.month;
  if (!/^[A-Z]{3}$/.test(params.currency ?? "")) params.currency = "EUR";
  if (!["overview", "entries", "categories", "labels", "budgets", "compare", "people"].includes(params.view ?? "")) params.view = "overview";
  return params;
}
