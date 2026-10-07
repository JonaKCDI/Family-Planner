"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireFinanceMember } from "@/lib/family-finance";
import { parseOptionalEuroInputToCents } from "@/lib/validation";
import { normalizeCategoryIcon } from "@/lib/category-icon-options";
import { parseEuroInputToCents, parseRequiredDateInput } from "@/lib/validation";

export async function saveFamilyTerm(form: FormData) {
  const session = await requireFinanceMember();
  const familyId = session.family.id;
  const category = form.get("type") === "category";
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  const color = String(form.get("color") ?? "#16776f");
  if (!name || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Bitte Name und gültige Farbe angeben.");
  if (id && session.role !== "ADMIN") throw new Error("Nur Familienadmins können gemeinsame Begriffe bearbeiten.");
  const admin = session.role === "ADMIN";
  const budget = admin ? parseOptionalEuroInputToCents(form.get("budget")) ?? 0 : 0;
  if (budget < 0) throw new Error("Das Budget darf nicht negativ sein.");
  const cadenceValue = String(form.get("budgetCadence") ?? (category ? "MONTHLY" : "ALL_TIME"));
  const allowedCadences = category ? ["MONTHLY", "YEARLY"] : ["MONTHLY", "YEARLY", "ALL_TIME"];
  if (!allowedCadences.includes(cadenceValue)) throw new Error("Bitte einen gültigen Budgetzeitraum auswählen.");
  const data = { name, color, ...(admin ? { archivedAt: form.get("archived") === "on" ? new Date() : null } : {}) };
  if (category) {
    const values = { ...data, icon: normalizeCategoryIcon(form.get("icon")), monthlyBudgetCents: budget, budgetCadence: cadenceValue as "MONTHLY" | "YEARLY", excludeFromForecast: admin && form.get("excludeFromForecast") === "on" };
    if (id) await db.familyFinanceCategory.updateMany({ where: { id, familyId }, data: values });
    else await db.familyFinanceCategory.create({ data: { ...values, familyId } });
  } else {
    const values = { ...data, budgetCents: budget, budgetCadence: cadenceValue as "MONTHLY" | "YEARLY" | "ALL_TIME" };
    if (id) await db.familyFinanceLabel.updateMany({ where: { id, familyId }, data: values });
    else await db.familyFinanceLabel.create({ data: { ...values, familyId } });
  }
  revalidatePath("/ausgaben", "layout");
}

export async function saveFamilyMapping(form: FormData) {
  const session = await requireFinanceMember();
  const familyId = session.family.id, userId = session.user.id;
  const personalId = String(form.get("personalId") ?? "");
  const targetId = String(form.get("targetId") ?? "");
  const category = form.get("type") === "category";
  const personal = category
    ? await db.category.findFirst({ where: { id: personalId, familyId, ownerUserId: userId, type: "EXPENSE" } })
    : await db.expenseLabel.findFirst({ where: { id: personalId, familyId, ownerUserId: userId } });
  if (!personal) throw new Error("Dieser persönliche Begriff ist nicht verfügbar.");
  await db.$transaction(async tx => {
    let target = targetId;
    if (targetId === "__copy") {
      const where = { familyId_name: { familyId, name: personal.name } };
      const data = { familyId, name: personal.name, color: personal.color };
      const term = category ? await tx.familyFinanceCategory.upsert({ where, create: data, update: {} }) : await tx.familyFinanceLabel.upsert({ where, create: data, update: {} });
      if (term.archivedAt) throw new Error("Der gemeinsame Begriff ist archiviert.");
      target = term.id;
    }
    if (target) {
      const where = { id: target, familyId };
      const term = category ? await tx.familyFinanceCategory.findFirst({ where }) : await tx.familyFinanceLabel.findFirst({ where });
      if (!term) throw new Error("Dieser Familienbegriff ist nicht verfügbar.");
      if (term.archivedAt) {
        const mappingWhere = { familyId, userId, personalId, targetId: target };
        const current = category ? await tx.familyCategoryMapping.findFirst({ where: mappingWhere }) : await tx.familyLabelMapping.findFirst({ where: mappingWhere });
        if (!current) throw new Error("Dieser Familienbegriff ist archiviert.");
      }
    }
    const where = { familyId, userId, personalId };
    if (category) {
      await tx.familyCategoryMapping.deleteMany({ where });
      if (target) await tx.familyCategoryMapping.create({ data: { ...where, targetId: target } });
    } else {
      await tx.familyLabelMapping.deleteMany({ where });
      if (target) await tx.familyLabelMapping.create({ data: { ...where, targetId: target } });
    }
  });
  revalidatePath("/ausgaben", "layout");
}

export async function mergeFamilyTerms(form: FormData) {
  const { family, role } = await requireFinanceMember();
  if (role !== "ADMIN") throw new Error("Nur Familienadmins können Begriffe zusammenführen.");
  const id = String(form.get("id") ?? ""), targetId = String(form.get("targetId") ?? "");
  if (!id || id === targetId) throw new Error("Bitte einen anderen Zielbegriff wählen.");
  await db.$transaction(async tx => {
    const where = { familyId: family.id, id: { in: [id, targetId] } };
    if (form.get("type") === "category") {
      const terms = await tx.familyFinanceCategory.findMany({ where });
      if (terms.length !== 2 || terms.find(t => t.id === targetId)?.archivedAt) throw new Error("Ungültiges Ziel.");
      await tx.familyCategoryMapping.updateMany({ where: { familyId: family.id, targetId: id }, data: { targetId } });
      await tx.familyFinanceCategory.update({ where: { id }, data: { archivedAt: new Date() } });
    } else {
      const terms = await tx.familyFinanceLabel.findMany({ where });
      if (terms.length !== 2 || terms.find(t => t.id === targetId)?.archivedAt) throw new Error("Ungültiges Ziel.");
      await tx.familyLabelMapping.updateMany({ where: { familyId: family.id, targetId: id }, data: { targetId } });
      await tx.familyFinanceLabel.update({ where: { id }, data: { archivedAt: new Date() } });
    }
  });
  revalidatePath("/ausgaben", "layout");
}

export async function createFamilyTransfer(form: FormData) {
  const session = await requireFinanceMember();
  const familyId = session.family.id;
  const recipientUserId = String(form.get("recipientUserId") ?? "");
  const amountCents = parseEuroInputToCents(form.get("amount"));
  const currency = String(form.get("currency") ?? "EUR").trim().toUpperCase();
  const date = parseRequiredDateInput(form.get("date"));
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Bitte eine gültige Währung angeben.");
  if (amountCents <= 0) throw new Error("Der Betrag muss größer als 0 sein.");
  if (!recipientUserId || recipientUserId === session.user.id) throw new Error("Bitte ein anderes Familienmitglied auswählen.");
  const recipient = await db.familyMember.findFirst({ where: { familyId, userId: recipientUserId, status: "ACTIVE" } });
  if (!recipient) throw new Error("Dieses Familienmitglied ist nicht verfügbar.");
  await db.familyTransfer.create({ data: { familyId, senderUserId: session.user.id, recipientUserId, createdByUserId: session.user.id, amountCents, currency, date, note } });
  revalidatePath("/ausgaben", "layout");
}

export async function deleteFamilyTransfer(form: FormData) {
  const session = await requireFinanceMember();
  const id = String(form.get("id") ?? "");
  if (!id) throw new Error("Ausgleich nicht gefunden.");
  const result = await db.familyTransfer.deleteMany({ where: { id, familyId: session.family.id, createdByUserId: session.user.id } });
  if (!result.count) throw new Error("Nur der Ersteller kann diesen Ausgleich entfernen.");
  revalidatePath("/ausgaben", "layout");
}
