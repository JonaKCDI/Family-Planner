import { FamilyFinanceSetup } from "@/components/family-finance-setup";
import { FinanceAreaSwitch } from "@/components/finance-area-switch";
import { requireSession } from "@/lib/auth";
import { DesktopFinanceSetupNav, FinanceSetupBackLink, FinanceSetupOverview } from "./setup-content";
import { PageHeader } from "@/components/ui";

export default async function ExpenseSetupPage({ searchParams }: { searchParams: Promise<{ bereich?: string }> }) {
  await requireSession();
  if ((await searchParams).bereich === "familie") return <FamilyFinanceSetup />;

  return (
    <div className="desktop-section-layout">
      <DesktopFinanceSetupNav />
      <div className="desktop-section-main expense-setup-page-layout">
        <header className="finance-setup-head"><FinanceSetupBackLink href="/ausgaben" label="Finanzen" /><PageHeader title="Finanz-Setup" /></header>
        <FinanceAreaSwitch />
        <FinanceSetupOverview />
      </div>
    </div>
  );
}
