import Link from "next/link";
import { logout } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { getExpenseLabels, getFamilyMembers, getVisibleCategories } from "@/lib/queries";
import { CreateModal } from "@/components/create-modal";
import { Nav } from "@/components/nav";
import { OfflineSyncStatus } from "@/components/offline-sync-status";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const [categories, labels, members] = await Promise.all([
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getExpenseLabels(session.family.id, session.user.id),
    getFamilyMembers(session.family.id)
  ]);

  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark" aria-hidden="true">F</span>
          <span className="brand-copy">
            <strong>Familien-App</strong>
            <span>{session.family.name} · {session.user.name}</span>
          </span>
        </Link>
        <form action={logout}>
          <button className="button secondary" type="submit">Logout</button>
        </form>
      </header>
      <div className="app-frame">
        <Nav />
        <main className="content">
          <OfflineSyncStatus />
          {children}
        </main>
      </div>
      <CreateModal categories={categories} labels={labels} members={members} />
    </div>
  );
}
