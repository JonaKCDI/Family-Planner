"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function setDeveloperFeatures(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "ADMIN") throw new Error("Diese Einstellung ist nur für Admins verfügbar.");
  await db.user.update({
    where: { id: session.user.id },
    data: { developerFeatures: formData.get("developerFeatures") === "on" }
  });
  revalidatePath("/einstellungen", "layout");
  revalidatePath("/ausgaben", "layout");
  redirect("/einstellungen/entwickler?gespeichert=1");
}
