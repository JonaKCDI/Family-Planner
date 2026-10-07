import Link from "next/link";
import { FileSearch, List } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { formatMoney } from "@/lib/format";
import { budgetCadenceLabel } from "@/lib/expense-analytics";
import { buildExpensesHref, type ExpenseFilterParams } from "@/lib/expense-filter-url";
import { analysisEntryParams, buildAnalysisHref, type AnalysisDimension } from "@/lib/expense-detail-analysis";
import "@/app/(app)/ausgaben/analyse/analysis.css";

export function FinanceAnalysisRow({ row, dimension, params, returnParams = params, currency = "EUR" }: {
  row: { id?: string; name: string; color: string; icon?: string | null; spending: number; income: number; saldo: number; budget?: number; budgetPeriod?: "MONTHLY" | "YEARLY" | "ALL_TIME"; remaining?: number };
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
      <span className="finance-drill-copy"><strong>{name}</strong><small>{row.budget && row.budgetPeriod ? `${budgetCadenceLabel(row.budgetPeriod)} · Budget ${formatMoney(row.budget, currency)} · ${row.remaining !== undefined && row.remaining < 0 ? `${formatMoney(Math.abs(row.remaining), currency)} drüber` : `${formatMoney(row.remaining ?? 0, currency)} frei`}` : "Saldo im Zeitraum"}</small></span>
      <span className="finance-drill-amount"><strong className={row.saldo < 0 ? "negative" : "positive"}>{formatMoney(row.saldo, currency)}</strong></span>
    </Link>
    <div className="finance-drill-actions">
      <Link href={buildExpensesHref(analysisEntryParams(params, dimension, id))} className="finance-analysis-icon" aria-label={`Buchungen: ${name}`} title="Buchungen anzeigen"><List size={19} /></Link>
      <Link href={analysisHref} className="finance-analysis-icon" aria-label={`Analyse: ${name}`} title="Verlauf analysieren"><FileSearch size={19} /></Link>
    </div>
  </div>;
}
