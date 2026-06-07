import { createUser } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { buildDeploymentFacts } from "@/lib/deployment";
import { getFamilyMembers } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/ui";

export default async function SettingsPage() {
  const session = await requireSession();
  const members = await getFamilyMembers(session.family.id);
  const isAdmin = session.role === "ADMIN";
  const synologyFacts = buildDeploymentFacts();

  return (
    <>
      <PageHeader title="Einstellungen" />
      <div className="grid two">
        <section className="panel">
          <h2 className="section-title">Familienmitglied anlegen</h2>
          {isAdmin ? (
            <form action={createUser} className="form">
              <label>Name<input name="name" required /></label>
              <label>Start-Passwort<input name="password" type="password" minLength={10} required /></label>
              <label>Rolle<select name="role" defaultValue="MEMBER"><option value="MEMBER">Mitglied</option><option value="ADMIN">Admin</option></select></label>
              <button className="button" type="submit">Anlegen</button>
            </form>
          ) : (
            <EmptyState>Nur Admins können neue Familienmitglieder anlegen.</EmptyState>
          )}
        </section>
        <section className="panel">
          <h2 className="section-title">Haushalt</h2>
          <div className="list">
            {members.map((member) => (
              <article className="card row" key={member.id}>
                <div>
                  <strong>{member.user.name}</strong>
                  <span className="muted">{member.status}</span>
                </div>
                <span className="badge">{member.role}</span>
              </article>
            ))}
          </div>
        </section>
      </div>

      {isAdmin ? (
        <section className="panel spacing-top">
          <div className="section-head">
            <div>
              <h2 className="section-title">Synology</h2>
            </div>
            <span className="badge">Admin</span>
          </div>
          <div className="synology-grid">
            <div className="synology-facts">
              {synologyFacts.map((fact) => (
                <div className="synology-fact" key={fact.label}>
                  <span>{fact.label}</span>
                  <strong>{fact.value}</strong>
                  <small className={fact.ok ? "positive" : "negative"}>{fact.ok ? "gesetzt" : "prüfen"}</small>
                  <em>{fact.hint}</em>
                </div>
              ))}
            </div>
            <div className="setup-steps">
              <ol>
                <li>In Synology Container Manager die `.env` Werte für `APP_URL`, `POSTGRES_PASSWORD`, `EXPENSE_EXCEL_HOST_DIR`, `EXPENSE_EXCEL_DIR`, `MILEAGE_EXCEL_HOST_DIR`, `MILEAGE_EXCEL_DIR` und `BACKUP_DIR` setzen.</li>
                <li>`EXPENSE_EXCEL_HOST_DIR` als Ordner nach `/data/expenses` mounten, damit Excel-Import und -Export dauerhaft auf dem NAS liegen.</li>
                <li>`MILEAGE_EXCEL_HOST_DIR` als Ordner nach `/data/mileage` mounten, damit Verbrauchsdateien pro Auto dauerhaft auf dem NAS liegen.</li>
                <li>`BACKUP_DIR` als echten Synology-Ordner mounten und regelmäßig in Hyper Backup oder Snapshot Replication sichern.</li>
                <li>Nach jeder Env-Änderung Container neu erstellen oder neu starten und danach Login, Excel-Export und Backup-Dateien prüfen.</li>
              </ol>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
