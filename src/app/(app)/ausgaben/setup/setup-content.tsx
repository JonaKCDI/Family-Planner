import Link from "next/link";
import { getMonthKey } from "@/lib/expense-filter-url";
import { getExpenseLabels, getRecurringTransactions, getVisibleCategories, getVisibleExpenses } from "@/lib/queries";
import { AutoSubmitSelect } from "@/components/auto-submit-select";

export const financeSetupSections = [
  {
    id: "sicherung",
    title: "Excel-Sicherung"
  },
  {
    id: "anlegen",
    title: "Anlegen"
  },
  {
    id: "kategorien",
    title: "Kategorien"
  },
  {
    id: "labels",
    title: "Labels"
  },
  {
    id: "zusammenfuehren",
    title: "Zusammenführen"
  },
  {
    id: "serien",
    title: "Serien"
  }
] as const;

export type FinanceSetupSectionId = typeof financeSetupSections[number]["id"];
export type FinanceSetupContext = Awaited<ReturnType<typeof loadFinanceSetupContext>>;

export async function loadFinanceSetupContext(session: {
  family: { id: string };
  user: { id: string };
}, yearParam?: string) {
  const [expenses, categories, labels, allLabels, recurringTransactions] = await Promise.all([
    getVisibleExpenses(session.family.id, session.user.id),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getExpenseLabels(session.family.id, session.user.id),
    getExpenseLabels(session.family.id, session.user.id, { includeArchived: true }),
    getRecurringTransactions(session.family.id, session.user.id)
  ]);
  const currentYear = Number(getMonthKey().slice(0, 4));
  const years = [...new Set([currentYear, ...expenses.map((entry) => new Date(entry.date).getFullYear())])].sort((a, b) => b - a);
  const selectedYear = normalizeExportYear(yearParam, years, currentYear);

  return {
    categories,
    labels,
    allLabels,
    recurringTransactions,
    years,
    selectedYear
  };
}

export function FinanceSetupOverview() {
  return (
    <div className="settings-overview-grid finance-setup-overview-grid">
      {financeSetupSections.map((section) => (
        <Link className="settings-overview-card" href={`/ausgaben/setup/${section.id}`} key={section.id}>
          <strong>{section.title}</strong>
          <em>Öffnen</em>
        </Link>
      ))}
    </div>
  );
}

export function FinanceSetupBackLink({ href = "/ausgaben/setup", label = "Finanz-Setup" }: { href?: string; label?: string }) {
  return <Link className="settings-back-link" href={href}>← {label}</Link>;
}

export function FinanceSetupYearSelect({
  selectedYear,
  sectionId,
  years
}: {
  selectedYear: number;
  sectionId: FinanceSetupSectionId;
  years: number[];
}) {
  return (
    <form className="setup-year-select-form" action={`/ausgaben/setup/${sectionId}`} aria-label="Excel-Jahr auswählen">
      <label>
        Jahr
        <AutoSubmitSelect name="year" defaultValue={String(selectedYear)}>
          {years.map((year) => <option value={year} key={year}>{year}</option>)}
        </AutoSubmitSelect>
      </label>
      <noscript><button className="button secondary" type="submit">Anzeigen</button></noscript>
    </form>
  );
}

export function financeSetupReturnTo(sectionId: FinanceSetupSectionId, selectedYear: number) {
  return sectionId === "sicherung" ? `/ausgaben/setup/${sectionId}?year=${selectedYear}` : `/ausgaben/setup/${sectionId}`;
}

function normalizeExportYear(value: string | undefined, years: number[], fallback: number) {
  const year = Number(value);
  return Number.isInteger(year) && years.includes(year) ? year : fallback;
}
