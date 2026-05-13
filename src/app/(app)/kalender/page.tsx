import { createCalendarEvent, createCalendarIntegration, deleteCalendarIntegration, syncCalendarIntegration } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getCalendarIntegrations, getVisibleCalendarEvents } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/ui";

const providerLabels = {
  OUTLOOK: "Outlook",
  ICLOUD: "iCloud",
  CALDAV: "CalDAV",
  MANUAL: "Manuell"
};

const visibilityLabels = {
  PRIVATE: "Privat",
  BUSY_ONLY: "Nur beschäftigt",
  TITLE_ONLY: "Nur Titel",
  FAMILY: "Voll sichtbar"
};

export default async function CalendarPage() {
  const session = await requireSession();
  const [events, integrations] = await Promise.all([
    getVisibleCalendarEvents(session.family.id, session.user.id),
    getCalendarIntegrations(session.family.id, session.user.id)
  ]);

  return (
    <>
      <PageHeader
        title="Kalender"
        description="Manuelle Familientermine und vorbereitete Kalenderquellen für Outlook, iCloud und CalDAV."
      />

      <div className="grid two">
        <section className="panel">
          <h2 className="section-title">Kalenderquelle vorbereiten</h2>
          <form action={createCalendarIntegration} className="form">
            <label>
              Anbieter
              <select name="provider" defaultValue="OUTLOOK">
                <option value="OUTLOOK">Outlook</option>
                <option value="ICLOUD">iCloud</option>
                <option value="CALDAV">CalDAV</option>
                <option value="MANUAL">Manueller Kalender</option>
              </select>
            </label>
            <label>
              Anzeigename
              <input name="displayName" placeholder="Jona Arbeit, Familie iCloud, Schule ..." required />
            </label>
            <fieldset className="fieldset">
              <legend>iCloud oder CalDAV synchronisieren</legend>
              <label>
                Kalender-URL
                <input name="calendarUrl" type="url" placeholder="iCloud leer lassen oder CalDAV-URL eintragen" />
              </label>
              <label>
                Benutzername
                <input name="username" autoComplete="username" />
              </label>
              <label>
                Passwort oder App-spezifisches Passwort
                <input name="password" type="password" autoComplete="current-password" />
              </label>
            </fieldset>
            <label>
              Sichtbarkeit für Familie
              <select name="visibilityToFamily" defaultValue="BUSY_ONLY">
                <option value="PRIVATE">Privat</option>
                <option value="BUSY_ONLY">Nur beschäftigt</option>
                <option value="TITLE_ONLY">Nur Titel</option>
                <option value="FAMILY">Voll sichtbar</option>
              </select>
            </label>
            <button className="button" type="submit">Quelle vorbereiten</button>
          </form>
          <p className="muted">
            iCloud wird über CalDAV mit einem Apple App-spezifischen Passwort synchronisiert. Outlook bleibt wegen Microsoft OAuth ein eigener nächster Schritt.
          </p>
        </section>

        <section className="panel">
          <h2 className="section-title">Vorbereitete Quellen</h2>
          <div className="list">
            {integrations.length === 0 ? <EmptyState>Noch keine Kalenderquellen vorbereitet.</EmptyState> : null}
            {integrations.map((integration) => (
              <article className="card row" key={integration.id}>
                <div>
                  <strong>{integration.displayName}</strong>
                  <span className="muted">
                    {providerLabels[integration.provider]} · {visibilityLabels[integration.visibilityToFamily]} · Status: {integration.status}
                  </span>
                  <div className="badge-row">
                    <span className="badge">{integration.syncEnabled ? "Sync aktiv" : "Sync später"}</span>
                    {integration.lastSyncAt ? <span className="badge">Zuletzt: {formatDate(integration.lastSyncAt)}</span> : null}
                    <span className="badge">{integration.user.name}</span>
                  </div>
                  {integration.lastSyncError ? <p className="negative">{integration.lastSyncError}</p> : null}
                </div>
                <div className="action-stack">
                  {integration.provider === "CALDAV" || integration.provider === "ICLOUD" ? (
                    <form action={syncCalendarIntegration}>
                      <input type="hidden" name="id" value={integration.id} />
                      <button className="button" type="submit">Sync</button>
                    </form>
                  ) : null}
                  <form action={deleteCalendarIntegration}>
                    <input type="hidden" name="id" value={integration.id} />
                    <button className="button secondary" type="submit">Entfernen</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="grid two spacing-top">
        <section className="panel">
          <h2 className="section-title">Termin erfassen</h2>
          <form action={createCalendarEvent} className="form">
            <label>Titel<input name="title" required /></label>
            <label>Start<input name="startAt" type="datetime-local" required /></label>
            <label>Ende<input name="endAt" type="datetime-local" required /></label>
            <label>Ort<input name="location" /></label>
            <label>Beschreibung<textarea name="description" /></label>
            <label>
              Sichtbarkeit
              <select name="visibility" defaultValue="FAMILY">
                <option value="FAMILY">Familie</option>
                <option value="TITLE_ONLY">Nur Titel</option>
                <option value="BUSY_ONLY">Nur beschäftigt</option>
                <option value="PRIVATE">Privat</option>
              </select>
            </label>
            <button className="button" type="submit">Speichern</button>
          </form>
        </section>

        <section className="panel">
          <h2 className="section-title">Familienüberblick</h2>
          <div className="list">
            {events.length === 0 ? <EmptyState>Noch keine Termine erfasst.</EmptyState> : null}
            {events.map((event) => (
              <article className="card" key={event.id}>
                <div className="row">
                  <div>
                    <strong>{event.visibility === "BUSY_ONLY" ? "Beschäftigt" : event.title}</strong>
                    <span className="muted">{formatDate(event.startAt)} · {event.owner.name} · {event.source}</span>
                    {event.visibility === "FAMILY" && event.description ? <p>{event.description}</p> : null}
                  </div>
                  <span className="badge">{visibilityLabels[event.visibility]}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
