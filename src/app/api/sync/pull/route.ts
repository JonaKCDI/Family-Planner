import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { buildSyncPull } from "@/lib/sync-server";

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  const url = new URL(request.url);
  return NextResponse.json(await buildSyncPull(session, url.searchParams.get("since")));
}
