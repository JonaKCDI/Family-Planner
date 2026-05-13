import type { CalendarIntegration } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/secrets";

type SyncedEvent = {
  uid: string;
  calendarId: string;
  calendarName: string;
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
      provider: { in: ["CALDAV", "ICLOUD"] }
    }
  });
  if (!integration) throw new Error("iCloud/CalDAV-Quelle nicht gefunden.");
  if (!integration.calendarUrl || !integration.username || !integration.encryptedPassword) {
    throw new Error("Kalender-URL, Benutzername und Passwort sind erforderlich.");
  }

  try {
    const source = integration.provider === "ICLOUD" ? "ICLOUD" : "CALDAV";
    const events = await fetchCalDavEvents(integration);
    for (const event of events) {
      const sourceVisibility = await db.calendarSourceVisibility.upsert({
        where: {
          integrationId_sourceCalendarId: {
            integrationId: integration.id,
            sourceCalendarId: event.calendarId
          }
        },
        create: {
          integrationId: integration.id,
          sourceCalendarId: event.calendarId,
          sourceCalendarName: event.calendarName,
          visibilityToFamily: integration.visibilityToFamily
        },
        update: {
          sourceCalendarName: event.calendarName
        }
      });
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
          sourceCalendarId: event.calendarId,
          sourceCalendarName: event.calendarName,
          title: event.title,
          description: event.description,
          startAt: event.startAt,
          endAt: event.endAt,
          timezone: "Europe/Berlin",
          location: event.location,
          visibility: sourceVisibility.visibilityToFamily,
          source
        },
        update: {
          title: event.title,
          sourceCalendarId: event.calendarId,
          sourceCalendarName: event.calendarName,
          description: event.description,
          startAt: event.startAt,
          endAt: event.endAt,
          location: event.location,
          visibility: sourceVisibility.visibilityToFamily,
          source
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
  const auth = `Basic ${Buffer.from(`${integration.username}:${password}`).toString("base64")}`;
  const calendars = await resolveCalendars(integration, auth);
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 60);
  const to = new Date(now);
  to.setDate(to.getDate() + 365);

  const events = [];
  for (const calendar of calendars) {
    const calendarEvents = await fetchCalDavEventsFromUrl(calendar.url, auth, from, to);
    events.push(...calendarEvents.map((event) => ({
      ...event,
      uid: `${calendar.url}#${event.uid}`,
      calendarId: calendar.url,
      calendarName: calendar.name
    })));
  }

  return events.filter((event) => event.startAt < to && event.endAt > from);
}

async function fetchCalDavEventsFromUrl(url: string, auth: string, from: Date, to: Date) {
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
      Authorization: auth,
      Depth: "1",
      "Content-Type": "application/xml; charset=utf-8"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`CalDAV antwortet mit HTTP ${response.status}.`);
  }

  const xml = await response.text();
  return extractCalendarData(xml).flatMap(parseIcsEvents);
}

async function resolveCalendars(integration: CalendarIntegration, authorization: string) {
  const configuredUrl = normalizeCalendarUrl(integration.calendarUrl ?? "");
  if (integration.provider !== "ICLOUD" || !isICloudRoot(configuredUrl)) {
    return [{ name: integration.displayName, url: configuredUrl }];
  }

  const principalXml = await propfind(configuredUrl, authorization, `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal /></d:prop>
</d:propfind>`);
  const principalHref = tagValue(principalXml, "current-user-principal");
  const principalUrl = resolveHref(configuredUrl, principalHref);

  const homeXml = await propfind(principalUrl, authorization, `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-home-set /></d:prop>
</d:propfind>`);
  const homeHref = tagValue(homeXml, "calendar-home-set");
  const homeUrl = resolveHref(principalUrl, homeHref);

  const calendarsXml = await propfind(homeUrl, authorization, `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname />
    <d:resourcetype />
  </d:prop>
</d:propfind>`, "1");
  const calendars = calendarCollections(calendarsXml, homeUrl);
  if (calendars.length === 0) {
    throw new Error("Keine iCloud-Kalender gefunden.");
  }

  const preferred = calendars.find((calendar) =>
    calendar.name.toLocaleLowerCase("de-DE") === integration.displayName.toLocaleLowerCase("de-DE")
  );
  return preferred ? [preferred] : calendars;
}

async function propfind(url: string, authorization: string, body: string, depth = "0") {
  const response = await fetch(url, {
    method: "PROPFIND",
    headers: {
      Authorization: authorization,
      Depth: depth,
      "Content-Type": "application/xml; charset=utf-8"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`CalDAV-Discovery antwortet mit HTTP ${response.status}.`);
  }

  return response.text();
}

function normalizeCalendarUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("CalDAV-Sync erlaubt nur HTTPS-URLs, außer localhost für Entwicklung.");
  }
  return url.toString();
}

function isICloudRoot(value: string) {
  const url = new URL(value);
  return url.hostname === "caldav.icloud.com" && (url.pathname === "/" || url.pathname === "");
}

function tagValue(xml: string, tagName: string) {
  const tagMatch = xml.match(new RegExp(`<[^>]*${tagName}[^>]*>([\\s\\S]*?)<\\/[^>]*${tagName}>`, "i"));
  if (!tagMatch) throw new Error(`CalDAV-Discovery konnte ${tagName} nicht finden.`);
  const hrefMatch = tagMatch[1].match(/<[^>]*href[^>]*>([\s\S]*?)<\/[^>]*href>/i);
  return decodeXml((hrefMatch?.[1] ?? tagMatch[1]).trim());
}

function resolveHref(base: string, href: string) {
  return new URL(href, base).toString();
}

function calendarCollections(xml: string, baseUrl: string) {
  const responses = [...xml.matchAll(/<[^>]*response[^>]*>([\s\S]*?)<\/[^>]*response>/gi)];
  return responses.flatMap((response) => {
    const content = response[1] ?? "";
    if (!hasXmlElement(content, "calendar")) return [];
    const href = content.match(/<[^>]*href[^>]*>([\s\S]*?)<\/[^>]*href>/i)?.[1];
    if (!href) return [];
    const displayName = content.match(/<[^>]*displayname[^>]*>([\s\S]*?)<\/[^>]*displayname>/i)?.[1];
    return [{
      name: decodeXml(displayName?.trim() || "Kalender"),
      url: resolveHref(baseUrl, decodeXml(href.trim()))
    }];
  });
}

function hasXmlElement(xml: string, localName: string) {
  return new RegExp(`<\\s*(?:[\\w.-]+:)?${localName}(?:\\s|/?>)`, "i").test(xml);
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
      calendarId: "",
      calendarName: "",
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
