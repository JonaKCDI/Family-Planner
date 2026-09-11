import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getVisibleCategories, getVisibleExpenses } from "@/lib/queries";
import { monthlyTotals, fitForecast, recordedMonths, forecastReference } from "@/lib/expense-forecast";
import { ExpenseBoxPlot, ForecastChart, monthLabel } from "@/components/expense-forecast-charts";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import "../../forecast.css";

export default async function CategoryForecastPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ year?: string | string[] }> }) {
  const session = await requireSession();
  const { id } = await params;
  const [categories, expenses] = await Promise.all([
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getVisibleExpenses(session.family.id, session.user.id)
  ]);
  const category = categories.find((c) => c.id === id);
  if (!category && id !== "ohne-kategorie") notFound();
  const entries = expenses.filter((e) => (e.categoryId ?? "ohne-kategorie") === id);
  const reference = forecastReference(expenses, (await searchParams).year);
  const now = reference.date;
  const points = monthlyTotals(entries, now, 24);
  const history = points.slice(-12);
  const months = recordedMonths(entries, now);
  const forecast = months >= 2 ? fitForecast(history.slice(-Math.min(months, 12)), now) : [];
  return <div className="forecast-page">
    <header className="forecast-detail-head">
      <Link className="forecast-back" href={`/ausgaben/planung${reference.query}`} aria-label="Zurück zur Prognose"><ArrowLeft size={22} /></Link>
      <span className="analysis-row-icon" style={{ background: category?.color ?? "#6b6f76" }}><CategoryIcon icon={category?.icon} size={19} /></span>
      <PageHeader title={category?.name ?? "Ohne Kategorie"} />
    </header>
    {reference.selectedYear !== null && <p className="muted">Testansicht · Stand Dezember {reference.selectedYear}</p>}
    <section className="panel forecast-tile"><div className="forecast-section-head"><h2>Verlauf</h2><span>12 Monate + Prognose</span></div>
      <ForecastChart showMonthlyValues={false} history={history} forecast={forecast} />
      {forecast.length ? <dl className="forecast-stats forecast-predictions">{forecast.map((p) => <div key={p.month}><dt>{monthLabel(p.month)} · Prognose</dt><dd>{formatMoney(p.value)}</dd></div>)}</dl> : <p className="forecast-note">Für die Prognose fehlen abgeschlossene Monate.</p>}
    </section>
    <section className="panel forecast-tile"><div className="forecast-section-head"><h2>Verteilung</h2><span>24 Monate</span></div>
      <ExpenseBoxPlot points={points} />
      {months < 24 && <p className="forecast-note">{months === 0 ? "Noch keine abgeschlossenen Monate erfasst." : `Erst ${months} Monate erfasst · übrige Monate zählen als 0 €.`}</p>}
    </section>
  </div>;
}

