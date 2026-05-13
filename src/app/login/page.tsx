import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/lib/actions";
import { getCurrentSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const userCount = await db.user.count();
  if (userCount === 0) redirect("/setup");

  const session = await getCurrentSession();
  if (session) redirect("/ausgaben");

  const params = await searchParams;

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <h1>Anmelden</h1>
        <p className="muted">Melde dich mit deinem Familien-App-Namen und Passwort an.</p>
        {params.error ? <p className="badge">Name oder Passwort stimmt nicht.</p> : null}
        <form action={login} className="form">
          <label>
            Name
            <input name="name" autoComplete="username" required />
          </label>
          <label>
            Passwort
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="button" type="submit">Einloggen</button>
        </form>
        <p className="muted">Noch keine Familie? <Link href="/setup">Setup pruefen</Link></p>
      </section>
    </main>
  );
}
