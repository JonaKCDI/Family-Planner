import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  ExpenseCategorySetupPanel,
  ExpenseCreateSetupPanel,
  ExpenseExcelSetupPanel,
  ExpenseLabelSetupPanel,
  ExpenseMergeSetupPanel,
  RecurringTransactionsPanel
} from "@/components/expense-setup-panel";
import { PageHeader } from "@/components/ui";
import {
  financeSetupReturnTo,
  FinanceSetupBackLink,
  financeSetupSections,
  FinanceSetupYearSelect,
  loadFinanceSetupContext,
  type FinanceSetupSectionId
} from "../setup-content";

type ExpenseSetupSectionPageProps = {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ year?: string }>;
};

export default async function ExpenseSetupSectionPage({ params, searchParams }: ExpenseSetupSectionPageProps) {
  const session = await requireSession();
  const { section } = await params;
  const query = await searchParams;
  const sectionMeta = financeSetupSections.find((item) => item.id === section);
  if (!sectionMeta) notFound();

  const sectionId = section as FinanceSetupSectionId;
  const context = await loadFinanceSetupContext(session, query.year);
  const returnTo = financeSetupReturnTo(sectionId, context.selectedYear);

  return (
    <div className="expense-setup-page-layout">
      <header className="finance-setup-head"><FinanceSetupBackLink /><PageHeader title={sectionMeta.title} /></header>
      {sectionId === "sicherung" ? <FinanceSetupYearSelect selectedYear={context.selectedYear} sectionId={sectionId} years={context.years} /> : null}
      {sectionId === "sicherung" ? <ExpenseExcelSetupPanel exportYear={context.selectedYear} returnTo={returnTo} /> : null}
      {sectionId === "anlegen" ? <ExpenseCreateSetupPanel returnTo={returnTo} /> : null}
      {sectionId === "kategorien" ? <ExpenseCategorySetupPanel categories={context.categories} returnTo={returnTo} /> : null}
      {sectionId === "labels" ? <ExpenseLabelSetupPanel allLabels={context.allLabels} returnTo={returnTo} /> : null}
      {sectionId === "zusammenfuehren" ? <ExpenseMergeSetupPanel categories={context.categories} allLabels={context.allLabels} returnTo={returnTo} /> : null}
      {sectionId === "serien" ? <RecurringTransactionsPanel recurringTransactions={context.recurringTransactions} categories={context.categories} labels={context.labels} /> : null}
    </div>
  );
}
