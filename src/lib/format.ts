export function formatMoney(amountCents: number, currency = "EUR") {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency
  }).format(amountCents / 100);
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(date));
}

export function toDateInputValue(date: Date | string | null | undefined) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function parseEuroToCents(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "0")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  return Math.round(Number(normalized) * 100);
}
