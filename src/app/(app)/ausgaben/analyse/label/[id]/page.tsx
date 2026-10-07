import { FinanceDetailAnalysis } from "@/components/finance-detail-analysis";
import type { ExpenseFilterParams } from "@/lib/expense-filter-url";

export default async function LabelAnalysisPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ExpenseFilterParams> }) {
  return <FinanceDetailAnalysis dimension="label" id={(await params).id} params={await searchParams} />;
}
