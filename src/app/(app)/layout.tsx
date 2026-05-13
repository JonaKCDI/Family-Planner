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
        <Link className="brand" href="/ausgaben">
          <strong>Familien-App</strong>
          <span>{session.family.name} · {session.user.name}</span>
        </Link>
        <form action={logout}>
          <button className="button secondary" type="submit">Logout</button>
        </form>
      </header>
      <Nav />
      <main className="content">{children}</main>
      <FabMenu />
    </div>
  );
}
