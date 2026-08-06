import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { applyExpensePlanningTreatment } from "@/lib/actions";
import { buildExpensePlanningAnalysis, type ExpensePlanningTreatmentType, type PlanningExpense, type PlanningFixedCostTrendRow } from "@/lib/expense-planning-analysis";
import { formatMoney } from "@/lib/format";
import { getExpensePlanningRules, getExpensePlanningTreatments, getVisibleCategories, getVisibleExpenses } from "@/lib/queries";
import { FinanceTransitionMarker } from "@/components/finance-transition-marker";
import { EmptyState, PageHeader } from "@/components/ui";

type PlanningPageProps = {
  searchParams: Promise<{ year?: string }>;
};

const treatmentLabels: Record<ExpensePlanningTreatmentType, string> = {
  NORMAL: "Im Plan lassen",
  FIXED_COST: "Als Fixkosten",
  SPECIAL_EFFECT: "Als Sondereffekt",
  REIMBURSEMENT: "Als Erstattung",
  IGNORE_FOR_PLANNING: "Aus Planung raus",
  SAVINGS_INVESTMENT: "Als Sparen"
};

export default async function ExpensePlanningPage({ searchParams }: PlanningPageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const [expenses, categories, treatments, rules] = await Promise.all([
    getVisibleExpenses(session.family.id, session.user.id),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getExpensePlanningTreatments(session.family.id, session.user.id),
    getExpensePlanningRules(session.family.id, session.user.id)
  ]);
  const today = new Date();
  const currentYear = today.getFullYear();
  const years = [...new Set([currentYear, ...expenses.map((entry) => new Date(entry.date).getFullYear())])].sort((a, b) => b - a);
  const selectedYear = normalizeYear(params.year, years, currentYear);
  const referenceDate = new Date(selectedYear, 11, 31);
  const analysis = buildExpensePlanningAnalysis({
    entries: expenses.map(toPlanningExpense),
    categories,
    treatments,
    rules,
    months: 12,
    referenceDate,
    asOfDate: today,
    displayYear: selectedYear
  });
  const sparseRows = analysis.categoryRows.filter((row) => row.activeMonths < 3 && row.grossCents > 0);
  const sparseTotal = sparseRows.reduce((sum, row) => sum + row.grossCents, 0);
  const dominantSparseRows = sparseRows.slice(0, 3);

  return (
    <div className="finance-planning-page">
      <FinanceTransitionMarker view="planning" />
      <div className="task-page-head finance-page-head">
        <PageHeader title="Planungsanalyse" />
        <div className="planning-head-actions">
          <Link className="button secondary" href="/ausgaben">Zur Finanzübersicht</Link>
        </div>
      </div>

      <nav className="finance-primary-tabs" aria-label="Finanzbereich">
        <Link href="/ausgaben" scroll={false}>Übersicht</Link>
        <Link href="/ausgaben?view=categories" scroll={false}>Analyse</Link>
        <Link className="active" href={`/ausgaben/planung?year=${selectedYear}`} scroll={false}>Planung</Link>
      </nav>

      <section className="filter-system planning-filter-system" aria-label="Planungszeitraum">
        <div className="period-navigator">
          <strong>Jahr</strong>
          <div className="period-tools">
            {years.map((year) => (
              <Link className={year === selectedYear ? "button period-primary-action" : "button secondary"} href={`/ausgaben/planung?year=${year}`} key={year}>
                {year}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="finance-summary-panel planning-summary-panel" aria-label="Planungskennzahlen">
        <PlanningMetric
          label="Monatsbedarf"
          value={analysis.summary.fixedCostCents + analysis.summary.variablePlanCents}
          infoTitle="Monatsbedarf"
          info="Das ist der geglättete Bedarf pro Monat. Die App nutzt wiederkehrende Ausgaben, stabile Kategorien und bereinigte Kategorie-Planwerte."
        />
        <PlanningMetric
          label="Zu prüfen"
          value={analysis.summary.reviewNeededCents}
          infoTitle="Zu prüfen"
          info="Das sind seltene Kategorien mit wenig Historie. Sie bleiben in der Ansicht sichtbar und werden nicht automatisch in den Monatsbedarf eingerechnet."
        />
        <PlanningMetric
          label="Fixkosten"
          value={analysis.summary.fixedCostCents}
          infoTitle="Fixkosten"
          info="Erkannte Verträge, Serien und stabile wiederkehrende Buchungen. Manuell bestätigte Fixkosten fließen ebenfalls ein."
        />
        <PlanningMetric
          label={analysis.qualityStatus === "RELIABLE" ? "Sparrate" : "Vorläufige Sparrate"}
          value={analysis.summary.plannedSavingsCents}
          infoTitle={analysis.qualityStatus === "RELIABLE" ? "Sparrate" : "Vorläufige Sparrate"}
          info="Normale monatliche Einnahmen minus Monatsbedarf und Rücklage für erkannte Ausreißer. Bei offenen Prüfposten ist die Zahl nur eine Orientierung."
          tone={analysis.summary.plannedSavingsCents < 0 ? "negative" : "positive"}
        />
      </section>

      {analysis.qualityStatus !== "RELIABLE" ? (
        <section className={`panel planning-quality-note ${analysis.qualityStatus === "UNRELIABLE" ? "is-unreliable" : ""}`} aria-label="Belastbarkeit der Planungsanalyse">
          <div>
            <strong>{analysis.qualityStatus === "UNRELIABLE" ? "Sparrate nicht belastbar" : "Sparrate vorläufig"}</strong>
            <p className="muted">Die Zahl bleibt sichtbar, sollte aber erst nach Prüfung dieser Punkte für Entscheidungen genutzt werden.</p>
          </div>
          <ul>
            {analysis.qualityReasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </section>
      ) : null}

      {sparseRows.length > 0 ? (
        <section className="panel planning-data-note" aria-label="Datenhinweis">
          <div>
            <strong>Viele Ausgaben sind noch nicht planbar</strong>
            <p className="muted">
              {formatMoney(sparseTotal)} liegen in Kategorien mit weniger als drei aktiven Monaten. Diese Beträge werden nicht automatisch kleingerechnet,
              sondern separat als Prüfbedarf gezeigt.
            </p>
          </div>
          <div className="planning-data-note-list">
            {dominantSparseRows.map((row) => (
              <span key={row.categoryId ?? row.name}>{row.name}: {formatMoney(row.grossCents)}</span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel planning-panel">
        <div className="section-head compact-section-head">
          <div>
            <h2 className="section-title">Tatsächlich vs. bereinigt</h2>
            <p className="muted">Die Bereinigung reduziert nur auffällige Werte in Kategorien mit genug Historie. Unsichere Kategorien bleiben sichtbar.</p>
          </div>
        </div>
        <div className="planning-comparison-grid">
          <PlanningMetric label="Tatsächliche Ausgaben" value={analysis.summary.grossSpendingCents} />
          <PlanningMetric label="Bereinigte Ausgaben" value={analysis.summary.plannedSpendingCents} />
          <PlanningMetric label="Sondereffekte" value={analysis.summary.specialEffectCents} />
          <PlanningMetric label="Rücklage Ausreißer" value={analysis.summary.monthlyReserveCents} />
          <PlanningMetric label="Prüfbedarf" value={analysis.summary.reviewNeededCents} />
          <PlanningMetric label="Variable Planung" value={analysis.summary.variablePlanCents} />
          <PlanningMetric label="Konservative Sparrate" value={analysis.summary.conservativeSavingsCents} tone={analysis.summary.conservativeSavingsCents < 0 ? "negative" : "positive"} />
        </div>
        <div className="planning-month-list">
          {analysis.monthlyRows.map((row) => (
            <div className="planning-month-row" key={row.month}>
              <span>{formatMonth(row.month)}</span>
              <strong>{formatMoney(row.plannedSpendingCents)}</strong>
              <small>{formatMoney(row.grossSpendingCents)} brutto · {formatMoney(row.specialEffectCents)} Effekt</small>
            </div>
          ))}
        </div>
      </section>

      <section className="panel planning-panel">
        <div className="section-head compact-section-head">
          <div>
            <h2 className="section-title">Sondereffekt-Inbox</h2>
            <p className="muted">Bestätigungen lernen private Regeln für ähnliche zukünftige Buchungen.</p>
          </div>
        </div>
        {analysis.suggestions.length === 0 ? <EmptyState>Keine auffälligen Vorschläge für diesen Zeitraum.</EmptyState> : null}
        <div className="planning-suggestion-list">
          {analysis.suggestions.slice(0, 8).map((suggestion) => (
            <article className="planning-suggestion" key={suggestion.groupKey}>
              <div>
                <span className="planning-suggestion-kicker">{suggestionTreatmentLabel(suggestion.treatment)} · {reliabilityLabel(suggestion.confidence)}</span>
                <strong>{suggestion.title}</strong>
                <span>{formatMoney(suggestion.amountCents)} insgesamt, davon {formatMoney(suggestion.plannedImpactCents)} nicht planwirksam</span>
                <small>{suggestion.reason}</small>
              </div>
              <div className="planning-suggestion-actions">
                {suggestionActions(suggestion.treatment).map((treatment, index) => (
                  <PlanningTreatmentForm
                    groupKey={suggestion.groupKey}
                    expenseIds={suggestion.expenseIds}
                    treatment={treatment}
                    year={selectedYear}
                    primary={index === 0}
                    key={treatment}
                  />
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel planning-panel">
        <div className="section-head compact-section-head">
          <div>
            <h2 className="section-title">Fixkosten-Verlauf</h2>
            <p className="muted">Monatliche Entwicklung der erkannten und bestätigten Fixkosten.</p>
          </div>
        </div>
        <FixedCostTrendChart rows={analysis.fixedCostTrendRows} />
      </section>

      <section className="panel planning-panel">
        <div className="section-head compact-section-head">
          <div>
            <h2 className="section-title">Kategorie-Planwerte</h2>
            <p className="muted">Planwert, Normalbereich und erkannte Abweichungen pro Kategorie.</p>
          </div>
        </div>
        <div className="planning-category-table">
          {analysis.categoryRows.map((row) => (
            <div className="planning-category-row" key={row.categoryId ?? row.name}>
              <div>
                <strong>{row.name}</strong>
                <small>{row.reason}</small>
              </div>
              <span>{formatMoney(row.grossCents)} brutto</span>
              <span>{formatMoney(row.plannedCents)} bereinigt</span>
              <span>{row.activeMonths < 3 ? "Prüfen" : `${formatMoney(row.planMonthlyCents)} Plan/Monat`}</span>
              <span className={row.specialEffectCents > 0 ? "negative" : ""}>{formatMoney(row.specialEffectCents)} Effekt</span>
              <span>{reliabilityLabel(row.confidence)}</span>
              <span>{categoryReliabilityLabel(row.reliability)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PlanningMetric({
  label,
  value,
  hint,
  info,
  infoTitle,
  tone
}: {
  label: string;
  value: number;
  hint?: string;
  info?: string;
  infoTitle?: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="finance-summary-metric planning-metric">
      <span className="planning-metric-label">
        {label}
        {info ? <MetricInfo title={infoTitle ?? label}>{info}</MetricInfo> : null}
      </span>
      <strong className={tone}>{formatMoney(value)}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function MetricInfo({ title, children }: { title: string; children: string }) {
  return (
    <details className="planning-metric-info">
      <summary aria-label={`Info: ${title}`} title={title}>i</summary>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </details>
  );
}

function FixedCostTrendChart({ rows }: { rows: PlanningFixedCostTrendRow[] }) {
  const activeRows = rows.filter((row) => row.fixedCostCents > 0);
  if (activeRows.length === 0) return <EmptyState>Noch keine erkannten Fixkosten für den Verlauf.</EmptyState>;

  const first = activeRows[0];
  const last = activeRows[activeRows.length - 1];
  const delta = last.fixedCostCents - first.fixedCostCents;
  const maxValue = Math.max(...rows.map((row) => row.fixedCostCents), 1);
  const width = 320;
  const height = 148;
  const padX = 18;
  const padTop = 18;
  const padBottom = 30;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padTop - padBottom;

  function x(index: number) {
    if (rows.length <= 1) return padX + plotWidth / 2;
    return padX + (index / (rows.length - 1)) * plotWidth;
  }

  function y(value: number) {
    return padTop + ((maxValue - value) / maxValue) * plotHeight;
  }

  const points = rows.map((row, index) => `${x(index).toFixed(1)},${y(row.fixedCostCents).toFixed(1)}`).join(" ");
  const labelStep = rows.length > 18 ? 5 : rows.length > 12 ? 3 : 2;

  return (
    <div className="planning-fixed-trend">
      <div className="planning-fixed-trend-summary">
        <span>Aktuell</span>
        <strong>{formatMoney(last.fixedCostCents)}</strong>
        <small className={delta > 0 ? "negative" : delta < 0 ? "positive" : undefined}>
          {delta === 0 ? "unverändert" : `${delta > 0 ? "+" : ""}${formatMoney(delta)} seit ${formatMonth(first.month)}`}
        </small>
      </div>
      <div className="finance-trend-chart planning-fixed-trend-chart" role="img" aria-label="Fixkosten-Verlauf">
        <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          {[0.25, 0.5, 0.75].map((step) => {
            const gridY = padTop + step * plotHeight;
            return <line className="finance-chart-grid-line muted-line" x1={padX} x2={width - padX} y1={gridY} y2={gridY} key={step} />;
          })}
          <polyline className="finance-chart-line" fill="none" points={points} stroke="#16776f" />
          {rows.map((row, index) => (
            <circle className="finance-chart-dot" cx={x(index)} cy={y(row.fixedCostCents)} fill="#16776f" key={row.month} r={row.fixedCostCents > 0 ? "2.8" : "1.9"} />
          ))}
          {rows.map((row, index) => (
            index % labelStep === 0 || index === rows.length - 1
              ? <text className="finance-chart-axis" x={x(index)} y={height - 8} textAnchor="middle" key={row.month}>{formatMonth(row.month)}</text>
              : null
          ))}
        </svg>
        <div className="planning-fixed-trend-list">
          {activeRows.slice(-6).map((row) => (
            <span key={row.month}>
              <small>{formatMonth(row.month)}</small>
              <strong>{formatMoney(row.fixedCostCents)}</strong>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlanningTreatmentForm({
  groupKey,
  expenseIds,
  treatment,
  year,
  primary = false
}: {
  groupKey: string;
  expenseIds: string[];
  treatment: ExpensePlanningTreatmentType;
  year: number;
  primary?: boolean;
}) {
  return (
    <form action={applyExpensePlanningTreatment}>
      <input type="hidden" name="groupKey" value={groupKey} />
      <input type="hidden" name="treatment" value={treatment} />
      <input type="hidden" name="returnTo" value={`/ausgaben/planung?year=${year}`} />
      <input type="hidden" name="learnRule" value="on" />
      {expenseIds.map((id) => <input type="hidden" name="expenseIds" value={id} key={id} />)}
      <button className={primary ? "button" : "button secondary"} type="submit">{treatmentLabels[treatment]}</button>
    </form>
  );
}

function suggestionActions(treatment: ExpensePlanningTreatmentType): ExpensePlanningTreatmentType[] {
  if (treatment === "REIMBURSEMENT") return ["REIMBURSEMENT", "NORMAL", "IGNORE_FOR_PLANNING"];
  if (treatment === "FIXED_COST") return ["FIXED_COST", "NORMAL", "IGNORE_FOR_PLANNING"];
  return ["SPECIAL_EFFECT", "NORMAL", "IGNORE_FOR_PLANNING"];
}

function reliabilityLabel(confidence: number) {
  if (confidence >= 75) return "gute Datenbasis";
  if (confidence >= 50) return "brauchbarer Hinweis";
  return "nur grober Hinweis";
}

function categoryReliabilityLabel(reliability: "RELIABLE" | "WARNING" | "REVIEW") {
  if (reliability === "RELIABLE") return "belastbar";
  if (reliability === "WARNING") return "vorläufig";
  return "prüfen";
}

function suggestionTreatmentLabel(treatment: ExpensePlanningTreatmentType) {
  if (treatment === "REIMBURSEMENT") return "Mögliche Erstattung";
  if (treatment === "FIXED_COST") return "Mögliche Fixkosten";
  return "Möglicher Sondereffekt";
}

function toPlanningExpense(expense: Awaited<ReturnType<typeof getVisibleExpenses>>[number]): PlanningExpense {
  return {
    id: expense.id,
    ownerUserId: expense.ownerUserId,
    kind: expense.kind,
    amountCents: expense.amountCents,
    date: expense.date,
    store: expense.store,
    description: expense.description,
    paymentMethod: expense.paymentMethod,
    categoryId: expense.categoryId,
    contractId: expense.contractId,
    recurringTransactionId: expense.recurringTransactionId,
    generatedByContract: expense.generatedByContract,
    generatedByRecurringTransaction: expense.generatedByRecurringTransaction,
    category: expense.category
  };
}

function normalizeYear(value: string | undefined, years: number[], fallback: number) {
  const year = Number(value);
  return years.includes(year) ? year : years[0] ?? fallback;
}

function formatMonth(month: string) {
  const [year, value] = month.split("-");
  return new Intl.DateTimeFormat("de-DE", { month: "short" }).format(new Date(Number(year), Number(value) - 1, 1));
}
