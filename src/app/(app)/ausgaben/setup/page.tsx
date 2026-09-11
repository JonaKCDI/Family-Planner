import { requireSession } from "@/lib/auth";
import { FinanceSetupBackLink, FinanceSetupOverview } from "./setup-content";
import { PageHeader } from "@/components/ui";

export default async function ExpenseSetupPage() {
  await requireSession();

  return (
    <div className="expense-setup-page-layout">
      <header className="finance-setup-head"><FinanceSetupBackLink href="/ausgaben" label="Finanzen" /><PageHeader title="Finanz-Setup" /></header>
      <FinanceSetupOverview />
    </div>
  );
}
