import { redirect } from "next/navigation";
import { setupFirstFamily } from "@/lib/actions";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const userCount = await db.user.count();
  if (userCount > 0) redirect("/login");

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <h1>Familie einrichten</h1>
        <p className="muted">Erstelle den ersten Admin und den Haushalt. Danach können weitere Familienmitglieder eingeladen werden.</p>
        <form action={setupFirstFamily} className="form">
          <label>
            Dein Name
            <input name="name" autoComplete="username" required />
          </label>
          <label>
            Familienname
            <input name="familyName" defaultValue="Familie" required />
          </label>
          <label>
            Passwort
            <input name="password" type="password" autoComplete="new-password" minLength={6} required />
          </label>
          <button className="button" type="submit">App einrichten</button>
        </form>
      </section>
    </main>
  );
}
