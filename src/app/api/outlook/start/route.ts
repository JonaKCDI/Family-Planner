import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { outlookConfig } from "@/lib/outlook";

export async function GET(request: Request) {
  await requireSession();
  const config = outlookConfig();
  const url = new URL(request.url);
  const visibility = visibilityValue(url.searchParams.get("visibilityToFamily"));
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60
  };
  cookieStore.set("outlook_oauth_state", state, cookieOptions);
  cookieStore.set("outlook_pkce_verifier", verifier, cookieOptions);
  cookieStore.set("outlook_visibility", visibility, cookieOptions);

  const authorize = new URL(config.authorizeUrl);
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", config.redirectUri);
  authorize.searchParams.set("response_mode", "query");
  authorize.searchParams.set("scope", config.scopes);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(authorize);
}

function visibilityValue(value: string | null) {
  return value === "PRIVATE" || value === "TITLE_ONLY" || value === "FAMILY" ? value : "BUSY_ONLY";
}
