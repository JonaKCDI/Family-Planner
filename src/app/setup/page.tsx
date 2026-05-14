import { redirect } from "next/navigation";
import { setupFirstFamily } from "@/lib/actions";
import { db } from "@/lib/db";
import { buildDeploymentFacts } from "@/lib/deployment";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const userCount = await db.user.count();
  if (userCount > 0) redirect("/login");
  const deploymentFacts = buildDeploymentFacts();

  return (
    <main className="auth-wrap">
      <section className="auth-card install-card">
        <div className="install-layout">
          <div>
            <h1>Familie einrichten</h1>
            <p className="muted">Frische Installation erkannt. Lege jetzt den ersten Admin an; danach öffnet sich die App normal über den Login.</p>
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
              <button className="button" type="submit">Ersten Admin anlegen</button>
            </form>
          </div>
          <aside className="install-check">
            <div>
              <h2 className="section-title">Installationscheck</h2>
              <p className="muted">Diese Werte kommen aus Docker/DSM und werden hier nur angezeigt.</p>
            </div>
            <div className="synology-facts">
              {deploymentFacts.map((fact) => (
                <div className="synology-fact" key={fact.label}>
                  <span>{fact.label}</span>
                  <strong>{fact.value}</strong>
                  <small className={fact.ok ? "positive" : "negative"}>{fact.ok ? "ok" : "prüfen"}</small>
                  <em>{fact.hint}</em>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
