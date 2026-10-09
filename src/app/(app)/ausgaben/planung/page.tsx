import { allowedForecastYear, developerFeaturesEnabled } from "@/lib/developer-features";
import { FamilyFinancePage } from "@/components/family-finance-page";
import { FinanceAreaIndicator } from "@/components/finance-area-switch";
import type { ExpenseFilterParams } from "@/lib/expense-filter-url";
import Link from "@/components/finance-link";
import { BanknoteArrowUp, ReceiptText, Scale } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { requireSession } from "@/lib/auth";
import { getVisibleCategories, getVisibleExpenseSummaries } from "@/lib/queries";
import { monthlySaldo, movingAverage, recordedMonths, monthOffset, withoutExcludedCategories, forecastReference, forecastOverview, smoothedSaldoForecast } from "@/lib/expense-forecast";
import { formatMoney } from "@/lib/format";
import { ForecastChart } from "@/components/expense-forecast-charts";
import { PageHeader } from "@/components/ui";
import { FinanceTransitionMarker } from "@/components/finance-transition-marker";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import "./forecast.css";

export default async function ExpensePlanningPage({ searchParams }: { searchParams: Promise<ExpenseFilterParams> }) {
  const session = await requireSession();
  const params = await searchParams;
  if (params.bereich === "familie") return <FamilyFinancePage params={params} planning />;
  const [expenses, categories] = await Promise.all([
    getVisibleExpenseSummaries(session.family.id, session.user.id),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE")
  ]);
  const reference = forecastReference(expenses, allowedForecastYear(session, params.year));
  const now = reference.date;
  const ownExpenses = withoutExcludedCategories(expenses, categories);
  const history = monthlySaldo(ownExpenses, now, 17);
  const averages = movingAverage(history);
  const prediction = smoothedSaldoForecast(ownExpenses, now);
  const months = recordedMonths(ownExpenses, now);
  const overview = forecastOverview(expenses, categories, now, reference.selectedYear === null ? 1 : 0);
  const forecastMonth = monthOffset(now, reference.selectedYear === null ? 1 : 0);
  const forecastMonthLabel = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${forecastMonth}-01T00:00:00Z`));
  const widgets = [
    { label: "Saldo", value: overview.saldo, Icon: Scale, tone: overview.saldo < 0 ? "negative" : "positive" },
    { label: "Einnahmen", value: overview.income, Icon: BanknoteArrowUp, tone: "income" },
    { label: "Ausgaben", value: overview.spending, Icon: ReceiptText, tone: "spending" }
  ];
  const rows = [...categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, excludeFromForecast: c.excludeFromForecast })), { id: "ohne-kategorie", name: "Ohne Kategorie", icon: "tag", color: "#6b6f76", excludeFromForecast: false }].map((c) => {
    const entries = expenses.filter((e) => (e.categoryId ?? "ohne-kategorie") === c.id);
    return { ...c, average: monthlySaldo(entries, now, 6).reduce((sum, p) => sum + p.value, 0) / 6 };
  });
  return <div className={`forecast-page${months === 0 ? " desktop-no-forecast-history" : ""}`}>
    <FinanceTransitionMarker view="planning" />
    <div className="task-page-head finance-page-head">
      <PageHeader title="Finanzen" suffix={<FinanceAreaIndicator />} />
    </div>
    <nav className="finance-primary-tabs" aria-label="Finanzbereich">
      <Link href="/ausgaben">Übersicht</Link><Link href="/ausgaben?view=categories">Analyse</Link><Link className="active" href={`/ausgaben/planung${reference.query}`} aria-current="page">Prognose</Link>
    </nav>
    {developerFeaturesEnabled(session) && <form action="/ausgaben/planung" className="forecast-year-select">
      <label>Datengrundlage<AutoSubmitSelect key={reference.selectedYear ?? "current"} name="year" defaultValue={String(reference.selectedYear ?? "current")}>
        <option value="current">Aktuell</option>
        {reference.years.map((year) => <option value={year} key={year}>{year}</option>)}
      </AutoSubmitSelect></label>
      <noscript><button className="button secondary" type="submit">Anzeigen</button></noscript>
    </form>}
    <section className="forecast-widget-section" aria-label={`Prognose für ${forecastMonthLabel}`}>
      <div className="forecast-section-head"><h2>Prognose</h2><span>{forecastMonthLabel}</span></div>
      <div className="finance-summary-panel forecast-widget-grid">
        {widgets.map(({ label, value, Icon, tone }) => <article key={label} className={`finance-summary-metric forecast-widget tone-${overview.hasHistory ? tone : "neutral"}`}>
            <div className="finance-summary-card-head"><span>{label}</span><i aria-hidden="true"><Icon size={18} /></i></div>
            <strong>{overview.hasHistory ? formatMoney(value) : "–"}</strong>
          </article>)}
      </div>
      <p className="muted">Trendprognose · geglättet über 6 Monate · bereinigt{reference.selectedYear !== null ? ` · Testjahr ${reference.selectedYear}` : ""}</p>
    </section>
    {months < 6 && <p className="forecast-note">{months === 0 ? "Noch keine abgeschlossenen Monate erfasst." : `Erst ${months} Monate erfasst · Prognose vorläufig`}</p>}
    {months > 0 && months < 7 && <p className="forecast-note">Für einen geglätteten Trend fehlen noch Monate; vorerst gilt der Durchschnitt.</p>}
    <section className={`panel forecast-tile${months === 0 ? " desktop-empty-forecast" : ""}`}><div className="forecast-section-head"><h2>Verlauf</h2><span className={months === 0 ? "mobile-only" : undefined}>12 Monate</span>{months === 0 && <span className="desktop-only">Noch keine Daten</span>}</div>
      {months === 0 && <p className="desktop-only desktop-forecast-empty-message">Noch keine abgeschlossenen Monate erfasst. Der Verlauf erscheint mit den ersten Monatswerten.</p>}
      <ForecastChart showMonthlyValues={false} history={history.slice(-12)} spendingLabel="Saldo" average={averages.slice(-12)} forecast={prediction} />
    </section>
    <section className="panel finance-category-page forecast-tile"><div className="forecast-section-head"><h2>Kategorien</h2><span>Ø 6 Monate</span></div>
      <div className="list finance-analysis-list">{rows.map((row) => (
        <Link className="analysis-row analysis-link-row" key={row.id} href={`/ausgaben/planung/kategorie/${encodeURIComponent(row.id)}${reference.query}`}>
          <span className="analysis-row-icon" style={{ background: row.color }}><CategoryIcon icon={row.icon} size={17} /></span>
          <div className="analysis-row-copy"><strong>{row.name}</strong><span className="muted">{row.excludeFromForecast ? "Nicht in Gesamtprognose" : "Ø pro Monat"}</span></div>
          <div className="amount-column compact-amount"><strong>{formatMoney(row.average)}</strong></div>
          <span className="analysis-row-chevron" aria-hidden="true">›</span>
        </Link>
      ))}</div>
    </section>
  </div>;
}




