import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const userCount = await db.user.count();
  if (userCount === 0) redirect("/setup");

  const session = await getCurrentSession();
  if (!session) redirect("/login");

  redirect("/ausgaben");
}
