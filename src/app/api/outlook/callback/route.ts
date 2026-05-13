import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { createOutlookIntegration, exchangeOutlookCode } from "@/lib/outlook";

export async function GET(request: Request) {
  const session = await requireSession();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("outlook_oauth_state")?.value;
  const verifier = cookieStore.get("outlook_pkce_verifier")?.value;
  const visibility = visibilityValue(cookieStore.get("outlook_visibility")?.value);

  cookieStore.delete("outlook_oauth_state");
  cookieStore.delete("outlook_pkce_verifier");
  cookieStore.delete("outlook_visibility");

  if (!code || !state || state !== expectedState || !verifier) {
    return NextResponse.redirect(new URL("/kalender?outlook=error", request.url));
  }

  try {
    const token = await exchangeOutlookCode(code, verifier);
    await createOutlookIntegration({
      userId: session.user.id,
      familyId: session.family.id,
      visibilityToFamily: visibility,
      token
    });
    return NextResponse.redirect(new URL("/kalender?outlook=connected", request.url));
  } catch {
    return NextResponse.redirect(new URL("/kalender?outlook=error", request.url));
  }
}

function visibilityValue(value: string | undefined) {
  return value === "PRIVATE" || value === "TITLE_ONLY" || value === "FAMILY" ? value : "BUSY_ONLY";
}
