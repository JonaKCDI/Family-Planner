import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BanknoteArrowUp, ChevronRight, List, ReceiptText, Scale } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { EmptyState } from "@/components/ui";
import { loadExpenseAnalysis } from "@/lib/expense-analysis-data";
import { analysisEntryParams, buildAnalysisPeriods, buildAnalysisBackHref, type AnalysisDimension } from "@/lib/expense-detail-analysis";
import { buildExpensesHref, type ExpenseFilterParams } from "@/lib/expense-filter-url";
import { formatMoney } from "@/lib/format";
import { dateKey } from "@/lib/expense-range";
import "@/app/(app)/ausgaben/analyse/analysis.css";
import { DesktopFinanceAnalysisList } from "@/components/desktop-finance-analysis-list";

export async function FinanceDetailAnalysis({ params, dimension, id }: { params: ExpenseFilterParams; dimension: AnalysisDimension; id: string }) {
  const data = await loadExpenseAnalysis(params, dimension, id);
  if (!data) notFound();
  const { target, range, context, entries } = data;
  const back = buildAnalysisBackHref(params, dimension);
  const formatDay = (value: string) => new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(value));
  const currencies = data.currencies.length ? data.currencies : [params.currency || "EUR"];
  return <div className="finance-detail-workspace"><DesktopFinanceAnalysisList params={params} dimension={dimension} selectedId={id} /><div className="finance-detail">
    <header className="finance-detail-head">
      <Link href={back} className="finance-analysis-icon" aria-label="Zurück zur Analyse"><ArrowLeft size={22} /><span className="desktop-only">Analyse</span></Link>
      <span className="analysis-row-icon" style={{ background: target.color }} aria-hidden="true"><CategoryIcon icon={"icon" in target ? target.icon : "tag"} size={19} /></span>
      <div className="finance-detail-heading"><h1>{target.name}</h1><p>{params.bereich === "familie" ? "Familie" : "Persönlich"} · {formatDay(dateKey(range.from))}–{formatDay(dateKey(range.to))}</p></div>
      <Link className="finance-analysis-icon" href={buildExpensesHref(analysisEntryParams(context, dimension, id))} aria-label={`Alle Buchungen: ${target.name}`} title="Buchungen anzeigen"><List size={21} /><span className="desktop-only">Buchungen</span></Link>
    </header>
    {params.q || params.label || params.category || params.kind || params.paymentMethod || params.source || params.person ? <p className="finance-detail-note">Die Filter aus deiner Analyse bleiben berücksichtigt.</p> : null}
    {currencies.map(currency => {
      const selected = entries.filter(e => e.currency === currency);
      const { periods, granularity } = buildAnalysisPeriods(selected, range);
      const spending = periods.reduce((sum, p) => sum + p.spending, 0);
      const income = periods.reduce((sum, p) => sum + p.income, 0);
      const saldo = income - spending;
      const unit = granularity === "week" ? "Wochen" : granularity === "month" ? "Monate" : "Jahre";
      const money = (value: number) => formatMoney(value, currency);
      const max = Math.max(1, ...periods.map(p => p.spending));
      const width = 360, left = 45, plotWidth = 305, baseline = 178, height = 145;
      const slot = plotWidth / Math.max(1, periods.length);
      const labelEvery = Math.max(1, Math.ceil(periods.length / 5));
      const href = (period: { from: string; to: string }) => buildExpensesHref(analysisEntryParams({ ...context, currency, from: period.from, to: period.to }, dimension, id));
      return <section key={currency} aria-label={`Ausgaben in ${currency}`}>
        {currencies.length > 1 && <h2>{currency}</h2>}
        <div className="finance-detail-stats" aria-label="Saldo und Buchungssummen">
          <article className={`finance-summary-metric ${saldo < 0 ? "tone-negative" : "tone-positive"}`}><div className="finance-summary-card-head"><span>Saldo</span><i aria-hidden="true"><Scale size={18} /></i></div><strong>{money(saldo)}</strong></article>
          <article className="finance-summary-metric tone-spending"><div className="finance-summary-card-head"><span>Ausgaben</span><i aria-hidden="true"><ReceiptText size={18} /></i></div><strong>{money(spending)}</strong></article>
          <article className="finance-summary-metric tone-income"><div className="finance-summary-card-head"><span>Einnahmen</span><i aria-hidden="true"><BanknoteArrowUp size={18} /></i></div><strong>{money(income)}</strong></article>
        </div>
        {!selected.length ? <EmptyState>Keine Buchungen in diesem Zeitraum. Wähle in der Analyse einen anderen Zeitraum oder passe die Filter an.</EmptyState> : <>
          <section className="finance-detail-section" aria-label="Ausgabenverlauf">
            <div className="finance-detail-section-head"><h2>Ausgabenverlauf</h2><span>Nach {unit}</span></div>
            <svg className="finance-detail-chart" viewBox={`0 0 ${width} 214`} role="img" aria-label={`Ausgaben nach ${unit}. Exakte Werte und Buchungen stehen in der Periodenliste darunter.`}>
              {[0, 0.5, 1].map(fraction => <g key={fraction}><line x1={left} x2="350" y1={baseline - fraction * height} y2={baseline - fraction * height} stroke="#e7eeea" /><text x={left - 6} y={baseline - fraction * height + 4} textAnchor="end">{new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 1 }).format(max * fraction / 100)}</text></g>)}
              <text x="5" y="15">{currency}</text>
              {periods.map((period, index) => <g key={period.from}>
                <rect className="analysis-bar" x={left + index * slot + slot * 0.16} y={baseline - period.spending / max * height} width={slot * 0.68} height={Math.max(period.spending > 0 ? 1 : 0, period.spending / max * height)} rx="2"><title>{`${period.label}: ${money(period.spending)}${period.partial ? " (Teilzeitraum)" : ""}`}</title></rect>
                {index % labelEvery === 0 && <text x={left + index * slot + slot / 2} y="199" textAnchor="middle">{period.shortLabel}</text>}
              </g>)}
            </svg>
            <p className="finance-detail-note">Tatsächliche Ausgaben{income > 0 ? " · Einnahmen werden nicht abgezogen" : ""}. {periods.some(p => p.partial) ? "Randperioden enthalten nur die Tage im gewählten Zeitraum." : ""}</p>
          </section>
          <section className="finance-detail-section" aria-label="Perioden und Buchungen">
            <div className="finance-detail-section-head"><h2>{unit} im Detail</h2><span className="mobile-only">Tippen für Buchungen</span><span className="desktop-only">Buchungen öffnen</span></div>
            {periods.map(period => <Link className="finance-period-link" href={href(period)} key={period.from}>
              <span>{period.label}{period.partial && <small>Teilzeitraum · {formatDay(period.from)}–{formatDay(period.to)}</small>}</span>
              <span><strong>{money(period.spending)}</strong>{period.income > 0 && <small>+ {money(period.income)} Einnahmen</small>}</span>
              <ChevronRight size={17} aria-hidden="true" />
            </Link>)}
          </section>
        </>}
      </section>;
    })}
  </div></div>;
}
