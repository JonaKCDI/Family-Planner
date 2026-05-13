import type { CalendarIntegration } from "@prisma/client";
import { db } from "@/lib/db";

type IcsEvent = {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startAt: Date;
  endAt: Date;
};

export async function syncIcsIntegration(integrationId: string, userId: string) {
  const integration = await db.calendarIntegration.findFirst({
    where: { id: integrationId, userId, provider: "ICS" }
  });
  if (!integration) throw new Error("ICS-Kalender nicht gefunden.");
  if (!integration.calendarUrl) throw new Error("ICS-URL ist erforderlich.");

  try {
    const events = await fetchIcsEvents(integration);
    const sourceVisibility = await db.calendarSourceVisibility.upsert({
      where: {
        integrationId_sourceCalendarId: {
          integrationId: integration.id,
          sourceCalendarId: integration.calendarUrl
        }
      },
      create: {
        integrationId: integration.id,
        sourceCalendarId: integration.calendarUrl,
        sourceCalendarName: integration.displayName,
        visibilityToFamily: integration.visibilityToFamily
      },
      update: {
        sourceCalendarName: integration.displayName
      }
    });

    for (const event of events) {
      await db.calendarEvent.upsert({
        where: {
          integrationId_externalEventId: {
            integrationId: integration.id,
            externalEventId: event.uid
          }
        },
        create: {
          familyId: integration.familyId,
          integrationId: integration.id,
          ownerUserId: integration.userId,
          externalEventId: event.uid,
          sourceCalendarId: integration.calendarUrl,
          sourceCalendarName: integration.displayName,
          title: event.title,
          description: event.description,
          startAt: event.startAt,
          endAt: event.endAt,
          timezone: "Europe/Berlin",
          location: event.location,
          visibility: sourceVisibility.visibilityToFamily,
          source: "ICS"
        },
        update: {
          title: event.title,
          description: event.description,
          startAt: event.startAt,
          endAt: event.endAt,
          location: event.location,
          sourceCalendarId: integration.calendarUrl,
          sourceCalendarName: integration.displayName,
          visibility: sourceVisibility.visibilityToFamily,
          source: "ICS"
        }
      });
    }

    await db.calendarIntegration.update({
      where: { id: integration.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: null,
        status: `synced:${events.length}`
      }
    });
    return events.length;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter ICS-Sync-Fehler";
    await db.calendarIntegration.update({
      where: { id: integration.id },
      data: { lastSyncError: message, status: "error" }
    });
    throw error;
  }
}

async function fetchIcsEvents(integration: CalendarIntegration) {
  const url = normalizeIcsUrl(integration.calendarUrl ?? "");
  const response = await fetch(url, {
    headers: {
      Accept: "text/calendar,text/plain,*/*"
    }
  });
  if (!response.ok) throw new Error(`ICS-Kalender antwortet mit HTTP ${response.status}.`);
  const ics = await response.text();
  if (!looksLikeIcs(ics)) {
    const contentType = response.headers.get("content-type") ?? "unbekannter Inhaltstyp";
    throw new Error(`Der Link liefert keinen ICS-Kalender (${contentType}). Bitte einen echten .ics-, webcal- oder Outlook-Veröffentlichungslink eintragen.`);
  }

  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 60);
  const to = new Date(now);
  to.setDate(to.getDate() + 365);
  return parseIcsEvents(ics, from, to);
}

function looksLikeIcs(value: string) {
  return /BEGIN:VCALENDAR/i.test(value) && /BEGIN:VEVENT/i.test(value);
}

function normalizeIcsUrl(value: string) {
  const normalized = value.startsWith("webcal://") ? `https://${value.slice("webcal://".length)}` : value;
  const url = new URL(normalized);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("ICS-Sync erlaubt nur HTTPS-URLs, außer localhost für Entwicklung.");
  }
  return url.toString();
}

function parseIcsEvents(ics: string, from: Date, to: Date): IcsEvent[] {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const blocks = [...unfolded.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)];
  return blocks.flatMap((block) => expandEvent(block[1] ?? "", from, to));
}

function expandEvent(content: string, from: Date, to: Date): IcsEvent[] {
  const uid = field(content, "UID");
  const start = dateField(content, "DTSTART");
  const end = dateField(content, "DTEND") ?? start;
  if (!uid || !start || !end) return [];

  const base = {
    title: field(content, "SUMMARY") ?? "Ohne Titel",
    description: field(content, "DESCRIPTION") ?? undefined,
    location: field(content, "LOCATION") ?? undefined
  };
  const duration = end.getTime() - start.getTime();
  const rrule = field(content, "RRULE");
  if (!rrule) {
    if (start >= to || end <= from) return [];
    return [{ uid, ...base, startAt: start, endAt: end }];
  }

  return recurrenceStarts(start, rrule, from, to).map((startAt) => ({
    uid: `${uid}:${startAt.toISOString()}`,
    ...base,
    startAt,
    endAt: new Date(startAt.getTime() + duration)
  }));
}

function recurrenceStarts(start: Date, rrule: string, from: Date, to: Date) {
  const parts = Object.fromEntries(rrule.split(";").map((part) => {
    const [key, value] = part.split("=");
    return [key, value];
  }));
  const freq = parts.FREQ;
  const interval = Number(parts.INTERVAL ?? "1");
  const count = parts.COUNT ? Number(parts.COUNT) : 500;
  const until = parts.UNTIL ? dateFromIcs(parts.UNTIL) : to;
  const byDays = parts.BYDAY?.split(",") ?? [];
  const starts: Date[] = [];
  let cursor = new Date(start);
  let generated = 0;

  while (cursor < to && generated < count && cursor <= until) {
    const candidates = freq === "WEEKLY" && byDays.length > 0
      ? byDays.map((day) => dateInWeek(cursor, day, start))
      : [new Date(cursor)];

    for (const candidate of candidates) {
      if (candidate < start) continue;
      const candidateEnd = new Date(candidate.getTime() + 1);
      if (candidate < to && candidateEnd > from && candidate <= until) starts.push(candidate);
      generated += 1;
      if (generated >= count) break;
    }

    cursor = advance(cursor, freq, interval);
    if (!freq) break;
  }
  return starts.sort((a, b) => a.getTime() - b.getTime());
}

function advance(date: Date, freq: string | undefined, interval: number) {
  const next = new Date(date);
  if (freq === "DAILY") next.setDate(next.getDate() + interval);
  else if (freq === "WEEKLY") next.setDate(next.getDate() + 7 * interval);
  else if (freq === "MONTHLY") next.setMonth(next.getMonth() + interval);
  else if (freq === "YEARLY") next.setFullYear(next.getFullYear() + interval);
  else next.setFullYear(next.getFullYear() + 100);
  return next;
}

function dateInWeek(weekCursor: Date, byDay: string, originalStart: Date) {
  const weekdays: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };
  const weekStart = new Date(weekCursor);
  const day = weekStart.getDay() || 7;
  weekStart.setDate(weekStart.getDate() - day + 1);
  const target = new Date(weekStart);
  target.setDate(weekStart.getDate() + ((weekdays[byDay.slice(-2)] ?? originalStart.getDay()) || 7) - 1);
  target.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds(), originalStart.getMilliseconds());
  return target;
}

function field(content: string, name: string) {
  const match = content.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "im"));
  return match ? unescapeIcs(match[1].trim()) : null;
}

function dateField(content: string, name: string) {
  const match = content.match(new RegExp(`^${name}(?:;([^:]*))?:(.*)$`, "im"));
  if (!match) return null;
  return dateFromIcs(match[2].trim());
}

function dateFromIcs(value: string) {
  if (/^\d{8}$/.test(value)) {
    return new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00`);
  }
  const normalized = value.endsWith("Z")
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`
    : `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}`;
  return new Date(normalized);
}

function unescapeIcs(value: string) {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}
