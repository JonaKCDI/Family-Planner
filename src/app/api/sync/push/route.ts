import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth";
import { applySyncPush, pushSchema } from "@/lib/sync-server";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = pushSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Die Sync-Daten sind ungültig.",
        issues: parsed.error.issues.map((issue) => issue.message)
      },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const result = await applySyncPush(session, input);
  revalidatePath("/ausgaben");
  revalidatePath("/aufgaben");
  revalidatePath("/dashboard");
  return NextResponse.json(result);
}
