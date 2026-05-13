import Link from "next/link";
import { logout } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { FabMenu } from "@/components/fab-menu";
import { Nav } from "@/components/nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark" aria-hidden="true">FA</span>
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
        <main className="content">{children}</main>
      </div>
      <FabMenu />
    </div>
  );
}
