"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, hashPassword, requireSession, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseEuroToCents } from "@/lib/format";

const passwordSchema = z.string().min(6, "Das Passwort braucht mindestens 6 Zeichen.");

export async function setupFirstFamily(formData: FormData) {
  const existingUsers = await db.user.count();
  if (existingUsers > 0) redirect("/login");

  const name = requiredText(formData, "name");
  const familyName = requiredText(formData, "familyName");
  const password = passwordSchema.parse(String(formData.get("password") ?? ""));

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: {
      name,
      passwordHash,
      memberships: {
        create: {
          role: "ADMIN",
          family: {
            create: { name: familyName }
          }
        }
      }
    }
  });

  await createDefaultCategories(user.id);
  await createSession(user.id);
  redirect("/ausgaben");
}

export async function login(formData: FormData) {
  const name = requiredText(formData, "name");
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { name } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect("/login?error=1");
  }

  await createSession(user.id);
  redirect("/ausgaben");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function createExpense(formData: FormData) {
  const session = await requireSession();
  const categoryId = optionalText(formData, "categoryId");

  await db.expense.create({
    data: {
      familyId: session.family.id,
      ownerUserId: session.user.id,
      amountCents: parseEuroToCents(formData.get("amount")),
      currency: "EUR",
      date: new Date(requiredText(formData, "date")),
      categoryId: categoryId || null,
      description: requiredText(formData, "description"),
      scope: scopeValue(formData)
    }
  });

  revalidatePath("/ausgaben");
}

export async function deleteExpense(formData: FormData) {
  const session = await requireSession();
  const id = requiredText(formData, "id");
  await db.expense.deleteMany({
    where: {
      id,
      familyId: session.family.id,
      ...(session.role === "ADMIN" ? {} : { ownerUserId: session.user.id })
    }
  });
  revalidatePath("/ausgaben");
}

export async function createTask(formData: FormData) {
  const session = await requireSession();
  const assignedToUserId = optionalText(formData, "assignedToUserId");
  const dueDate = optionalText(formData, "dueDate");

  await db.task.create({
    data: {
      familyId: session.family.id,
      ownerUserId: session.user.id,
      assignedToUserId: assignedToUserId || null,
      title: requiredText(formData, "title"),
      description: optionalText(formData, "description"),
      status: "OPEN",
      priority: enumValue(formData, "priority", ["LOW", "MEDIUM", "HIGH", "URGENT"] as const, "MEDIUM"),
      dueDate: dueDate ? new Date(dueDate) : null,
      scope: scopeValue(formData)
    }
  });

  revalidatePath("/aufgaben");
}

export async function updateTaskStatus(formData: FormData) {
  const session = await requireSession();
  await db.task.updateMany({
    where: {
      id: requiredText(formData, "id"),
      familyId: session.family.id,
      OR: [{ ownerUserId: session.user.id }, { assignedToUserId: session.user.id }]
    },
    data: {
      status: enumValue(formData, "status", ["OPEN", "IN_PROGRESS", "DONE", "ARCHIVED"] as const, "OPEN")
    }
  });
  revalidatePath("/aufgaben");
}

export async function createContract(formData: FormData) {
  const session = await requireSession();
  const endDate = optionalText(formData, "endDate");
  const noticeDays = optionalNumber(formData, "cancellationNoticeDays");
  const nextCancellationDate = calculateCancellationDate(endDate, noticeDays);

  await db.contract.create({
    data: {
      familyId: session.family.id,
      ownerUserId: session.user.id,
      provider: requiredText(formData, "provider"),
      contractType: requiredText(formData, "contractType"),
      description: optionalText(formData, "description"),
      costCents: parseEuroToCents(formData.get("cost")),
      currency: "EUR",
      billingInterval: enumValue(formData, "billingInterval", ["MONTHLY", "YEARLY", "QUARTERLY", "ONCE", "OTHER"] as const, "MONTHLY"),
      startDate: new Date(requiredText(formData, "startDate")),
      endDate: endDate ? new Date(endDate) : null,
      cancellationNoticeDays: noticeDays,
      nextCancellationDate,
      status: enumValue(formData, "status", ["ACTIVE", "CANCELLED", "EXPIRED", "DRAFT"] as const, "ACTIVE"),
      scope: scopeValue(formData)
    }
  });

  revalidatePath("/vertraege");
}

export async function createDocumentReference(formData: FormData) {
  const session = await requireSession();
  const url = requiredText(formData, "url");
  if (!url.startsWith("https://")) {
    throw new Error("Dokumentverweise muessen als HTTPS-Link gespeichert werden.");
  }

  await db.documentReference.create({
    data: {
      familyId: session.family.id,
      ownerUserId: session.user.id,
      linkedEntityType: enumValue(formData, "linkedEntityType", ["EXPENSE", "TASK", "CONTRACT", "CALENDAR_EVENT", "GENERAL"] as const, "GENERAL"),
      linkedEntityId: optionalText(formData, "linkedEntityId") || null,
      title: requiredText(formData, "title"),
      referenceType: enumValue(formData, "referenceType", ["SYNOLOGY_HTTPS", "WEBDAV_HTTPS", "EXTERNAL_URL"] as const, "SYNOLOGY_HTTPS"),
      url,
      description: optionalText(formData, "description"),
      scope: scopeValue(formData)
    }
  });

  revalidatePath("/dokumente");
}

export async function createCalendarEvent(formData: FormData) {
  const session = await requireSession();
  await db.calendarEvent.create({
    data: {
      familyId: session.family.id,
      ownerUserId: session.user.id,
      title: requiredText(formData, "title"),
      description: optionalText(formData, "description"),
      startAt: new Date(requiredText(formData, "startAt")),
      endAt: new Date(requiredText(formData, "endAt")),
      timezone: "Europe/Berlin",
      location: optionalText(formData, "location"),
      visibility: enumValue(formData, "visibility", ["PRIVATE", "BUSY_ONLY", "TITLE_ONLY", "FAMILY"] as const, "FAMILY"),
      source: "MANUAL"
    }
  });

  revalidatePath("/kalender");
}

export async function createUser(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "ADMIN") return;

  const name = requiredText(formData, "name");
  const password = passwordSchema.parse(String(formData.get("password") ?? ""));
  const user = await db.user.create({
    data: {
      name,
      passwordHash: await hashPassword(password),
      memberships: {
        create: {
          familyId: session.family.id,
          role: enumValue(formData, "role", ["ADMIN", "MEMBER"] as const, "MEMBER")
        }
      }
    }
  });

  await db.category.createMany({
    data: defaultCategorySeed(session.family.id, user.id)
  });

  revalidatePath("/einstellungen");
}

async function createDefaultCategories(userId: string) {
  const membership = await db.familyMember.findFirstOrThrow({ where: { userId } });
  await db.category.createMany({
    data: defaultCategorySeed(membership.familyId, userId)
  });
}

function defaultCategorySeed(familyId: string, ownerUserId: string) {
  return [
    { familyId, ownerUserId, type: "EXPENSE" as const, name: "Lebensmittel", color: "#2f855a", icon: "cart", scope: "FAMILY" as const },
    { familyId, ownerUserId, type: "EXPENSE" as const, name: "Wohnen", color: "#2b6cb0", icon: "home", scope: "FAMILY" as const },
    { familyId, ownerUserId, type: "EXPENSE" as const, name: "Mobilitaet", color: "#b7791f", icon: "car", scope: "FAMILY" as const },
    { familyId, ownerUserId, type: "EXPENSE" as const, name: "Freizeit", color: "#805ad5", icon: "sparkles", scope: "FAMILY" as const }
  ];
}

function requiredText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} ist erforderlich.`);
  return value;
}

function optionalText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function optionalNumber(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value ? Number(value) : null;
}

function scopeValue(formData: FormData) {
  return formData.get("scope") === "PRIVATE" ? "PRIVATE" : "FAMILY";
}

function enumValue<T extends string>(formData: FormData, key: string, allowed: readonly T[], fallback: T) {
  const value = String(formData.get(key) ?? fallback) as T;
  return allowed.includes(value) ? value : fallback;
}

function calculateCancellationDate(endDate: string | null, noticeDays: number | null) {
  if (!endDate || !noticeDays) return null;
  const date = new Date(endDate);
  date.setDate(date.getDate() - noticeDays);
  return date;
}
