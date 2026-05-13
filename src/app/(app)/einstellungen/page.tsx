import { createUser } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { getFamilyMembers } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/ui";

export default async function SettingsPage() {
  const session = await requireSession();
  const members = await getFamilyMembers(session.family.id);
  const isAdmin = session.role === "ADMIN";

  return (
    <>
      <PageHeader title="Einstellungen" description="Familienmitglieder, Rollen und technische Leitplanken für den Haushalt." />
      <div className="grid two">
        <section className="panel">
          <h2 className="section-title">Familienmitglied anlegen</h2>
          {isAdmin ? (
            <form action={createUser} className="form">
              <label>Name<input name="name" required /></label>
              <label>Start-Passwort<input name="password" type="password" minLength={6} required /></label>
              <label>
                Rolle
                <select name="role" defaultValue="MEMBER">
                  <option value="MEMBER">Mitglied</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>
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
    </>
  );
}
