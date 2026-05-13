import Link from "next/link";
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

type CalendarPageProps = {
  searchParams: Promise<{
    view?: string;
    date?: string;
  }>;
};

type CalendarView = "month" | "week" | "day";
type CalendarEvent = Awaited<ReturnType<typeof getVisibleCalendarEvents>>[number];

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const view = normalizeView(params.view);
  const selectedDate = parseDate(params.date);
  const [events, integrations] = await Promise.all([
    getVisibleCalendarEvents(session.family.id, session.user.id),
    getCalendarIntegrations(session.family.id, session.user.id)
  ]);
  const visibleRange = getVisibleRange(selectedDate, view);
  const visibleEvents = events.filter((event) => event.startAt < visibleRange.end && event.endAt > visibleRange.start);

  return (
    <>
      <PageHeader
        title="Kalender"
        description="Familienkalender mit Monats-, Wochen- und Tagesansicht. iCloud und CalDAV laufen lokal über deine App."
      />

      <section className="calendar-shell">
        <div className="calendar-toolbar">
          <details className="config-menu">
            <summary aria-label="Kalender-Einstellungen">Menü</summary>
            <div className="config-panel">
              <h2 className="section-title">Kalender verbinden</h2>
              <form action={createCalendarIntegration} className="form">
                <label>
                  Anbieter
                  <select name="provider" defaultValue="ICLOUD">
                    <option value="ICLOUD">iCloud</option>
                    <option value="CALDAV">CalDAV</option>
                    <option value="OUTLOOK">Outlook</option>
                    <option value="MANUAL">Manueller Kalender</option>
                  </select>
                </label>
                <label>
                  Anzeigename
                  <input name="displayName" placeholder="Privat, Arbeit, Familie ..." required />
                </label>
                <fieldset className="fieldset">
                  <legend>Sync-Zugang</legend>
                  <label>
                    Kalender-URL
                    <input name="calendarUrl" type="url" placeholder="Bei iCloud leer lassen; bei CalDAV Kalender-URL eintragen" />
                  </label>
                  <label>
                    Benutzername
                    <input name="username" autoComplete="username" placeholder="Apple-ID oder CalDAV-User" />
                  </label>
                  <label>
                    Passwort
                    <input name="password" type="password" autoComplete="current-password" placeholder="iCloud App-Passwort oder CalDAV-Passwort" />
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
                <button className="button" type="submit">Verbinden und syncen</button>
              </form>
              <p className="muted">
                iCloud nutzt ein Apple App-spezifisches Passwort. Outlook braucht wegen Microsoft OAuth noch einen separaten, sicheren Verbindungsweg.
              </p>

              <h2 className="section-title spacing-top">Verbundene Kalender</h2>
              <div className="list">
                {integrations.length === 0 ? <EmptyState>Noch keine Kalender verbunden.</EmptyState> : null}
                {integrations.map((integration) => (
                  <article className="card" key={integration.id}>
                    <div className="row">
                      <div>
                        <strong>{integration.displayName}</strong>
                        <span className="muted">
                          {providerLabels[integration.provider]} · {visibilityLabels[integration.visibilityToFamily]} · Status: {integration.status}
                        </span>
                        <div className="badge-row">
                          <span className="badge">{integration.syncEnabled ? "Sync aktiv" : "Ohne Sync"}</span>
                          {integration.lastSyncAt ? <span className="badge">Zuletzt: {formatDate(integration.lastSyncAt)}</span> : null}
                          <span className="badge">{integration.user.name}</span>
                        </div>
                      </div>
                      <IntegrationActions id={integration.id} provider={integration.provider} />
                    </div>
                    {integration.lastSyncError ? <p className="negative">{integration.lastSyncError}</p> : null}
                  </article>
                ))}
              </div>
            </div>
          </details>

          <div className="calendar-nav">
            <Link className="button secondary" href={calendarHref(view, new Date())}>Heute</Link>
            <Link className="icon-button" href={calendarHref(view, shiftDate(selectedDate, view, -1))} aria-label="Zurück">‹</Link>
            <Link className="icon-button" href={calendarHref(view, shiftDate(selectedDate, view, 1))} aria-label="Weiter">›</Link>
          </div>

          <div className="calendar-title">
            <span>{titleForView(selectedDate, view)}</span>
            <strong>KW {isoWeek(selectedDate)}</strong>
          </div>

          <div className="segmented" aria-label="Kalenderansicht">
            <Link className={view === "month" ? "active" : ""} href={calendarHref("month", selectedDate)}>Monat</Link>
            <Link className={view === "week" ? "active" : ""} href={calendarHref("week", selectedDate)}>Woche</Link>
            <Link className={view === "day" ? "active" : ""} href={calendarHref("day", selectedDate)}>Tag</Link>
          </div>
        </div>

        {view === "month" ? <MonthView date={selectedDate} events={visibleEvents} /> : null}
        {view === "week" ? <WeekView date={selectedDate} events={visibleEvents} /> : null}
        {view === "day" ? <DayView date={selectedDate} events={visibleEvents} /> : null}
      </section>

      <details className="panel spacing-top create-panel" id="termin-erfassen">
        <summary>Termin erstellen</summary>
        <form action={createCalendarEvent} className="form">
          <label>Titel<input name="title" required /></label>
          <div className="form-grid">
            <label>Start<input name="startAt" type="datetime-local" required /></label>
            <label>Ende<input name="endAt" type="datetime-local" required /></label>
          </div>
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
      </details>
    </>
  );
}

function IntegrationActions({ id, provider }: { id: string; provider: keyof typeof providerLabels }) {
  return (
    <div className="action-stack">
      {provider === "CALDAV" || provider === "ICLOUD" ? (
        <form action={syncCalendarIntegration}>
          <input type="hidden" name="id" value={id} />
          <button className="button" type="submit">Sync</button>
        </form>
      ) : null}
      <form action={deleteCalendarIntegration}>
        <input type="hidden" name="id" value={id} />
        <button className="button secondary" type="submit">Entfernen</button>
      </form>
    </div>
  );
}

function MonthView({ date, events }: { date: Date; events: CalendarEvent[] }) {
  const days = monthGridDays(date);
  const rows = chunk(days, 7);
  return (
    <div className="calendar-month" role="grid">
      <div className="calendar-week-head kw-head">KW</div>
      {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
        <div className="calendar-week-head" key={day}>{day}</div>
      ))}
      {rows.flatMap((row) => [
        <div className="kw-cell" key={`kw-${row[0].toISOString()}`}>KW {isoWeek(row[0])}</div>,
        ...row.map((day) => (
          <CalendarCell date={day} events={eventsForDay(events, day)} muted={day.getMonth() !== date.getMonth()} key={day.toISOString()} />
        ))
      ])}
    </div>
  );
}

function WeekView({ date, events }: { date: Date; events: CalendarEvent[] }) {
  const days = weekDays(date);
  return (
    <div className="week-view">
      <div className="week-label">Kalenderwoche {isoWeek(date)}</div>
      <div className="week-grid">
        {days.map((day) => (
          <section className="week-day" key={day.toISOString()}>
            <h2>{weekdayFormatter.format(day)} <span>{dayNumberFormatter.format(day)}</span></h2>
            <EventList events={eventsForDay(events, day)} />
          </section>
        ))}
      </div>
    </div>
  );
}

function DayView({ date, events }: { date: Date; events: CalendarEvent[] }) {
  const dayEvents = eventsForDay(events, date);
  return (
    <div className="day-view">
      <div className="day-head">
        <span>{weekdayFormatter.format(date)}</span>
        <strong>{longDateFormatter.format(date)}</strong>
        <span>KW {isoWeek(date)}</span>
      </div>
      <div className="day-agenda">
        {dayEvents.length === 0 ? <EmptyState>Keine Termine an diesem Tag.</EmptyState> : null}
        {dayEvents.map((event) => <CalendarEventCard event={event} detailed key={event.id} />)}
      </div>
    </div>
  );
}

function CalendarCell({ date, events, muted }: { date: Date; events: CalendarEvent[]; muted: boolean }) {
  return (
    <Link className={`calendar-cell${muted ? " muted-cell" : ""}`} href={calendarHref("day", date)}>
      <span className="calendar-date">{date.getDate()}</span>
      <div className="calendar-events">
        {events.slice(0, 3).map((event) => <CalendarPill event={event} key={event.id} />)}
        {events.length > 3 ? <span className="more-events">+{events.length - 3} weitere</span> : null}
      </div>
    </Link>
  );
}

function CalendarPill({ event }: { event: CalendarEvent }) {
  return (
    <span className={`calendar-pill source-${event.source.toLowerCase()}`}>
      {timeFormatter.format(event.startAt)} {eventTitle(event)}
    </span>
  );
}

function EventList({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return <span className="muted">Keine Termine</span>;
  return (
    <div className="list">
      {events.map((event) => <CalendarEventCard event={event} key={event.id} />)}
    </div>
  );
}

function CalendarEventCard({ event, detailed = false }: { event: CalendarEvent; detailed?: boolean }) {
  return (
    <article className="calendar-event-card">
      <span className="calendar-event-time">{timeFormatter.format(event.startAt)} - {timeFormatter.format(event.endAt)}</span>
      <strong>{eventTitle(event)}</strong>
      <span className="muted">{event.owner.name} · {event.source} · {visibilityLabels[event.visibility]}</span>
      {detailed && event.visibility === "FAMILY" && event.location ? <span>{event.location}</span> : null}
      {detailed && event.visibility === "FAMILY" && event.description ? <p>{event.description}</p> : null}
    </article>
  );
}

function eventTitle(event: CalendarEvent) {
  if (event.visibility === "BUSY_ONLY") return "Beschäftigt";
  return event.title;
}

function normalizeView(value?: string): CalendarView {
  return value === "week" || value === "day" ? value : "month";
}

function parseDate(value?: string) {
  if (!value) return new Date();
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getVisibleRange(date: Date, view: CalendarView) {
  if (view === "day") {
    return { start: startOfDay(date), end: addDays(startOfDay(date), 1) };
  }
  if (view === "week") {
    const start = startOfWeek(date);
    return { start, end: addDays(start, 7) };
  }
  const days = monthGridDays(date);
  return { start: startOfDay(days[0]), end: addDays(startOfDay(days[days.length - 1]), 1) };
}

function monthGridDays(date: Date) {
  const start = startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1));
  const end = startOfWeek(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  return eachDay(start, addDays(end, 6));
}

function weekDays(date: Date) {
  const start = startOfWeek(date);
  return eachDay(start, addDays(start, 6));
}

function startOfWeek(date: Date) {
  const value = startOfDay(date);
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  return value;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function shiftDate(date: Date, view: CalendarView, direction: number) {
  const next = new Date(date);
  if (view === "month") next.setMonth(next.getMonth() + direction);
  if (view === "week") next.setDate(next.getDate() + 7 * direction);
  if (view === "day") next.setDate(next.getDate() + direction);
  return next;
}

function eachDay(start: Date, end: Date) {
  const days: Date[] = [];
  for (let current = startOfDay(start); current <= end; current = addDays(current, 1)) {
    days.push(current);
  }
  return days;
}

function eventsForDay(events: CalendarEvent[], date: Date) {
  const start = startOfDay(date);
  const end = addDays(start, 1);
  return events
    .filter((event) => event.startAt < end && event.endAt > start)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

function isoWeek(date: Date) {
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return Math.ceil((((value.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function calendarHref(view: CalendarView, date: Date) {
  return `/kalender?view=${view}&date=${toLocalDateParam(date)}`;
}

function toLocalDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function titleForView(date: Date, view: CalendarView) {
  if (view === "day") return longDateFormatter.format(date);
  if (view === "week") {
    const days = weekDays(date);
    return `${shortDateFormatter.format(days[0])} - ${shortDateFormatter.format(days[6])}`;
  }
  return monthFormatter.format(date);
}

function chunk<T>(items: T[], size: number) {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

const monthFormatter = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });
const longDateFormatter = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
const shortDateFormatter = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" });
const weekdayFormatter = new Intl.DateTimeFormat("de-DE", { weekday: "short" });
const dayNumberFormatter = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" });
const timeFormatter = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
