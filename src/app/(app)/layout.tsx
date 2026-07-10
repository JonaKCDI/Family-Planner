import { logout } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { getExpenseLabels, getFamilyMembers, getFuelExpenseSettings, getVisibleCars, getVisibleCategories, getVisibleContracts, getVisibleDocumentRoots } from "@/lib/queries";
import { CreateModal } from "@/components/create-modal";
import { GlobalSubmitIndicator } from "@/components/global-submit-indicator";
import { Nav } from "@/components/nav";
import { OfflineSyncStatus } from "@/components/offline-sync-status";
import { AppHeader, AppMain, AppShell } from "@/components/ui-system";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const [categories, labels, contracts, members, cars, fuelExpenseSettings, documentRoots] = await Promise.all([
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getExpenseLabels(session.family.id, session.user.id),
    getVisibleContracts(session.family.id, session.user.id),
    getFamilyMembers(session.family.id),
    getVisibleCars(session.family.id),
    getFuelExpenseSettings(session.family.id, session.user.id),
    getVisibleDocumentRoots(session.family.id, session.user.id, session.role)
  ]);

  return (
    <AppShell
      navigation={<Nav />}
      createAction={<CreateModal categories={categories} labels={labels} contracts={contracts} members={members} cars={cars} fuelExpenseSettings={fuelExpenseSettings} documentRoots={documentRoots} />}
    >
      <AppHeader appName="Familien-App" familyName={session.family.name} userName={session.user.name} logoutAction={logout} />
      <div className="app-frame">
        <AppMain>
          <GlobalSubmitIndicator />
          <OfflineSyncStatus />
          {children}
        </AppMain>
      </div>
    </AppShell>
  );
}
