import Link from "next/link";
import { FileSearch, List } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { formatMoney } from "@/lib/format";
import { buildExpensesHref, type ExpenseFilterParams } from "@/lib/expense-filter-url";
import { analysisEntryParams, buildAnalysisHref, type AnalysisDimension } from "@/lib/expense-detail-analysis";
import "@/app/(app)/ausgaben/analyse/analysis.css";

export function FinanceAnalysisRow({ row, dimension, params, returnParams = params, currency = "EUR", percent }: {
  row: { id?: string; name: string; color: string; icon?: string | null; spending: number; income: number };
  dimension: AnalysisDimension;
  params: ExpenseFilterParams;
  returnParams?: ExpenseFilterParams;
  currency?: string;
  percent?: number;
}) {
  const id = row.id ?? "unassigned";
  const name = !row.id && params.bereich === "familie" ? "Nicht zugeordnet" : row.name;
  const analysisHref = buildAnalysisHref(params, dimension, id, returnParams);
  return <div className="finance-drill-row">
    <Link href={analysisHref} className="finance-drill-main" aria-label={`${name} analysieren`}>
      <span className="analysis-row-icon" style={{ background: row.color }} aria-hidden="true"><CategoryIcon icon={row.icon} size={17} /></span>
      <span className="finance-drill-copy"><strong>{name}</strong><small>{typeof percent === "number" ? `${percent.toLocaleString("de-DE", { maximumFractionDigits: 0 })} % der Ausgaben` : "Ausgaben im Zeitraum"}</small></span>
      <span className="finance-drill-amount"><strong>{formatMoney(row.spending, currency)}</strong>{row.income > 0 && <small>+ {formatMoney(row.income, currency)} Einnahmen</small>}</span>
    </Link>
    <div className="finance-drill-actions">
      <Link href={buildExpensesHref(analysisEntryParams(params, dimension, id))} className="finance-analysis-icon" aria-label={`Buchungen: ${name}`} title="Buchungen anzeigen"><List size={19} /></Link>
      <Link href={analysisHref} className="finance-analysis-icon" aria-label={`Analyse: ${name}`} title="Verlauf analysieren"><FileSearch size={19} /></Link>
    </div>
  </div>;
}
