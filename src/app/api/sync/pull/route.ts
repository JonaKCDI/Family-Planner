import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { buildSyncPull } from "@/lib/sync-server";

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  const url = new URL(request.url);
  try {
    return NextResponse.json(await buildSyncPull(session, url.searchParams.get("since")));
  } catch (error) {
    if (!(error instanceof ZodError)) {
      throw error;
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Ungültige Sync-Anfrage." },
      { status: 400 }
    );
  }
}
