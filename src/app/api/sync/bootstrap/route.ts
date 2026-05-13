import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { buildSyncBootstrap } from "@/lib/sync-server";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  return NextResponse.json(await buildSyncBootstrap(session));
}
