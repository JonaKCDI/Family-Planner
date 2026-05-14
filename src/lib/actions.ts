"use server";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, hashPassword, requireSession, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseExpenseCsv, parseExpenseWorkbook, stringifyExpenseCsv, type ExpenseFormatRow } from "@/lib/expense-formats";
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
  const labelId = optionalText(formData, "labelId");

  const expense = await db.expense.create({
    data: {
      familyId: session.family.id,
      ownerUserId: session.user.id,
      kind: enumValue(formData, "kind", ["EXPENSE", "INCOME"] as const, "EXPENSE"),
      amountCents: parseEuroToCents(formData.get("amount")),
      currency: "EUR",
      date: new Date(requiredText(formData, "date")),
      paymentMethod: paymentMethodValue(formData),
      categoryId: categoryId || null,
      labelId: labelId || null,
      description: requiredText(formData, "description"),
      scope: "PRIVATE"
    }
  });

  await createLinkedDocumentIfPresent(formData, {
    familyId: session.family.id,
    ownerUserId: session.user.id,
    linkedEntityType: "EXPENSE",
    linkedEntityId: expense.id,
    scope: expense.scope
  });

  revalidatePath("/ausgaben");
}

export async function createExpenseLabel(formData: FormData) {
  const session = await requireSession();
  const name = requiredText(formData, "name");
  const submittedColor = optionalText(formData, "color");
  const existingLabels = await db.expenseLabel.count({
    where: { familyId: session.family.id, ownerUserId: session.user.id }
  });

  await db.expenseLabel.upsert({
    where: {
      ownerUserId_name: {
        ownerUserId: session.user.id,
        name
      }
    },
    create: {
      familyId: session.family.id,
      ownerUserId: session.user.id,
      name,
      color: chooseCategoryColor(name, existingLabels, submittedColor),
      budgetCents: parseOptionalEuroToCents(formData.get("budget"))
    },
    update: {
      color: chooseCategoryColor(name, existingLabels, submittedColor),
      budgetCents: parseOptionalEuroToCents(formData.get("budget"))
    }
  });

  revalidatePath("/ausgaben");
}

export async function importExpensesFromCsv() {
  const session = await requireSession();
  const csvPath = process.env.EXPENSE_CSV_PATH;
  if (!csvPath) throw new Error("EXPENSE_CSV_PATH ist nicht gesetzt.");

  await importExpenseRows(session.family.id, session.user.id, parseExpenseCsv(await readFile(csvPath, "utf8")));
  revalidatePath("/ausgaben");
  revalidatePath("/dashboard");
}

async function importExpenseRows(familyId: string, userId: string, rows: ExpenseFormatRow[]) {
  for (const row of rows) {
    const categoryName = row.categoryName.trim();
    const labelName = row.labelName.trim();
    const categoryId = categoryName ? await findOrCreateExpenseCategory(familyId, userId, categoryName) : null;
    const labelId = labelName ? await findOrCreateExpenseLabel(familyId, userId, labelName) : null;
    const id = row.id?.trim();
    const data = {
      familyId,
      ownerUserId: userId,
      kind: row.kind,
      amountCents: row.amountCents,
      currency: row.currency || "EUR",
      date: row.date,
      paymentMethod: row.paymentMethod || "Nicht angegeben",
      categoryId,
      labelId,
      description: row.description || "Import",
      scope: "PRIVATE" as const
    };

    if (id) {
      const existing = await db.expense.findFirst({
        where: { id, familyId, ownerUserId: userId }
      });
      if (existing) {
        await db.expense.update({ where: { id }, data });
      } else {
        await db.expense.create({ data: { id, ...data } });
      }
    } else {
      await db.expense.create({ data });
    }
  }
}

export async function importExpensesFromUploadedCsv(formData: FormData) {
  const session = await requireSession();
  const file = formData.get("csvFile");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte eine CSV-Datei auswählen.");
  }

  await importExpenseRows(session.family.id, session.user.id, parseExpenseCsv(await file.text()));
  revalidatePath("/ausgaben");
  revalidatePath("/dashboard");
}

export async function importExpensesFromUploadedXlsx(formData: FormData) {
  const session = await requireSession();
  const file = formData.get("xlsxFile");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte eine XLSX-Datei auswählen.");
  }

  await importExpenseRows(session.family.id, session.user.id, await parseExpenseWorkbook(await file.arrayBuffer(), file.name));
  revalidatePath("/ausgaben");
  revalidatePath("/dashboard");
}

export async function updateExpense(formData: FormData) {
  const session = await requireSession();
  const categoryId = optionalText(formData, "categoryId");
  const labelId = optionalText(formData, "labelId");

  const updated = await db.expense.updateMany({
    where: {
      id: requiredText(formData, "id"),
      familyId: session.family.id,
      ownerUserId: session.user.id
    },
    data: {
      kind: enumValue(formData, "kind", ["EXPENSE", "INCOME"] as const, "EXPENSE"),
      amountCents: parseEuroToCents(formData.get("amount")),
      currency: "EUR",
      date: new Date(requiredText(formData, "date")),
      paymentMethod: paymentMethodValue(formData),
      categoryId: categoryId || null,
      labelId: labelId || null,
      description: requiredText(formData, "description"),
      scope: "PRIVATE"
    }
  });

  if (updated.count > 0) {
    await syncLinkedDocumentFromForm(formData, {
      familyId: session.family.id,
      ownerUserId: session.user.id,
      linkedEntityType: "EXPENSE",
      linkedEntityId: requiredText(formData, "id"),
      scope: "PRIVATE"
    });
  }

  revalidatePath("/ausgaben");
  revalidatePath("/dashboard");
}

export async function exportExpensesToCsv() {
  const session = await requireSession();
  const csvPath = process.env.EXPENSE_CSV_PATH;
  if (!csvPath) throw new Error("EXPENSE_CSV_PATH ist nicht gesetzt.");

  const expenses = await db.expense.findMany({
    where: { familyId: session.family.id, ownerUserId: session.user.id },
    include: { category: true, label: true },
    orderBy: { date: "desc" }
  });
  const rows = [
    ...expenses.map((expense) => ({
      id: expense.id,
      kind: expense.kind,
      amountCents: expense.amountCents,
      currency: expense.currency,
      date: expense.date,
      paymentMethod: expense.paymentMethod,
      categoryName: expense.category?.name ?? "",
      labelName: expense.label?.name ?? "",
      description: expense.description
    }))
  ];

  await mkdir(dirname(csvPath), { recursive: true });
  await writeFile(csvPath, stringifyExpenseCsv(rows), "utf8");
  revalidatePath("/ausgaben");
}

export async function createCategory(formData: FormData) {
  const session = await requireSession();
  const name = requiredText(formData, "name");
  const type = enumValue(formData, "type", ["EXPENSE", "TASK", "CONTRACT"] as const, "EXPENSE");
  const existingCategories = await db.category.count({
    where: {
      familyId: session.family.id,
      type,
      ...scopeWhereForCategoryColor(session.user.id)
    }
  });
  const submittedColor = optionalText(formData, "color");
  await db.category.create({
    data: {
      familyId: session.family.id,
      ownerUserId: session.user.id,
      type,
      name,
      color: chooseCategoryColor(name, existingCategories, submittedColor),
      icon: optionalText(formData, "icon") ?? "tag",
      monthlyBudgetCents: parseOptionalEuroToCents(formData.get("monthlyBudget")),
      scope: type === "EXPENSE" ? "PRIVATE" : scopeValue(formData)
    }
  });

  revalidatePath("/ausgaben");
}

export async function updateCategory(formData: FormData) {
  const session = await requireSession();
  const id = requiredText(formData, "id");
  const name = requiredText(formData, "name");
  const color = optionalText(formData, "color") ?? "#16776f";

  await db.category.updateMany({
    where: {
      id,
      familyId: session.family.id,
      ...(session.role === "ADMIN" ? {} : { ownerUserId: session.user.id })
    },
    data: {
      name,
      color,
      monthlyBudgetCents: parseOptionalEuroToCents(formData.get("monthlyBudget")),
      scope: scopeValue(formData)
    }
  });

  revalidatePath("/ausgaben");
  revalidatePath("/dashboard");
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

export async function updateTask(formData: FormData) {
  const session = await requireSession();
  const assignedToUserId = optionalText(formData, "assignedToUserId");
  const dueDate = optionalText(formData, "dueDate");
  const status = formData.has("status")
    ? enumValue(formData, "status", ["OPEN", "IN_PROGRESS", "DONE", "ARCHIVED"] as const, "OPEN")
    : undefined;

  await db.task.updateMany({
    where: {
      id: requiredText(formData, "id"),
      familyId: session.family.id,
      OR: [{ ownerUserId: session.user.id }, { assignedToUserId: session.user.id }]
    },
    data: {
      assignedToUserId: assignedToUserId || null,
      title: requiredText(formData, "title"),
      description: optionalText(formData, "description"),
      ...(status ? { status } : {}),
      priority: enumValue(formData, "priority", ["LOW", "MEDIUM", "HIGH", "URGENT"] as const, "MEDIUM"),
      dueDate: dueDate ? new Date(dueDate) : null,
      scope: scopeValue(formData)
    }
  });

  revalidatePath("/aufgaben");
  revalidatePath("/dashboard");
}

export async function createContract(formData: FormData) {
  const session = await requireSession();
  const endDate = optionalText(formData, "endDate");
  const noticeDays = optionalNumber(formData, "cancellationNoticeDays");
  const nextCancellationDate = calculateCancellationDate(endDate, noticeDays);

  const contract = await db.contract.create({
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

  await createLinkedDocumentIfPresent(formData, {
    familyId: session.family.id,
    ownerUserId: session.user.id,
    linkedEntityType: "CONTRACT",
    linkedEntityId: contract.id,
    scope: contract.scope
  });

  revalidatePath("/vertraege");
}

export async function updateContract(formData: FormData) {
  const session = await requireSession();
  const endDate = optionalText(formData, "endDate");
  const noticeDays = optionalNumber(formData, "cancellationNoticeDays");
  const nextCancellationDate = calculateCancellationDate(endDate, noticeDays);

  const updated = await db.contract.updateMany({
    where: {
      id: requiredText(formData, "id"),
      familyId: session.family.id,
      ...(session.role === "ADMIN" ? {} : { ownerUserId: session.user.id })
    },
    data: {
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

  if (updated.count > 0) {
    await syncLinkedDocumentFromForm(formData, {
      familyId: session.family.id,
      ownerUserId: session.user.id,
      linkedEntityType: "CONTRACT",
      linkedEntityId: requiredText(formData, "id"),
      scope: scopeValue(formData)
    });
  }

  revalidatePath("/vertraege");
  revalidatePath("/dashboard");
}

export async function createDocumentReference(formData: FormData) {
  const session = await requireSession();
  const url = requiredText(formData, "url");
  if (!url.startsWith("https://")) {
    throw new Error("Dokumentverweise müssen als HTTPS-Link gespeichert werden.");
  }

  await db.documentReference.create({
    data: {
      familyId: session.family.id,
      ownerUserId: session.user.id,
      linkedEntityType: enumValue(formData, "linkedEntityType", ["EXPENSE", "TASK", "CONTRACT", "GENERAL"] as const, "GENERAL"),
      linkedEntityId: optionalText(formData, "linkedEntityId") || null,
      title: requiredText(formData, "title"),
      referenceType: enumValue(formData, "referenceType", ["SYNOLOGY_HTTPS", "WEBDAV_HTTPS", "EXTERNAL_URL"] as const, "EXTERNAL_URL"),
      url,
      description: optionalText(formData, "description"),
      scope: scopeValue(formData)
    }
  });

  revalidatePath("/dokumente");
}

export async function updateDocumentReference(formData: FormData) {
  const session = await requireSession();
  const url = requiredText(formData, "url");
  if (!url.startsWith("https://")) {
    throw new Error("Dokumentverweise müssen als HTTPS-Link gespeichert werden.");
  }

  await db.documentReference.updateMany({
    where: {
      id: requiredText(formData, "id"),
      familyId: session.family.id,
      ...(session.role === "ADMIN" ? {} : { ownerUserId: session.user.id })
    },
    data: {
      linkedEntityType: enumValue(formData, "linkedEntityType", ["EXPENSE", "TASK", "CONTRACT", "GENERAL"] as const, "GENERAL"),
      linkedEntityId: optionalText(formData, "linkedEntityId") || null,
      title: requiredText(formData, "title"),
      referenceType: "EXTERNAL_URL",
      url,
      description: optionalText(formData, "description"),
      scope: scopeValue(formData)
    }
  });

  revalidatePath("/dokumente");
  revalidatePath("/dashboard");
}

export async function deleteDocumentReference(formData: FormData) {
  const session = await requireSession();

  await db.documentReference.deleteMany({
    where: {
      id: requiredText(formData, "id"),
      familyId: session.family.id,
      ...(session.role === "ADMIN" ? {} : { ownerUserId: session.user.id })
    }
  });

  revalidatePath("/dokumente");
  revalidatePath("/dashboard");
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
    { familyId, ownerUserId, type: "EXPENSE" as const, name: "Lebensmittel", color: "#1c8c55", icon: "cart", monthlyBudgetCents: 50000, scope: "FAMILY" as const },
    { familyId, ownerUserId, type: "EXPENSE" as const, name: "Wohnen", color: "#2e6fea", icon: "home", monthlyBudgetCents: 120000, scope: "FAMILY" as const },
    { familyId, ownerUserId, type: "EXPENSE" as const, name: "Mobilität", color: "#b7791f", icon: "car", monthlyBudgetCents: 25000, scope: "FAMILY" as const },
    { familyId, ownerUserId, type: "EXPENSE" as const, name: "Freizeit", color: "#7c5cc4", icon: "sparkles", monthlyBudgetCents: 20000, scope: "FAMILY" as const },
    { familyId, ownerUserId, type: "EXPENSE" as const, name: "Gehalt", color: "#16776f", icon: "wallet", monthlyBudgetCents: 0, scope: "FAMILY" as const },
    { familyId, ownerUserId, type: "EXPENSE" as const, name: "Rückerstattung", color: "#66736f", icon: "return", monthlyBudgetCents: 0, scope: "FAMILY" as const }
  ];
}

async function createLinkedDocumentIfPresent(
  formData: FormData,
  data: {
    familyId: string;
    ownerUserId: string;
    linkedEntityType: "EXPENSE" | "CONTRACT";
    linkedEntityId: string;
    scope: "PRIVATE" | "FAMILY";
  }
) {
  const title = optionalText(formData, "documentTitle");
  const url = optionalText(formData, "documentUrl");
  if (!title && !url) return;
  if (!title || !url) throw new Error("Dokumenttitel und HTTPS-Link müssen gemeinsam angegeben werden.");
  if (!url.startsWith("https://")) throw new Error("Dokumentverweise müssen als HTTPS-Link gespeichert werden.");

  await db.documentReference.create({
    data: {
      ...data,
      title,
      url,
      referenceType: enumValue(formData, "documentReferenceType", ["SYNOLOGY_HTTPS", "WEBDAV_HTTPS", "EXTERNAL_URL"] as const, "EXTERNAL_URL"),
      description: optionalText(formData, "documentDescription")
    }
  });
}

async function syncLinkedDocumentFromForm(
  formData: FormData,
  data: {
    familyId: string;
    ownerUserId: string;
    linkedEntityType: "EXPENSE" | "CONTRACT";
    linkedEntityId: string;
    scope: "PRIVATE" | "FAMILY";
  }
) {
  const documentId = optionalText(formData, "documentId");
  const title = optionalText(formData, "documentTitle");
  const url = optionalText(formData, "documentUrl");

  if (!title && !url) {
    if (documentId) {
      await db.documentReference.deleteMany({
        where: {
          id: documentId,
          familyId: data.familyId,
          linkedEntityType: data.linkedEntityType,
          linkedEntityId: data.linkedEntityId
        }
      });
    }
    return;
  }

  if (!title || !url) throw new Error("Dokumenttitel und HTTPS-Link müssen gemeinsam angegeben werden.");
  if (!url.startsWith("https://")) throw new Error("Dokumentverweise müssen als HTTPS-Link gespeichert werden.");

  if (documentId) {
    await db.documentReference.updateMany({
      where: {
        id: documentId,
        familyId: data.familyId,
        linkedEntityType: data.linkedEntityType,
        linkedEntityId: data.linkedEntityId
      },
      data: {
        title,
        url,
        referenceType: "EXTERNAL_URL",
        scope: data.scope
      }
    });
    return;
  }

  await db.documentReference.create({
    data: {
      ...data,
      title,
      url,
      referenceType: "EXTERNAL_URL"
    }
  });
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

function parseOptionalEuroToCents(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? parseEuroToCents(text) : 0;
}

function paymentMethodValue(formData: FormData) {
  return optionalText(formData, "paymentMethod") ?? "Nicht angegeben";
}

function chooseCategoryColor(name: string, existingCount: number, submittedColor: string | null) {
  if (submittedColor && submittedColor.toLowerCase() !== "#2f6fed") return submittedColor;
  const palette = [
    "#16776f",
    "#2e6fea",
    "#1c8c55",
    "#b7791f",
    "#7c5cc4",
    "#b94242",
    "#0f8b8d",
    "#d45d2f",
    "#536dfe",
    "#5c7c2f"
  ];
  const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), existingCount);
  return palette[Math.abs(hash) % palette.length];
}

function scopeWhereForCategoryColor(userId: string) {
  return {
    OR: [
      { scope: "FAMILY" as const },
      { ownerUserId: userId }
    ]
  };
}

async function findOrCreateExpenseCategory(familyId: string, ownerUserId: string, name: string) {
  const existing = await db.category.findFirst({
    where: {
      familyId,
      ownerUserId,
      type: "EXPENSE",
      name
    }
  });
  if (existing) return existing.id;

  const count = await db.category.count({ where: { familyId, ownerUserId, type: "EXPENSE" } });
  const category = await db.category.create({
    data: {
      familyId,
      ownerUserId,
      type: "EXPENSE",
      name,
      color: chooseCategoryColor(name, count, null),
      icon: "tag",
      scope: "PRIVATE"
    }
  });
  return category.id;
}

async function findOrCreateExpenseLabel(familyId: string, ownerUserId: string, name: string) {
  const existing = await db.expenseLabel.findUnique({
    where: {
      ownerUserId_name: {
        ownerUserId,
        name
      }
    }
  });
  if (existing) return existing.id;

  const count = await db.expenseLabel.count({ where: { familyId, ownerUserId } });
  const label = await db.expenseLabel.create({
    data: {
      familyId,
      ownerUserId,
      name,
      color: chooseCategoryColor(name, count, null)
    }
  });
  return label.id;
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
