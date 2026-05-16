import Link from "next/link";
import Image from "next/image";
import { logout } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { getExpenseLabels, getFamilyMembers, getVisibleCategories, getVisibleContracts } from "@/lib/queries";
import { CreateModal } from "@/components/create-modal";
import { GlobalSubmitIndicator } from "@/components/global-submit-indicator";
import { Nav } from "@/components/nav";
import { OfflineSyncStatus } from "@/components/offline-sync-status";
import { LogoutForm } from "@/components/logout-form";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const [categories, labels, contracts, members] = await Promise.all([
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getExpenseLabels(session.family.id, session.user.id),
    getVisibleContracts(session.family.id, session.user.id),
    getFamilyMembers(session.family.id)
  ]);

  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark" aria-hidden="true">
            <Image src="/icon.svg" alt="" width={34} height={34} priority />
          </span>
          <span className="brand-copy">
            <strong>Familien-App</strong>
            <span>{session.family.name} · {session.user.name}</span>
          </span>
        </Link>
        <LogoutForm action={logout} />
      </header>
      <div className="app-frame">
        <Nav />
        <main className="content">
          <GlobalSubmitIndicator />
          <OfflineSyncStatus />
          {children}
        </main>
      </div>
      <CreateModal categories={categories} labels={labels} contracts={contracts} members={members} />
    </div>
  );
}
