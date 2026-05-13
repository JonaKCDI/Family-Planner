import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/secrets";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SCOPES = ["openid", "profile", "offline_access", "User.Read", "Calendars.Read"];

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

type GraphUser = {
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
};

type GraphEvent = {
  id: string;
  subject?: string;
  bodyPreview?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  location?: { displayName?: string };
  isCancelled?: boolean;
};

type GraphEventsResponse = {
  value?: GraphEvent[];
  "@odata.nextLink"?: string;
};

export function outlookConfig() {
  const clientId = process.env.OUTLOOK_CLIENT_ID;
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
  const redirectUri = process.env.OUTLOOK_REDIRECT_URI ?? `${process.env.APP_URL ?? "http://localhost:3000"}/api/outlook/callback`;
  const tenant = process.env.OUTLOOK_TENANT ?? "common";
  if (!clientId || !clientSecret) {
    throw new Error("OUTLOOK_CLIENT_ID und OUTLOOK_CLIENT_SECRET müssen gesetzt sein.");
  }
  return {
    clientId,
    clientSecret,
    redirectUri,
    tenant,
    authorizeUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    scopes: SCOPES.join(" ")
  };
}

export async function exchangeOutlookCode(code: string, codeVerifier: string) {
  const config = outlookConfig();
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
    scope: config.scopes
  });
  return requestToken(config.tokenUrl, body);
}

export async function syncOutlookIntegration(integrationId: string, userId: string) {
  const integration = await db.calendarIntegration.findFirst({
    where: { id: integrationId, userId, provider: "OUTLOOK" }
  });
  if (!integration?.encryptedRefreshToken) throw new Error("Outlook-Verbindung nicht gefunden.");

  try {
    const accessToken = await validOutlookAccessToken(integration.id);
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 60);
    const to = new Date(now);
    to.setDate(to.getDate() + 365);
    const events = await fetchOutlookEvents(accessToken, from, to);

    for (const event of events.filter((item) => !item.isCancelled)) {
      const startAt = parseGraphDate(event.start);
      const endAt = parseGraphDate(event.end) ?? startAt;
      if (!startAt || !endAt) continue;
      await db.calendarEvent.upsert({
        where: {
          integrationId_externalEventId: {
            integrationId: integration.id,
            externalEventId: event.id
          }
        },
        create: {
          familyId: integration.familyId,
          integrationId: integration.id,
          ownerUserId: integration.userId,
          externalEventId: event.id,
          title: event.subject || "Ohne Titel",
          description: event.bodyPreview || null,
          startAt,
          endAt,
          timezone: event.start?.timeZone || "Europe/Berlin",
          location: event.location?.displayName || null,
          visibility: integration.visibilityToFamily,
          source: "OUTLOOK"
        },
        update: {
          title: event.subject || "Ohne Titel",
          description: event.bodyPreview || null,
          startAt,
          endAt,
          timezone: event.start?.timeZone || "Europe/Berlin",
          location: event.location?.displayName || null,
          visibility: integration.visibilityToFamily,
          source: "OUTLOOK"
        }
      });
    }

    await db.calendarIntegration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date(), lastSyncError: null, status: `synced:${events.length}` }
    });
    return events.length;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Outlook-Sync-Fehler";
    await db.calendarIntegration.update({
      where: { id: integration.id },
      data: { lastSyncError: message, status: "error" }
    });
    throw error;
  }
}

export async function createOutlookIntegration(input: {
  userId: string;
  familyId: string;
  visibilityToFamily: "PRIVATE" | "BUSY_ONLY" | "TITLE_ONLY" | "FAMILY";
  token: TokenResponse;
}) {
  const user = await fetchGraphUser(input.token.access_token);
  const email = user.mail || user.userPrincipalName || "Outlook";
  const integration = await db.calendarIntegration.create({
    data: {
      familyId: input.familyId,
      userId: input.userId,
      provider: "OUTLOOK",
      displayName: user.displayName ? `${user.displayName} Outlook` : "Outlook",
      username: email,
      encryptedAccessToken: encryptSecret(input.token.access_token),
      encryptedRefreshToken: input.token.refresh_token ? encryptSecret(input.token.refresh_token) : null,
      tokenExpiresAt: new Date(Date.now() + Math.max(input.token.expires_in - 60, 60) * 1000),
      externalAccountEmail: email,
      syncEnabled: true,
      visibilityToFamily: input.visibilityToFamily,
      status: "verbunden"
    }
  });
  await syncOutlookIntegration(integration.id, input.userId);
  return integration;
}

async function validOutlookAccessToken(integrationId: string) {
  const integration = await db.calendarIntegration.findUniqueOrThrow({ where: { id: integrationId } });
  if (integration.encryptedAccessToken && integration.tokenExpiresAt && integration.tokenExpiresAt > new Date()) {
    return decryptSecret(integration.encryptedAccessToken);
  }
  if (!integration.encryptedRefreshToken) throw new Error("Outlook-Refresh-Token fehlt.");

  const config = outlookConfig();
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
    refresh_token: decryptSecret(integration.encryptedRefreshToken),
    redirect_uri: config.redirectUri,
    scope: config.scopes
  });
  const token = await requestToken(config.tokenUrl, body);
  await db.calendarIntegration.update({
    where: { id: integration.id },
    data: {
      encryptedAccessToken: encryptSecret(token.access_token),
      encryptedRefreshToken: token.refresh_token ? encryptSecret(token.refresh_token) : integration.encryptedRefreshToken,
      tokenExpiresAt: new Date(Date.now() + Math.max(token.expires_in - 60, 60) * 1000)
    }
  });
  return token.access_token;
}

async function requestToken(url: string, body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Outlook-Tokenfehler HTTP ${response.status}: ${text.slice(0, 240)}`);
  }
  return response.json() as Promise<TokenResponse>;
}

async function fetchGraphUser(accessToken: string): Promise<GraphUser> {
  const response = await fetch(`${GRAPH_BASE}/me?$select=displayName,mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(`Outlook-Profil konnte nicht gelesen werden: HTTP ${response.status}.`);
  return response.json() as Promise<GraphUser>;
}

async function fetchOutlookEvents(accessToken: string, from: Date, to: Date) {
  const events: GraphEvent[] = [];
  let url = `${GRAPH_BASE}/me/calendarView?startDateTime=${encodeURIComponent(from.toISOString())}&endDateTime=${encodeURIComponent(to.toISOString())}&$top=100&$select=id,subject,bodyPreview,start,end,location,isCancelled`;
  while (url) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="Europe/Berlin"'
      }
    });
    if (!response.ok) throw new Error(`Outlook-Kalender antwortet mit HTTP ${response.status}.`);
    const data = await response.json() as GraphEventsResponse;
    events.push(...(data.value ?? []));
    url = data["@odata.nextLink"] ?? "";
  }
  return events;
}

function parseGraphDate(value?: { dateTime?: string; timeZone?: string }) {
  if (!value?.dateTime) return null;
  const date = new Date(value.dateTime);
  return Number.isNaN(date.getTime()) ? null : date;
}
