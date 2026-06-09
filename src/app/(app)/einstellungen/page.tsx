import { changeOwnPassword, createUser, resetMemberPassword, setAdminRecoveryKey } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildDeploymentFacts } from "@/lib/deployment";
import { getFamilyMembers } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/ui";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ password?: string; recovery?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;
  const members = await getFamilyMembers(session.family.id);
  const recoveryKey = await db.adminRecoveryKey.findUnique({
    where: { familyId: session.family.id },
    select: { updatedAt: true, lastUsedAt: true }
  });
  const isAdmin = session.role === "ADMIN";
  const synologyFacts = buildDeploymentFacts();

  return (
    <>
      <PageHeader title="Einstellungen" />
      {params.password === "changed" ? <p className="badge spacing-bottom">Passwort wurde geändert.</p> : null}
      {params.recovery === "changed" ? <p className="badge spacing-bottom">Notfallschlüssel wurde gespeichert.</p> : null}

      <div className="grid two">
        <section className="panel">
          <h2 className="section-title">Eigenes Passwort ändern</h2>
          <form action={changeOwnPassword} className="form">
            <label>Aktuelles Passwort<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
            <label>Neues Passwort<input name="newPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
            <label>Neues Passwort wiederholen<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
            <button className="button" type="submit">Passwort ändern</button>
          </form>
        </section>

        <section className="panel">
          <h2 className="section-title">Familienmitglied anlegen</h2>
          {isAdmin ? (
            <form action={createUser} className="form">
              <label>Name<input name="name" required /></label>
              <label>Start-Passwort<input name="password" type="password" minLength={8} required /></label>
              <label>Rolle<select name="role" defaultValue="MEMBER"><option value="MEMBER">Mitglied</option><option value="ADMIN">Admin</option></select></label>
              <button className="button" type="submit">Anlegen</button>
            </form>
          ) : (
            <EmptyState>Nur Admins können neue Familienmitglieder anlegen.</EmptyState>
          )}
        </section>
      </div>

      <section className="panel spacing-top">
        <div className="section-head">
          <div>
            <h2 className="section-title">Haushalt</h2>
            <p className="muted">Aktive Mitglieder und Zugriff auf Passwort-Resets.</p>
          </div>
          {isAdmin ? <span className="badge">Admin</span> : null}
        </div>
        <div className="settings-member-list">
          {members.map((member) => {
            const canResetPassword = isAdmin && member.userId !== session.user.id;
            return (
              <article className="card settings-member-card" key={member.id}>
                <div className="row">
                  <div>
                    <strong>{member.user.name}</strong>
                    <span className="muted">{member.userId === session.user.id ? "Dein Konto" : member.status}</span>
                  </div>
                  <span className="badge">{member.role === "ADMIN" ? "Admin" : "Mitglied"}</span>
                </div>
                {canResetPassword ? (
                  <details className="settings-reset">
                    <summary>Passwort zurücksetzen</summary>
                    <form action={resetMemberPassword} className="form compact">
                      <input type="hidden" name="userId" value={member.userId} />
                      <label>Neues Passwort<input name="newPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
                      <label>Neues Passwort wiederholen<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
                      <button className="button danger" type="submit">Passwort setzen</button>
                    </form>
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel spacing-top">
        <div className="section-head">
          <div>
            <h2 className="section-title">Notfall-Wiederherstellung</h2>
            <p className="muted">Falls alle Admins ausgesperrt sind, kann ein Admin-Konto mit dem Notfallschlüssel wieder geöffnet werden.</p>
          </div>
          <span className="badge">{recoveryKey ? "eingerichtet" : "nicht eingerichtet"}</span>
        </div>
        {isAdmin ? (
          <form action={setAdminRecoveryKey} className="form">
            <label>Notfallschlüssel<input name="recoveryKey" type="password" autoComplete="new-password" minLength={20} required /></label>
            <label>Notfallschlüssel wiederholen<input name="confirmRecoveryKey" type="password" autoComplete="new-password" minLength={20} required /></label>
            <button className="button" type="submit">{recoveryKey ? "Notfallschlüssel ersetzen" : "Notfallschlüssel speichern"}</button>
          </form>
        ) : (
          <EmptyState>Nur Admins können den Notfallschlüssel verwalten.</EmptyState>
        )}
        <div className="setup-steps">
          <ol>
            <li>Den Notfallschlüssel lang und eindeutig wählen, am besten aus einem Passwortmanager.</li>
            <li>Den Schlüssel außerhalb der App aufbewahren; gespeichert wird nur ein Hash.</li>
            <li>Im Notfall `/admin-recovery` öffnen, Admin-Namen und Notfallschlüssel eingeben und ein neues Passwort setzen.</li>
            <li>Nach einer Wiederherstellung den Notfallschlüssel in den Einstellungen ersetzen.</li>
          </ol>
        </div>
      </section>

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
                <li>In Synology Container Manager die `.env` Werte für `APP_URL`, `POSTGRES_PASSWORD`, `EXPENSE_EXCEL_HOST_DIR`, `EXPENSE_EXCEL_DIR`, `MILEAGE_EXCEL_HOST_DIR`, `MILEAGE_EXCEL_DIR`, `BACKUP_DIR`, `BACKUP_TIME` und `TZ` setzen.</li>
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
