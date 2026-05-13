import type { CalendarIntegration } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/secrets";

type SyncedEvent = {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startAt: Date;
  endAt: Date;
};

export async function syncCalDavIntegration(integrationId: string, userId: string) {
  const integration = await db.calendarIntegration.findFirst({
    where: {
      id: integrationId,
      userId,
      provider: "CALDAV"
    }
  });
  if (!integration) throw new Error("CalDAV-Quelle nicht gefunden.");
  if (!integration.calendarUrl || !integration.username || !integration.encryptedPassword) {
    throw new Error("CalDAV-URL, Benutzername und Passwort sind erforderlich.");
  }

  try {
    const events = await fetchCalDavEvents(integration);
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
          title: event.title,
          description: event.description,
          startAt: event.startAt,
          endAt: event.endAt,
          timezone: "Europe/Berlin",
          location: event.location,
          visibility: integration.visibilityToFamily,
          source: "CALDAV"
        },
        update: {
          title: event.title,
          description: event.description,
          startAt: event.startAt,
          endAt: event.endAt,
          location: event.location,
          visibility: integration.visibilityToFamily,
          source: "CALDAV"
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
    const message = error instanceof Error ? error.message : "Unbekannter Sync-Fehler";
    await db.calendarIntegration.update({
      where: { id: integration.id },
      data: {
        lastSyncError: message,
        status: "error"
      }
    });
    throw error;
  }
}

async function fetchCalDavEvents(integration: CalendarIntegration) {
  const password = decryptSecret(integration.encryptedPassword ?? "");
  const url = normalizeCalendarUrl(integration.calendarUrl ?? "");
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 60);
  const to = new Date(now);
  to.setDate(to.getDate() + 365);

  const body = `<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${formatCalDavDate(from)}" end="${formatCalDavDate(to)}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

  const response = await fetch(url, {
    method: "REPORT",
    headers: {
      Authorization: `Basic ${Buffer.from(`${integration.username}:${password}`).toString("base64")}`,
      Depth: "1",
      "Content-Type": "application/xml; charset=utf-8"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`CalDAV antwortet mit HTTP ${response.status}.`);
  }

  const xml = await response.text();
  return extractCalendarData(xml).flatMap(parseIcsEvents).filter((event) => event.startAt < to && event.endAt > from);
}

function normalizeCalendarUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("CalDAV-Sync erlaubt nur HTTPS-URLs, außer localhost für Entwicklung.");
  }
  return url.toString();
}

function formatCalDavDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function extractCalendarData(xml: string) {
  const matches = [...xml.matchAll(/<[^>]*calendar-data[^>]*>([\s\S]*?)<\/[^>]*calendar-data>/gi)];
  return matches.map((match) => decodeXml(match[1] ?? ""));
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseIcsEvents(ics: string): SyncedEvent[] {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const blocks = [...unfolded.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)];
  return blocks.flatMap((block) => {
    const content = block[1] ?? "";
    const uid = field(content, "UID");
    const start = dateField(content, "DTSTART");
    const end = dateField(content, "DTEND") ?? start;
    if (!uid || !start || !end) return [];
    return [{
      uid,
      title: field(content, "SUMMARY") ?? "Ohne Titel",
      description: field(content, "DESCRIPTION") ?? undefined,
      location: field(content, "LOCATION") ?? undefined,
      startAt: start,
      endAt: end
    }];
  });
}

function field(content: string, name: string) {
  const match = content.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "im"));
  return match ? unescapeIcs(match[1].trim()) : null;
}

function dateField(content: string, name: string) {
  const value = field(content, name);
  if (!value) return null;
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
