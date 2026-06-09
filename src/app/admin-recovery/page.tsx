import Link from "next/link";
import { redirect } from "next/navigation";
import { recoverAdminPassword } from "@/lib/actions";
import { getCurrentSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminRecoveryPage() {
  const userCount = await db.user.count();
  if (userCount === 0) redirect("/setup");

  const session = await getCurrentSession();
  if (session) redirect("/dashboard");

  const recoveryEnabled = await db.adminRecoveryKey.count() > 0;

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <h1>Admin wiederherstellen</h1>
        <p className="muted">Diese Seite ist nur für den Notfall gedacht, wenn kein Admin mehr in die App kommt.</p>
        {recoveryEnabled ? (
          <form action={recoverAdminPassword} className="form">
            <label>
              Admin-Name
              <input name="name" autoComplete="username" required />
            </label>
            <label>
              Notfallschlüssel
              <input name="recoveryKey" type="password" autoComplete="one-time-code" required />
            </label>
            <label>
              Neues Admin-Passwort
              <input name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
            </label>
            <label>
              Neues Admin-Passwort wiederholen
              <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
            </label>
            <button className="button danger" type="submit">Admin-Passwort setzen</button>
          </form>
        ) : (
          <div className="empty">
            Es ist noch kein Notfallschlüssel eingerichtet. Ein eingeloggter Admin kann ihn in den Einstellungen speichern.
          </div>
        )}
        <p className="muted"><Link href="/login">Zurück zum Login</Link></p>
      </section>
    </main>
  );
}
