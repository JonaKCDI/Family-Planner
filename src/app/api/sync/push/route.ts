import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth";
import { applySyncPush, pushSchema } from "@/lib/sync-server";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
  const input = pushSchema.parse(await request.json());
  const result = await applySyncPush(session, input);
  revalidatePath("/ausgaben");
  revalidatePath("/aufgaben");
  revalidatePath("/dashboard");
  return NextResponse.json(result);
}
