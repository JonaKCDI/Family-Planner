import Link from "next/link";
import { ArrowLeft, ChevronRight, FolderLock, KeyRound, LockKeyhole, Server, ShieldCheck, Users } from "lucide-react";
import { SettingsDocumentAccess } from "@/components/settings-document-access";
import { SettingsDisclosure } from "@/components/settings-disclosure";
import type { FamilyRole } from "@prisma/client";
import { archiveDocumentRoot, changeOwnPassword, createDocumentRoot, createUser, resetMemberPassword, restoreDocumentRoot, setAdminRecoveryKey } from "@/lib/actions";
import { db } from "@/lib/db";
import { buildDeploymentFacts } from "@/lib/deployment";
import { getConfiguredDocumentsDir } from "@/lib/document-root-default";
import { getFamilyMembers } from "@/lib/queries";
import { EmptyState } from "@/components/ui";

export const settingsSections = [
  {
    id: "konto",
    title: "Konto",
    description: "Eigenes Passwort ändern und persönliche Sicherheit verwalten.",
    adminOnly: false
  },
  {
    id: "mitglieder",
    title: "Mitglieder",
    description: "Familienmitglieder ansehen, anlegen und Passwörter zurücksetzen.",
    adminOnly: true
  },
  {
    id: "wiederherstellung",
    title: "Wiederherstellung",
    description: "Notfallschlüssel für ausgesperrte Admin-Konten verwalten.",
    adminOnly: true
  },
  {
    id: "dokumentbereiche",
    title: "Dokumentbereiche",
    description: "NAS-Ordner und Sichtbarkeit für lokale Dokumente festlegen.",
    adminOnly: true
  },
  {
    id: "synology",
    title: "Synology & Betrieb",
    description: "Deployment-Werte, Ordner-Mounts und Betriebs-Checkliste prüfen.",
    adminOnly: true
  }
] as const;

export type SettingsSectionId = typeof settingsSections[number]["id"];

export type SettingsContext = Awaited<ReturnType<typeof loadSettingsContext>>;

export async function loadSettingsContext(session: {
  family: { id: string };
  user: { id: string };
  role: FamilyRole;
}) {
  const isAdmin = session.role === "ADMIN";
  const [members, documentRoots, recoveryKey] = await Promise.all([
    getFamilyMembers(session.family.id),
    isAdmin ? db.documentRoot.findMany({
      where: { familyId: session.family.id },
      include: {
        accesses: { include: { user: { select: { id: true, name: true } } } },
        createdBy: { select: { id: true, name: true } }
      },
      orderBy: [{ archivedAt: "asc" }, { name: "asc" }]
    }) : Promise.resolve([]),
    db.adminRecoveryKey.findUnique({
      where: { familyId: session.family.id },
      select: { updatedAt: true, lastUsedAt: true }
    })
  ]);

  return {
    isAdmin,
    members,
    documentRoots,
    documentBasePath: getConfiguredDocumentsDir(),
    recoveryKey,
    synologyFacts: buildDeploymentFacts()
  };
}

const sectionIcons = { konto: LockKeyhole, mitglieder: Users, wiederherstellung: KeyRound, dokumentbereiche: FolderLock, synology: Server };

export function SettingsOverview({ context, name, familyName }: { context: SettingsContext; name: string; familyName: string }) {
  const summaries = {
    konto: "Passwort & Sicherheit",
    mitglieder: `${context.members.length} Familienmitglieder`,
    wiederherstellung: context.recoveryKey ? "Notfallschlüssel eingerichtet" : "Notfallschlüssel einrichten",
    dokumentbereiche: `${context.documentRoots.filter((root) => !root.archivedAt).length} aktive Bereiche · Ordner & Zugriff`,
    synology: "Verbindung, Speicher & Betrieb"
  };
  return (
    <>
      <Link href="/einstellungen/konto" className="settings-profile">
        <span className="settings-avatar" aria-hidden="true">{name.slice(0, 1).toLocaleUpperCase("de")}</span>
        <span className="settings-profile-copy"><strong>{name}</strong><span>{familyName} · {context.isAdmin ? "Admin" : "Mitglied"}</span></span>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
      <div className="settings-groups">
        {[{ title: "Persönlich", ids: ["konto"] }, { title: "Familie & Zugriff", ids: ["mitglieder", "dokumentbereiche"] }, { title: "Sicherheit & Betrieb", ids: ["wiederherstellung", "synology"] }].map((group) => (
          <section className="settings-group" key={group.title}>
            <h2>{group.title}</h2>
            <div className="settings-list">
              {settingsSections.filter((section) => group.ids.includes(section.id)).map((section) => {
                const Icon = sectionIcons[section.id];
                const locked = section.adminOnly && !context.isAdmin;
                const content = <><span className={`settings-row-icon tone-${section.id}`}><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span><span className="settings-row-copy"><strong>{section.id === "wiederherstellung" ? "Wiederherstellung" : section.title}</strong><span>{locked ? "Von euren Admins verwaltet" : summaries[section.id]}</span></span>{locked ? <LockKeyhole size={16} aria-label="Nur Admins" /> : <ChevronRight size={17} aria-hidden="true" />}</>;
                return locked ? <div className="settings-nav-row is-locked" key={section.id}>{content}</div> : <Link className="settings-nav-row" id={section.id} href={`/einstellungen/${section.id}`} key={section.id}>{content}</Link>;
              })}
            </div>
          </section>
        ))}
      </div>
      <p className="settings-footnote"><ShieldCheck size={15} aria-hidden="true" />{context.isAdmin ? "Du verwaltest die Einstellungen eurer Familie." : "Familieneinstellungen werden von euren Admins verwaltet."}</p>
    </>
  );
}

export function SettingsBackLink() {
  return <Link className="settings-back-link" href="/einstellungen"><ArrowLeft size={17} aria-hidden="true" /> Einstellungen</Link>;
}

export function SettingsInfo({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="settings-info">
      <summary aria-label={`Info: ${title}`} title={title}>Hinweise</summary>
      <div>
        <strong>{title}</strong>
        <div>{children}</div>
      </div>
    </details>
  );
}

export function AccountSettings({ params }: { params: { password?: string } }) {
  return (
    <section className="panel settings-detail-panel">
      <div className="settings-detail-head">
        <div>
          <h2 className="section-title">Eigenes Passwort ändern</h2>
          <p className="muted">Ändert nur dein eigenes Login-Passwort.</p>
        </div>
        <SettingsInfo title="Passwort-Regeln">
          <p>Das neue Passwort braucht mindestens 8 Zeichen. Nach dem Speichern werden alte Sitzungen beendet und du bleibst mit einer neuen Sitzung angemeldet.</p>
        </SettingsInfo>
      </div>
      {params.password === "changed" ? <p className="badge spacing-bottom">Passwort wurde geändert.</p> : null}
      <form action={changeOwnPassword} className="form settings-form-card">
        <label>Aktuelles Passwort<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
        <label>Neues Passwort<input name="newPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label>Neues Passwort wiederholen<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
        <button className="button" type="submit">Passwort ändern</button>
      </form>
    </section>
  );
}

export function MemberSettings({ context, currentUserId }: { context: SettingsContext; currentUserId: string }) {
  return (
    <section className="panel settings-detail-panel">
      <div className="settings-detail-head">
        <div>
          <h2 className="section-title">Eure Familie</h2>
          <p className="muted">Konten und Rollen auf einen Blick.</p>
        </div>
        <SettingsInfo title="Mitgliederverwaltung">
          <p>Neue Mitglieder bekommen eigene Kategorien. Passwort-Resets beenden die bestehenden Sitzungen des betroffenen Kontos. Admins ändern ihr eigenes Passwort im Bereich Konto.</p>
        </SettingsInfo>
      </div>
      {context.isAdmin ? (
        <SettingsDisclosure title="Mitglied hinzufügen">
        <form action={createUser} className="form form-grid settings-form-card">
          <label>Name<input name="name" required /></label>
          <label>Start-Passwort<input name="password" type="password" minLength={8} required /></label>
          <label>Rolle<select name="role" defaultValue="MEMBER"><option value="MEMBER">Mitglied</option><option value="ADMIN">Admin</option></select></label>
          <button className="button full-span" type="submit">Mitglied anlegen</button>
        </form>
        </SettingsDisclosure>
      ) : (
        <EmptyState>Nur Admins können neue Familienmitglieder anlegen.</EmptyState>
      )}
      <div className="settings-member-list">
        {context.members.map((member) => {
          const canResetPassword = context.isAdmin && member.userId !== currentUserId;
          return (
            <article className="card settings-member-card" key={member.id}>
              <div className="row">
                <div>
                  <strong>{member.user.name}</strong>
                  <span className="muted">{member.userId === currentUserId ? "Dein Konto" : member.status === "ACTIVE" ? "Aktiv" : "Eingeladen"}</span>
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
  );
}

export function RecoverySettings({ context, params }: { context: SettingsContext; params: { recovery?: string } }) {
  return (
    <section className="panel settings-detail-panel">
      <div className="settings-detail-head">
        <div>
          <h2 className="section-title">Notfallschlüssel</h2>
          <p className="muted">Status: {context.recoveryKey ? "eingerichtet" : "nicht eingerichtet"}</p>
        </div>
        <SettingsInfo title="Wie der Notfallschlüssel funktioniert">
          <ol>
            <li>Der Schlüssel wird nur als Hash gespeichert.</li>
            <li>Im Notfall öffnest du <code>/admin-recovery</code> und setzt ein neues Admin-Passwort.</li>
            <li>Nach einer Wiederherstellung solltest du den Schlüssel hier ersetzen.</li>
          </ol>
        </SettingsInfo>
      </div>
      {params.recovery === "changed" ? <p className="badge spacing-bottom">Notfallschlüssel wurde gespeichert.</p> : null}
      {context.isAdmin ? (
        <form action={setAdminRecoveryKey} className="form settings-form-card">
          <p className="muted">Verwende mindestens 20 Zeichen und bewahre den Schlüssel sicher außerhalb der App auf.</p>
          <label>Notfallschlüssel<input name="recoveryKey" type="password" autoComplete="new-password" minLength={20} required /></label>
          <label>Notfallschlüssel wiederholen<input name="confirmRecoveryKey" type="password" autoComplete="new-password" minLength={20} required /></label>
          <button className="button" type="submit">{context.recoveryKey ? "Notfallschlüssel ersetzen" : "Notfallschlüssel speichern"}</button>
        </form>
      ) : (
        <EmptyState>Nur Admins können den Notfallschlüssel verwalten.</EmptyState>
      )}
    </section>
  );
}

export function DocumentRootSettings({ context }: { context: SettingsContext }) {
  return (
    <section className="panel settings-detail-panel" id="dokumentbereiche">
      <div className="settings-detail-head">
        <div>
          <h2 className="section-title">Dokumentbereiche & Rechte</h2>
          <p className="muted">NAS-Ordner und Sichtbarkeit in der App.</p>
        </div>
        <SettingsInfo title="Dokumentbereiche sicher einrichten">
          <p>Der Pfad ist der Container-Pfad, zum Beispiel <code>{context.documentBasePath}</code>. Auf Synology sollte nur ein schmaler Dokumentordner read-only gemountet werden, nicht <code>/volume1</code>.</p>
        </SettingsInfo>
      </div>
      {context.isAdmin ? (
        <>
          <SettingsDisclosure title="Dokumentbereich hinzufügen">
          <form action={createDocumentRoot} className="form form-grid document-root-form settings-form-card">
            <label>Name<input name="name" placeholder="Familie, Finanzen, Versicherungen ..." required /></label>
            <label>Dokumentenpfad<input name="basePath" defaultValue={context.documentBasePath} required /></label>
            <SettingsDocumentAccess members={context.members.map((member) => ({ id: member.userId, name: member.user.name }))} />
            <div className="modal-submit-row"><button className="button" type="submit">Bereich speichern</button></div>
          </form>
          </SettingsDisclosure>
          <div className="document-root-list">
            {context.documentRoots.length === 0 ? <EmptyState>Noch kein Dokumentbereich eingerichtet.</EmptyState> : null}
            {context.documentRoots.map((root) => (
              <article className={root.archivedAt ? "document-root-row is-archived" : "document-root-row"} key={root.id}>
                <div>
                  <strong>{root.name}</strong>
                  <span className="muted">{root.basePath}</span>
                  <div className="badge-row">
                    <span className="badge">{root.scope === "FAMILY" ? "Familie" : "Eingeschränkt"}</span>
                    {root.archivedAt ? <span className="badge">Archiviert</span> : null}
                    {root.accesses.map((access) => (
                      <span className="badge" key={access.id}>
                        {access.role === "ADMIN" ? "Admins" : access.user?.name ?? "Nutzer"}
                      </span>
                    ))}
                  </div>
                </div>
                <form action={root.archivedAt ? restoreDocumentRoot : archiveDocumentRoot}>
                  <input type="hidden" name="id" value={root.id} />
                  <button className="button secondary" type="submit">{root.archivedAt ? "Wiederherstellen" : "Archivieren"}</button>
                </form>
              </article>
            ))}
          </div>
        </>
      ) : (
        <EmptyState>Nur Admins können Dokumentbereiche verwalten.</EmptyState>
      )}
    </section>
  );
}

export function SynologySettings({ context }: { context: SettingsContext }) {
  return (
    <section className="panel settings-detail-panel">
      <div className="settings-detail-head">
        <div>
          <h2 className="section-title">Aktuelle Konfiguration</h2>
          <p className="muted">Deployment-Werte und NAS-Mounts prüfen.</p>
        </div>
        <SettingsInfo title="Betriebs-Checkliste">
          <ol>
            <li><code>APP_URL</code> muss zur finalen HTTPS-Adresse passen.</li>
            <li>Excel-, Mileage-, Dokument- und Backup-Ordner sollten dauerhaft auf Synology gemountet sein.</li>
            <li>Dokumente read-only und möglichst schmal mounten.</li>
            <li>Nach Env-Änderungen Container neu erstellen oder neu starten.</li>
          </ol>
        </SettingsInfo>
      </div>
      {context.isAdmin ? (
        <div className="synology-facts">
          {context.synologyFacts.map((fact) => (
            <div className="synology-fact" key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
              <small className={fact.ok ? "positive" : "negative"}>{fact.ok ? "gesetzt" : "prüfen"}</small>
              <em>{fact.hint}</em>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>Nur Admins sehen die Synology-Betriebswerte.</EmptyState>
      )}
    </section>
  );
}
