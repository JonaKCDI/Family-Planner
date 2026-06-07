const monthLabelFormatter = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  timeZone: "UTC",
  year: "numeric"
});

const monthOnlyFormatter = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  timeZone: "UTC"
});

export type MonthOption = {
  label: string;
  value: string;
};

export function buildMonthSelectOptions(): MonthOption[] {
  return Array.from({ length: 12 }, (_, monthIndex) => ({
    label: monthOnlyFormatter.format(new Date(Date.UTC(2026, monthIndex, 1))),
    value: String(monthIndex + 1).padStart(2, "0")
  }));
}

export function buildMonthOptions(years: number[], selectedMonthKey: string, currentMonthKey: string): MonthOption[] {
  const optionYears = [...new Set([...years, yearFromMonthKey(selectedMonthKey), yearFromMonthKey(currentMonthKey)].filter(isFiniteYear))]
    .sort((a, b) => b - a);

  return optionYears.flatMap((year) =>
    Array.from({ length: 12 }, (_, monthIndex) => {
      const value = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
      return {
        label: monthLabelFormatter.format(new Date(Date.UTC(year, monthIndex, 1))),
        value
      };
    })
  );
}

export function formatMonthKeyLabel(monthKey: string) {
  const parts = splitMonthKey(monthKey);
  if (!parts) return monthKey;
  return monthLabelFormatter.format(new Date(Date.UTC(parts.year, Number(parts.month) - 1, 1)));
}

export function splitMonthKey(monthKey: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey ?? ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  return {
    month: match[2],
    year
  };
}

function yearFromMonthKey(monthKey: string) {
  return Number(monthKey.slice(0, 4));
}

function isFiniteYear(value: number) {
  return Number.isFinite(value);
}
