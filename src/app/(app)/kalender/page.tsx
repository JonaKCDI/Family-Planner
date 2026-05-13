import { createCalendarEvent } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getVisibleCalendarEvents } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/ui";

export default async function CalendarPage() {
  const session = await requireSession();
  const events = await getVisibleCalendarEvents(session.family.id, session.user.id);

  return (
    <>
      <PageHeader title="Kalender" description="Manuelle Familientermine in V1. Outlook, iCloud und CalDAV sind im Datenmodell vorbereitet." />
      <div className="grid two">
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
                <option value="BUSY_ONLY">Nur beschaeftigt</option>
                <option value="PRIVATE">Privat</option>
              </select>
            </label>
            <button className="button" type="submit">Speichern</button>
          </form>
        </section>
        <section className="panel">
          <h2 className="section-title">Familienueberblick</h2>
          <div className="list">
            {events.length === 0 ? <EmptyState>Noch keine Termine erfasst.</EmptyState> : null}
            {events.map((event) => (
              <article className="card" key={event.id}>
                <div className="row">
                  <div>
                    <strong>{event.visibility === "BUSY_ONLY" ? "Beschaeftigt" : event.title}</strong>
                    <span className="muted">{formatDate(event.startAt)} · {event.owner.name} · {event.source}</span>
                    {event.visibility === "FAMILY" && event.description ? <p>{event.description}</p> : null}
                  </div>
                  <span className="badge">{event.visibility}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
