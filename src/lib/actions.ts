"use server";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cleanupExpiredSessions, createSession, destroySession, hashPassword, requireSession, verifyPassword } from "@/lib/auth";
import { resolveContractCancellationSchedule } from "@/lib/contracts";
import { db } from "@/lib/db";
import { ensureDueContractExpenses } from "@/lib/contract-auto-expenses";
import { buildExpenseWorkbook, parseExpenseWorkbook, type ExpenseFormatRow } from "@/lib/expense-formats";
import { buildFuelWorkbook, inferCarNameFromFuelFileName, parseFuelWorkbook, type FuelFormatRow } from "@/lib/mileage-formats";
import { safeFilePart } from "@/lib/file-names";
import { isFamilyAdmin, ownedExpenseWhere } from "@/lib/permissions";
import { resolveDocumentLinkedEntityId, resolveExpenseCategoryId, resolveExpenseLabelId, resolveTaskAssigneeId, resolveVisibleContractId } from "@/lib/relations";
import { parseDecimalInputToMilli, parseEuroInputToCents, parseOptionalDateInput, parseOptionalEuroInputToCents, parseOptionalIntegerInput, parseRequiredDateInput, parseRequiredIntegerInput } from "@/lib/validation";

const passwordSchema = z.string().min(8, "Das Passwort braucht mindestens 8 Zeichen.");
const recoveryKeySchema = z.string().min(20, "Der Notfallschlüssel braucht mindestens 20 Zeichen.");
const MAX_LOGIN_FAILURES = 5;
const LOGIN_LOCK_MINUTES = 15;

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
  await cleanupExpiredSessions();
  const name = requiredText(formData, "name");
  const password = String(formData.get("password") ?? "");
  const normalizedName = normalizeLoginName(name);
  const attempt = await db.loginAttempt.findUnique({ where: { normalizedName } });
  const now = new Date();
  if (attempt?.lockedUntil && attempt.lockedUntil > now) {
    redirect("/login?error=locked");
  }
  if (attempt?.lockedUntil && attempt.lockedUntil <= now) {
    await db.loginAttempt.deleteMany({ where: { normalizedName } });
  }
  const user = await db.user.findUnique({ where: { name } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await recordLoginFailure(normalizedName);
    redirect("/login?error=1");
  }

  await db.loginAttempt.deleteMany({ where: { normalizedName } });
  await createSession(user.id);
  redirect("/ausgaben");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function createExpense(formData: FormData) {
  const session = await requireSession();
  const categoryId = await resolveExpenseCategoryId(session.family.id, session.user.id, optionalText(formData, "categoryId"));
  const labelId = await resolveExpenseLabelId(session.family.id, session.user.id, optionalText(formData, "labelId"));
  const contractId = await resolveVisibleContractId(session.family.id, session.user.id, optionalText(formData, "contractId"));

  const expense = await db.expense.create({
    data: {
      familyId: session.family.id,
      ownerUserId: session.user.id,
      kind: enumValue(formData, "kind", ["EXPENSE", "INCOME"] as const, "EXPENSE"),
      amountCents: parseEuroInputToCents(formData.get("amount")),
      currency: "EUR",
      date: parseRequiredDateInput(formData.get("date")),
      paymentMethod: paymentMethodValue(formData),
      store: optionalText(formData, "store") ?? "",
      categoryId: categoryId || null,
      labelId: labelId || null,
      contractId,
      description: optionalText(formData, "description") ?? "",
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
  revalidatePath("/dashboard");
  redirect(actionReturnTo(formData, "/ausgaben"));
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
      budgetCents: parseOptionalEuroInputToCents(formData.get("budget"))
    },
    update: {
      color: chooseCategoryColor(name, existingLabels, submittedColor),
      budgetCents: parseOptionalEuroInputToCents(formData.get("budget")),
      archivedAt: null
    }
  });

  revalidatePath("/ausgaben");
}

export async function updateExpenseLabel(formData: FormData) {
  const session = await requireSession();
  const id = requiredText(formData, "id");
  const name = requiredText(formData, "name");
  const submittedColor = optionalText(formData, "color");

  const [label, duplicate] = await Promise.all([
    db.expenseLabel.findFirst({
      where: {
        id,
        familyId: session.family.id,
        ownerUserId: session.user.id
      },
      select: { id: true, name: true, color: true }
    }),
    db.expenseLabel.findFirst({
      where: {
        familyId: session.family.id,
        ownerUserId: session.user.id,
        name,
        NOT: { id }
      },
      select: { id: true }
    })
  ]);
  if (!label) throw new Error("Das ausgewählte Label ist nicht verfügbar.");
  if (duplicate) throw new Error("Ein Label mit diesem Namen gibt es bereits. Bitte nutze Zusammenführen.");

  await db.expenseLabel.update({
    where: { id: label.id },
    data: {
      name,
      color: submittedColor ?? label.color,
      budgetCents: parseOptionalEuroInputToCents(formData.get("budget"))
    }
  });

  revalidatePath("/ausgaben");
  revalidatePath("/dashboard");
}

export async function deleteExpenseLabel(formData: FormData) {
  const session = await requireSession();
  const id = requiredText(formData, "id");
  const [label, expenseCount, settingsCount] = await Promise.all([
    db.expenseLabel.findFirst({
      where: {
        id,
        familyId: session.family.id,
        ownerUserId: session.user.id
      },
      select: { id: true }
    }),
    db.expense.count({
      where: {
        familyId: session.family.id,
        ownerUserId: session.user.id,
        labelId: id
      }
    }),
    db.fuelExpenseSettings.count({
      where: {
        familyId: session.family.id,
        userId: session.user.id,
        defaultLabelId: id
      }
    })
  ]);
  if (!label) throw new Error("Das ausgewählte Label ist nicht verfügbar.");
  if (expenseCount > 0) throw new Error("Dieses Label wird noch von Ausgaben genutzt. Bitte zuerst zusammenführen oder Zuordnungen entfernen.");
  if (settingsCount > 0) throw new Error("Dieses Label ist noch im Auto-Setup hinterlegt. Bitte dort zuerst entfernen.");

  await db.expenseLabel.delete({ where: { id: label.id } });
  revalidatePath("/ausgaben");
  revalidatePath("/dashboard");
}

export async function archiveExpenseLabel(formData: FormData) {
  const session = await requireSession();
  await db.expenseLabel.updateMany({
    where: {
      id: requiredText(formData, "id"),
      familyId: session.family.id,
      ownerUserId: session.user.id
    },
    data: { archivedAt: new Date() }
  });

  revalidatePath("/ausgaben");
}

export async function unarchiveExpenseLabel(formData: FormData) {
  const session = await requireSession();
  await db.expenseLabel.updateMany({
    where: {
      id: requiredText(formData, "id"),
      familyId: session.family.id,
      ownerUserId: session.user.id
    },
    data: { archivedAt: null }
  });

  revalidatePath("/ausgaben");
}

export async function mergeExpenseLabels(formData: FormData) {
  const session = await requireSession();
  const sourceLabelId = requiredText(formData, "sourceLabelId");
  const targetLabelId = requiredText(formData, "targetLabelId");
  if (sourceLabelId === targetLabelId) throw new Error("Bitte zwei unterschiedliche Labels auswählen.");

  const [sourceLabel, targetLabel] = await Promise.all([
    db.expenseLabel.findFirst({
      where: { id: sourceLabelId, familyId: session.family.id, ownerUserId: session.user.id },
      select: { id: true }
    }),
    db.expenseLabel.findFirst({
      where: { id: targetLabelId, familyId: session.family.id, ownerUserId: session.user.id },
      select: { id: true }
    })
  ]);
  if (!sourceLabel || !targetLabel) throw new Error("Die ausgewählten Labels sind nicht verfügbar.");

  await db.$transaction([
    db.expense.updateMany({
      where: {
        familyId: session.family.id,
        ownerUserId: session.user.id,
        labelId: sourceLabel.id
      },
      data: { labelId: targetLabel.id }
    }),
    db.expenseLabel.delete({ where: { id: sourceLabel.id } })
  ]);

  revalidatePath("/ausgaben");
  revalidatePath("/dashboard");
}

async function importExpenseRows(familyId: string, userId: string, rows: ExpenseFormatRow[]) {
  for (const row of rows) {
    const categoryName = row.categoryName.trim();
    const labelName = row.labelName.trim();
    const categoryId = categoryName ? await findOrCreateExpenseCategory(familyId, userId, categoryName) : null;
    const labelId = labelName ? await findOrCreateExpenseLabel(familyId, userId, labelName) : null;
    const contractId = await resolveVisibleContractId(familyId, userId, row.contractId?.trim() || null);
    const id = row.id?.trim();
    const data = {
      familyId,
      ownerUserId: userId,
      kind: row.kind,
      amountCents: row.amountCents,
      currency: row.currency || "EUR",
      date: row.date,
      paymentMethod: row.paymentMethod || "Nicht angegeben",
      store: row.store || "",
      categoryId,
      labelId,
      contractId,
      description: row.description || "Import",
      scope: "PRIVATE" as const
    };

    if (id) {
      const existing = await db.expense.findUnique({
        where: { id },
        select: { familyId: true, ownerUserId: true }
      });
      if (existing) {
        if (existing.familyId !== familyId || existing.ownerUserId !== userId) {
          throw new Error(`Die importierte Ausgabe mit der ID ${id} gehört nicht zu deinem Konto und kann nicht importiert werden.`);
        }
        await db.expense.update({ where: { id }, data });
      } else {
        await db.expense.create({ data: { id, ...data } });
      }
    } else {
      await db.expense.create({ data });
    }
  }
}

export async function importExpensesFromUploadedXlsx(formData: FormData) {
  const session = await requireSession();
  const file = formData.get("xlsxFile");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte eine XLSX-Datei auswählen.");
  }

  const rows = await parseExpenseWorkbook(await file.arrayBuffer(), file.name);
  await importExpenseRows(session.family.id, session.user.id, rows);
  revalidatePath("/ausgaben");
  revalidatePath("/dashboard");
  redirect(`/ausgaben?year=${primaryImportedYear(rows)}`);
}

export async function importExpensesFromSynologyExcel(formData: FormData) {
  const session = await requireSession();
  const year = exportYearFromFormData(formData);
  const excelPath = expenseExcelPathForUser(session.user.name, year);
  const fileBuffer = await readFile(excelPath);
  const rows = await parseExpenseWorkbook(toArrayBuffer(fileBuffer), excelPath);
  await importExpenseRows(session.family.id, session.user.id, rows);
  revalidatePath("/ausgaben");
  revalidatePath("/dashboard");
  redirect(`/ausgaben?year=${primaryImportedYear(rows)}`);
}

export async function updateExpense(formData: FormData) {
  const session = await requireSession();
  const categoryId = await resolveExpenseCategoryId(session.family.id, session.user.id, optionalText(formData, "categoryId"));
  const labelId = await resolveExpenseLabelId(session.family.id, session.user.id, optionalText(formData, "labelId"));
  const contractId = await resolveVisibleContractId(session.family.id, session.user.id, optionalText(formData, "contractId"));

  const updated = await db.expense.updateMany({
    where: {
      id: requiredText(formData, "id"),
      familyId: session.family.id,
      ownerUserId: session.user.id
    },
    data: {
      kind: enumValue(formData, "kind", ["EXPENSE", "INCOME"] as const, "EXPENSE"),
      amountCents: parseEuroInputToCents(formData.get("amount")),
      currency: "EUR",
      date: parseRequiredDateInput(formData.get("date")),
      paymentMethod: paymentMethodValue(formData),
      store: optionalText(formData, "store") ?? "",
      categoryId: categoryId || null,
      labelId: labelId || null,
      contractId,
      description: optionalText(formData, "description") ?? "",
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
  redirect(actionReturnTo(formData, "/ausgaben"));
}

export async function exportExpensesToSynologyExcel(formData: FormData) {
  const session = await requireSession();
  const year = exportYearFromFormData(formData);
  const excelPath = expenseExcelPathForUser(session.user.name, year);
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));

  const expenses = await db.expense.findMany({
    where: {
      familyId: session.family.id,
      ownerUserId: session.user.id,
      date: { gte: from, lt: to }
    },
    include: { category: true, label: true, contract: true },
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
      store: expense.store,
      categoryName: expense.category?.name ?? "",
      labelName: expense.label?.name ?? "",
      contractId: expense.contractId ?? "",
      contractProvider: expense.contract?.provider ?? "",
      contractType: expense.contract?.contractType ?? "",
      fuelEntryId: expense.fuelEntryId ?? "",
      description: expense.description
    }))
  ];

  await mkdir(dirname(excelPath), { recursive: true });
  await writeFile(excelPath, Buffer.from(await buildExpenseWorkbook(rows, year)));
  revalidatePath("/ausgaben");
}

export async function createCar(formData: FormData) {
  const session = await requireSession();
  requireFamilyAdmin(session.role);
  await db.car.create({
    data: {
      familyId: session.family.id,
      createdByUserId: session.user.id,
      name: requiredText(formData, "name"),
      licensePlate: optionalText(formData, "licensePlate") ?? "",
      color: optionalText(formData, "color") ?? "#16776f",
      notes: optionalText(formData, "notes") ?? ""
    }
  });

  revalidatePath("/kilometer");
}

export async function updateCar(formData: FormData) {
  const session = await requireSession();
  requireFamilyAdmin(session.role);
  await db.car.updateMany({
    where: { id: requiredText(formData, "id"), familyId: session.family.id },
    data: {
      name: requiredText(formData, "name"),
      licensePlate: optionalText(formData, "licensePlate") ?? "",
      color: optionalText(formData, "color") ?? "#16776f",
      notes: optionalText(formData, "notes") ?? ""
    }
  });

  revalidatePath("/kilometer");
}

export async function archiveCar(formData: FormData) {
  const session = await requireSession();
  requireFamilyAdmin(session.role);
  await db.car.updateMany({
    where: { id: requiredText(formData, "id"), familyId: session.family.id },
    data: { archivedAt: new Date() }
  });

  revalidatePath("/kilometer");
}

export async function unarchiveCar(formData: FormData) {
  const session = await requireSession();
  requireFamilyAdmin(session.role);
  await db.car.updateMany({
    where: { id: requiredText(formData, "id"), familyId: session.family.id },
    data: { archivedAt: null }
  });

  revalidatePath("/kilometer");
}

export async function updateFuelExpenseSettings(formData: FormData) {
  const session = await requireSession();
  const categoryId = await resolveExpenseCategoryId(session.family.id, session.user.id, optionalText(formData, "defaultCategoryId"));
  const labelId = await resolveExpenseLabelId(session.family.id, session.user.id, optionalText(formData, "defaultLabelId"));

  await db.fuelExpenseSettings.upsert({
    where: {
      familyId_userId: {
        familyId: session.family.id,
        userId: session.user.id
      }
    },
    create: {
      familyId: session.family.id,
      userId: session.user.id,
      autoCreateExpense: formData.get("autoCreateExpense") === "on",
      defaultCategoryId: categoryId,
      defaultLabelId: labelId,
      defaultPaymentMethod: optionalText(formData, "defaultPaymentMethod") ?? "",
      defaultStore: optionalText(formData, "defaultStore") ?? "",
      defaultDescription: optionalText(formData, "defaultDescription") ?? ""
    },
    update: {
      autoCreateExpense: formData.get("autoCreateExpense") === "on",
      defaultCategoryId: categoryId,
      defaultLabelId: labelId,
      defaultPaymentMethod: optionalText(formData, "defaultPaymentMethod") ?? "",
      defaultStore: optionalText(formData, "defaultStore") ?? "",
      defaultDescription: optionalText(formData, "defaultDescription") ?? ""
    }
  });

  revalidatePath("/kilometer");
}

export async function createFuelEntry(formData: FormData) {
  const session = await requireSession();
  const car = await resolveFamilyCar(session.family.id, requiredText(formData, "carId"));
  const odometerKm = parseRequiredIntegerInput(formData.get("odometerKm"), { min: 0, max: 5000000 });
  const existingAtOdometer = await db.fuelEntry.findUnique({
    where: {
      carId_odometerKm: {
        carId: car.id,
        odometerKm
      }
    }
  });
  if (existingAtOdometer) {
    throw new Error("Für dieses Auto gibt es bereits einen Tankstopp mit diesem Kilometerstand.");
  }

  const fuelData = fuelEntryDataFromForm(formData, session.family.id, car.id, session.user.id, odometerKm);
  if (formData.get("createExpenseFromFuel") === "on") {
    const categoryId = await resolveExpenseCategoryId(session.family.id, session.user.id, optionalText(formData, "expenseCategoryId"));
    const labelId = await resolveExpenseLabelId(session.family.id, session.user.id, optionalText(formData, "expenseLabelId"));
    const expenseDescription = optionalText(formData, "expenseDescription") ?? "";
    const expense = await db.$transaction(async (tx) => {
      const fuelEntry = await tx.fuelEntry.create({ data: fuelData });
      return tx.expense.create({
        data: {
          familyId: session.family.id,
          ownerUserId: session.user.id,
          kind: "EXPENSE",
          amountCents: fuelData.costCents,
          currency: "EUR",
          date: fuelData.date,
          paymentMethod: paymentMethodValue(formData, "expensePaymentMethod"),
          store: optionalText(formData, "expenseStore") ?? "",
          categoryId,
          labelId,
          description: expenseDescription,
          scope: "PRIVATE",
          fuelEntryId: fuelEntry.id,
          generatedByFuelEntry: true
        }
      });
    });
    await createLinkedDocumentIfPresent(formData, {
      familyId: session.family.id,
      ownerUserId: session.user.id,
      linkedEntityType: "EXPENSE",
      linkedEntityId: expense.id,
      scope: expense.scope
    });
  } else {
    await db.fuelEntry.create({ data: fuelData });
  }

  revalidatePath("/kilometer");
  revalidatePath("/ausgaben");
  revalidatePath("/dashboard");
  redirect(actionReturnTo(formData, `/kilometer?car=${car.id}`));
}

export async function updateFuelEntry(formData: FormData) {
  const session = await requireSession();
  const car = await resolveFamilyCar(session.family.id, requiredText(formData, "carId"));
  const id = requiredText(formData, "id");
  const odometerKm = parseRequiredIntegerInput(formData.get("odometerKm"), { min: 0, max: 5000000 });
  const existingAtOdometer = await db.fuelEntry.findUnique({
    where: { carId_odometerKm: { carId: car.id, odometerKm } },
    select: { id: true }
  });
  if (existingAtOdometer && existingAtOdometer.id !== id) {
    throw new Error("Für dieses Auto gibt es bereits einen Tankstopp mit diesem Kilometerstand.");
  }

  const fuelData = fuelEntryDataFromForm(formData, session.family.id, car.id, session.user.id, odometerKm);
  await db.fuelEntry.updateMany({
    where: { id, familyId: session.family.id, carId: car.id },
    data: fuelData
  });
  await db.expense.updateMany({
    where: {
      familyId: session.family.id,
      fuelEntryId: id,
      generatedByFuelEntry: true
    },
    data: {
      amountCents: fuelData.costCents,
      date: fuelData.date
    }
  });

  revalidatePath("/kilometer");
  revalidatePath("/ausgaben");
  revalidatePath("/dashboard");
  redirect(actionReturnTo(formData, `/kilometer?car=${car.id}`));
}

export async function deleteFuelEntry(formData: FormData) {
  const session = await requireSession();
  const car = await resolveFamilyCar(session.family.id, requiredText(formData, "carId"));
  await db.fuelEntry.deleteMany({
    where: { id: requiredText(formData, "id"), familyId: session.family.id, carId: car.id }
  });

  revalidatePath("/kilometer");
  redirect(actionReturnTo(formData, `/kilometer?car=${car.id}`));
}

async function importFuelRows(familyId: string, userId: string, carId: string, rows: FuelFormatRow[]) {
  for (const row of rows) {
    const data = {
      familyId,
      carId,
      createdByUserId: userId,
      date: row.date,
      odometerKm: row.odometerKm,
      litersMilli: row.litersMilli,
      costCents: row.costCents,
      note: row.note
    };

    if (row.id) {
      const existing = await db.fuelEntry.findUnique({
        where: { id: row.id },
        select: { familyId: true, carId: true }
      });
      if (existing) {
        if (existing.familyId !== familyId || existing.carId !== carId) {
          throw new Error(`Der importierte Tankstopp mit der ID ${row.id} gehört nicht zu diesem Auto.`);
        }
        await db.fuelEntry.update({ where: { id: row.id }, data });
        continue;
      }
      await db.fuelEntry.create({ data: { id: row.id, ...data } });
      continue;
    }

    await db.fuelEntry.upsert({
      where: {
        carId_odometerKm: {
          carId,
          odometerKm: row.odometerKm
        }
      },
      create: data,
      update: data
    });
  }
}

export async function importFuelFromUploadedXlsx(formData: FormData) {
  const session = await requireSession();
  const file = formData.get("xlsxFile");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte eine XLSX-Datei auswählen.");
  }

  const rows = await parseFuelWorkbook(await file.arrayBuffer(), file.name);
  const carId = await resolveFuelImportCarId(formData, session.family.id, session.user.id, session.role, file.name);
  await importFuelRows(session.family.id, session.user.id, carId, rows);
  revalidatePath("/kilometer");
  redirect(`/kilometer?car=${carId}`);
}

export async function importFuelFromSynologyExcel(formData: FormData) {
  const session = await requireSession();
  const car = await resolveFamilyCar(session.family.id, requiredText(formData, "carId"));
  const excelPath = fuelExcelPathForCar(car.name);
  const fileBuffer = await readFile(excelPath);
  const rows = await parseFuelWorkbook(toArrayBuffer(fileBuffer), excelPath);
  await importFuelRows(session.family.id, session.user.id, car.id, rows);
  revalidatePath("/kilometer");
  redirect(`/kilometer?car=${car.id}`);
}

export async function exportFuelToSynologyExcel(formData: FormData) {
  const session = await requireSession();
  const car = await resolveFamilyCar(session.family.id, requiredText(formData, "carId"));
  const excelPath = fuelExcelPathForCar(car.name);
  const entries = await db.fuelEntry.findMany({
    where: { familyId: session.family.id, carId: car.id },
    include: { expense: true },
    orderBy: [{ date: "asc" }, { odometerKm: "asc" }]
  });
  const rows = entries.map((entry) => ({
    id: entry.id,
    date: entry.date,
    odometerKm: entry.odometerKm,
    litersMilli: entry.litersMilli,
    costCents: entry.costCents,
    expenseId: entry.expense?.id ?? "",
    note: entry.note
  }));

  await mkdir(dirname(excelPath), { recursive: true });
  await writeFile(excelPath, Buffer.from(await buildFuelWorkbook(rows, car.name)));
  revalidatePath("/kilometer");
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
      monthlyBudgetCents: parseOptionalEuroInputToCents(formData.get("monthlyBudget")),
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
      monthlyBudgetCents: parseOptionalEuroInputToCents(formData.get("monthlyBudget")),
      scope: scopeValue(formData)
    }
  });

  revalidatePath("/ausgaben");
  revalidatePath("/dashboard");
}

export async function deleteCategory(formData: FormData) {
  const session = await requireSession();
  const id = requiredText(formData, "id");
  const categoryWhere = {
    id,
    familyId: session.family.id,
    type: "EXPENSE" as const,
    ...(session.role === "ADMIN" ? {} : { ownerUserId: session.user.id })
  };
  const [category, expenseCount, settingsCount] = await Promise.all([
    db.category.findFirst({
      where: categoryWhere,
      select: { id: true }
    }),
    db.expense.count({
      where: {
        familyId: session.family.id,
        categoryId: id
      }
    }),
    db.fuelExpenseSettings.count({
      where: {
        familyId: session.family.id,
        defaultCategoryId: id
      }
    })
  ]);
  if (!category) throw new Error("Die ausgewählte Kategorie ist nicht verfügbar.");
  if (expenseCount > 0) throw new Error("Diese Kategorie wird noch von Ausgaben genutzt. Bitte zuerst zusammenführen oder Zuordnungen entfernen.");
  if (settingsCount > 0) throw new Error("Diese Kategorie ist noch im Auto-Setup hinterlegt. Bitte dort zuerst entfernen.");

  await db.category.delete({ where: { id: category.id } });
  revalidatePath("/ausgaben");
  revalidatePath("/dashboard");
}

export async function deleteExpense(formData: FormData) {
  const session = await requireSession();
  const id = requiredText(formData, "id");
  await db.expense.deleteMany({
    where: ownedExpenseWhere(session.family.id, session.user.id, id)
  });
  revalidatePath("/ausgaben");
  revalidatePath("/dashboard");
  redirect(actionReturnTo(formData, "/ausgaben"));
}

export async function mergeExpenseCategories(formData: FormData) {
  const session = await requireSession();
  const sourceCategoryId = requiredText(formData, "sourceCategoryId");
  const targetCategoryId = requiredText(formData, "targetCategoryId");
  if (sourceCategoryId === targetCategoryId) throw new Error("Bitte zwei unterschiedliche Kategorien auswählen.");

  const [sourceCategory, targetCategory] = await Promise.all([
    db.category.findFirst({
      where: {
        id: sourceCategoryId,
        familyId: session.family.id,
        type: "EXPENSE",
        ...scopeWhereForCategoryColor(session.user.id)
      },
      select: { id: true, ownerUserId: true }
    }),
    db.category.findFirst({
      where: {
        id: targetCategoryId,
        familyId: session.family.id,
        type: "EXPENSE",
        ...scopeWhereForCategoryColor(session.user.id)
      },
      select: { id: true }
    })
  ]);
  if (!sourceCategory || !targetCategory) throw new Error("Die ausgewählten Kategorien sind nicht verfügbar.");

  await db.expense.updateMany({
    where: {
      familyId: session.family.id,
      ownerUserId: session.user.id,
      categoryId: sourceCategory.id
    },
    data: { categoryId: targetCategory.id }
  });

  if (sourceCategory.ownerUserId === session.user.id) {
    const remainingUses = await db.expense.count({ where: { categoryId: sourceCategory.id } });
    if (remainingUses === 0) {
      await db.category.delete({ where: { id: sourceCategory.id } });
    }
  }

  revalidatePath("/ausgaben");
  revalidatePath("/dashboard");
}

export async function createTask(formData: FormData) {
  const session = await requireSession();
  const assignedToUserId = await resolveTaskAssigneeId(session.family.id, optionalText(formData, "assignedToUserId"));
  const dueDate = optionalText(formData, "dueDate");

  await db.task.create({
    data: {
      familyId: session.family.id,
      ownerUserId: session.user.id,
      assignedToUserId,
      title: requiredText(formData, "title"),
      description: optionalText(formData, "description"),
      status: "OPEN",
      priority: enumValue(formData, "priority", ["LOW", "MEDIUM", "HIGH", "URGENT"] as const, "MEDIUM"),
      dueDate: parseOptionalDateInput(dueDate),
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
  const assignedToUserId = await resolveTaskAssigneeId(session.family.id, optionalText(formData, "assignedToUserId"));
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
      assignedToUserId,
      title: requiredText(formData, "title"),
      description: optionalText(formData, "description"),
      ...(status ? { status } : {}),
      priority: enumValue(formData, "priority", ["LOW", "MEDIUM", "HIGH", "URGENT"] as const, "MEDIUM"),
      dueDate: parseOptionalDateInput(dueDate),
      scope: scopeValue(formData)
    }
  });

  revalidatePath("/aufgaben");
  revalidatePath("/dashboard");
}

export async function createContract(formData: FormData) {
  const session = await requireSession();
  const endDate = optionalText(formData, "endDate");
  const noticeDays = parseOptionalIntegerInput(formData.get("cancellationNoticeDays"), { min: 0, max: 3650 });
  const autoRenewal = formData.get("autoRenewal") === "on";
  const autoCreateExpenses = formData.get("autoCreateExpenses") === "on";
  const expensePaymentDay = parseOptionalIntegerInput(formData.get("expensePaymentDay"), { min: 1, max: 31 });
  const cancellation = resolveContractCancellationSchedule({
    annualDeadline: optionalText(formData, "cancellationDeadline"),
    endDate,
    noticeDays,
    autoRenewal,
    renewalInterval: renewalIntervalValue(formData)
  });

  const contract = await db.contract.create({
    data: {
      familyId: session.family.id,
      ownerUserId: session.user.id,
      provider: requiredText(formData, "provider"),
      contractType: requiredText(formData, "contractType"),
      description: optionalText(formData, "description"),
      costCents: parseEuroInputToCents(formData.get("cost")),
      currency: "EUR",
      billingInterval: enumValue(formData, "billingInterval", ["MONTHLY", "YEARLY", "QUARTERLY", "ONCE", "OTHER"] as const, "MONTHLY"),
      startDate: parseRequiredDateInput(formData.get("startDate")),
      endDate: parseOptionalDateInput(endDate),
      cancellationNoticeDays: noticeDays,
      cancellationDeadlineMonth: cancellation.deadlineMonth,
      cancellationDeadlineDay: cancellation.deadlineDay,
      autoRenewal,
      renewalInterval: renewalIntervalValue(formData),
      renewalAnchorDay: cancellation.renewalAnchorDay,
      autoCreateExpenses,
      expensePaymentDay,
      nextCancellationDate: cancellation.nextDate,
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

  await ensureDueContractExpenses(session.family.id, session.user.id);
  revalidatePath("/vertraege");
  revalidatePath("/ausgaben");
  revalidatePath("/dashboard");
}

export async function updateContract(formData: FormData) {
  const session = await requireSession();
  const endDate = optionalText(formData, "endDate");
  const noticeDays = parseOptionalIntegerInput(formData.get("cancellationNoticeDays"), { min: 0, max: 3650 });
  const autoRenewal = formData.get("autoRenewal") === "on";
  const autoCreateExpenses = formData.get("autoCreateExpenses") === "on";
  const expensePaymentDay = parseOptionalIntegerInput(formData.get("expensePaymentDay"), { min: 1, max: 31 });
  const cancellation = resolveContractCancellationSchedule({
    annualDeadline: optionalText(formData, "cancellationDeadline"),
    endDate,
    noticeDays,
    autoRenewal,
    renewalInterval: renewalIntervalValue(formData),
    renewalAnchorDay: parseOptionalIntegerInput(formData.get("renewalAnchorDay"), { min: 1, max: 31 })
  });

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
      costCents: parseEuroInputToCents(formData.get("cost")),
      currency: "EUR",
      billingInterval: enumValue(formData, "billingInterval", ["MONTHLY", "YEARLY", "QUARTERLY", "ONCE", "OTHER"] as const, "MONTHLY"),
      startDate: parseRequiredDateInput(formData.get("startDate")),
      endDate: parseOptionalDateInput(endDate),
      cancellationNoticeDays: noticeDays,
      cancellationDeadlineMonth: cancellation.deadlineMonth,
      cancellationDeadlineDay: cancellation.deadlineDay,
      autoRenewal,
      renewalInterval: renewalIntervalValue(formData),
      renewalAnchorDay: cancellation.renewalAnchorDay,
      autoCreateExpenses,
      expensePaymentDay,
      nextCancellationDate: cancellation.nextDate,
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

  await ensureDueContractExpenses(session.family.id, session.user.id);
  revalidatePath("/vertraege");
  revalidatePath("/ausgaben");
  revalidatePath("/dashboard");
}

export async function createDocumentReference(formData: FormData) {
  const session = await requireSession();
  const url = requiredText(formData, "url");
  if (!url.startsWith("https://")) {
    throw new Error("Dokumentverweise müssen als HTTPS-Link gespeichert werden.");
  }
  const linkedEntityType = enumValue(formData, "linkedEntityType", ["EXPENSE", "TASK", "CONTRACT", "GENERAL"] as const, "GENERAL");
  const linkedEntityId = await resolveDocumentLinkedEntityId(session.family.id, session.user.id, linkedEntityType, optionalText(formData, "linkedEntityId"));

  await db.documentReference.create({
    data: {
      familyId: session.family.id,
      ownerUserId: session.user.id,
      linkedEntityType,
      linkedEntityId,
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
  const linkedEntityType = enumValue(formData, "linkedEntityType", ["EXPENSE", "TASK", "CONTRACT", "GENERAL"] as const, "GENERAL");
  const linkedEntityId = await resolveDocumentLinkedEntityId(session.family.id, session.user.id, linkedEntityType, optionalText(formData, "linkedEntityId"));

  await db.documentReference.updateMany({
    where: {
      id: requiredText(formData, "id"),
      familyId: session.family.id,
      ...(session.role === "ADMIN" ? {} : { ownerUserId: session.user.id })
    },
    data: {
      linkedEntityType,
      linkedEntityId,
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

export async function changeOwnPassword(formData: FormData) {
  const session = await requireSession();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = passwordSchema.parse(String(formData.get("newPassword") ?? ""));
  requireMatchingPasswordConfirmation(formData, newPassword);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true, name: true }
  });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new Error("Das aktuelle Passwort stimmt nicht.");
  }

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) }
    }),
    db.session.deleteMany({ where: { userId: user.id } }),
    db.loginAttempt.deleteMany({ where: { normalizedName: normalizeLoginName(user.name) } })
  ]);

  await createSession(user.id);
  revalidatePath("/einstellungen");
  redirect("/einstellungen?password=changed");
}

export async function resetMemberPassword(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "ADMIN") throw new Error("Nur Admins können Passwörter zurücksetzen.");

  const userId = requiredText(formData, "userId");
  if (userId === session.user.id) {
    throw new Error("Ändere dein eigenes Passwort bitte mit deinem aktuellen Passwort.");
  }
  const newPassword = passwordSchema.parse(String(formData.get("newPassword") ?? ""));
  requireMatchingPasswordConfirmation(formData, newPassword);

  const membership = await db.familyMember.findFirst({
    where: {
      familyId: session.family.id,
      userId,
      status: "ACTIVE"
    },
    include: { user: true }
  });
  if (!membership) throw new Error("Dieses Familienmitglied ist nicht verfügbar.");

  await db.$transaction([
    db.user.update({
      where: { id: membership.userId },
      data: { passwordHash: await hashPassword(newPassword) }
    }),
    db.session.deleteMany({ where: { userId: membership.userId } }),
    db.loginAttempt.deleteMany({ where: { normalizedName: normalizeLoginName(membership.user.name) } })
  ]);

  revalidatePath("/einstellungen");
}

export async function setAdminRecoveryKey(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "ADMIN") throw new Error("Nur Admins können den Notfallschlüssel verwalten.");

  const recoveryKey = recoveryKeySchema.parse(String(formData.get("recoveryKey") ?? ""));
  const confirmation = String(formData.get("confirmRecoveryKey") ?? "");
  if (recoveryKey !== confirmation) throw new Error("Die Wiederholung des Notfallschlüssels stimmt nicht.");

  await db.adminRecoveryKey.upsert({
    where: { familyId: session.family.id },
    create: {
      familyId: session.family.id,
      keyHash: await hashPassword(recoveryKey),
      createdByUserId: session.user.id
    },
    update: {
      keyHash: await hashPassword(recoveryKey),
      createdByUserId: session.user.id,
      lastUsedAt: null
    }
  });

  revalidatePath("/einstellungen");
  redirect("/einstellungen?recovery=changed");
}

export async function recoverAdminPassword(formData: FormData) {
  const name = requiredText(formData, "name");
  const recoveryKey = String(formData.get("recoveryKey") ?? "");

  const newPassword = passwordSchema.parse(String(formData.get("newPassword") ?? ""));
  requireMatchingPasswordConfirmation(formData, newPassword);

  const membership = await db.familyMember.findFirst({
    where: {
      user: {
        name,
        status: "ACTIVE"
      },
      role: "ADMIN",
      status: "ACTIVE"
    },
    include: { user: true, family: { include: { adminRecoveryKey: true } } }
  });
  if (!membership?.family.adminRecoveryKey) {
    await slowRecoveryFailure();
    throw new Error("Name oder Notfallschlüssel stimmt nicht.");
  }

  const keyIsValid = await verifyPassword(recoveryKey, membership.family.adminRecoveryKey.keyHash);
  if (!keyIsValid) {
    await slowRecoveryFailure();
    throw new Error("Name oder Notfallschlüssel stimmt nicht.");
  }

  await db.$transaction([
    db.user.update({
      where: { id: membership.userId },
      data: { passwordHash: await hashPassword(newPassword) }
    }),
    db.session.deleteMany({ where: { userId: membership.userId } }),
    db.loginAttempt.deleteMany({ where: { normalizedName: normalizeLoginName(membership.user.name) } }),
    db.adminRecoveryKey.update({
      where: { familyId: membership.familyId },
      data: { lastUsedAt: new Date() }
    })
  ]);

  await createSession(membership.userId);
  redirect("/dashboard");
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
          linkedEntityId: data.linkedEntityId,
          ownerUserId: data.ownerUserId
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
        linkedEntityId: data.linkedEntityId,
        ownerUserId: data.ownerUserId
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

function requireMatchingPasswordConfirmation(formData: FormData, password: string) {
  const confirmation = String(formData.get("confirmPassword") ?? "");
  if (password !== confirmation) throw new Error("Die Passwort-Wiederholung stimmt nicht.");
}

function optionalText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function paymentMethodValue(formData: FormData, key = "paymentMethod") {
  return optionalText(formData, key) ?? "Nicht angegeben";
}

function actionReturnTo(formData: FormData, fallback: string) {
  const value = optionalText(formData, "returnTo");
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) return fallback;
  return value;
}

function renewalIntervalValue(formData: FormData) {
  return enumValue(formData, "renewalInterval", ["MONTHLY", "QUARTERLY", "YEARLY"] as const, "MONTHLY");
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

function expenseExcelPathForUser(userName: string, year: number) {
  const configuredDir = process.env.EXPENSE_EXCEL_DIR;
  if (!configuredDir) throw new Error("EXPENSE_EXCEL_DIR ist nicht gesetzt.");
  return join(configuredDir, `Ausgaben-${safeFilePart(userName)}-${year}.xlsx`);
}

function fuelExcelPathForCar(carName: string) {
  const configuredDir = process.env.MILEAGE_EXCEL_DIR;
  if (!configuredDir) throw new Error("MILEAGE_EXCEL_DIR ist nicht gesetzt.");
  return join(configuredDir, `Verbrauch-${safeFilePart(carName)}.xlsx`);
}

function fuelEntryDataFromForm(formData: FormData, familyId: string, carId: string, userId: string, odometerKm?: number) {
  return {
    familyId,
    carId,
    createdByUserId: userId,
    date: parseRequiredDateInput(formData.get("date")),
    odometerKm: odometerKm ?? parseRequiredIntegerInput(formData.get("odometerKm"), { min: 0, max: 5000000 }),
    litersMilli: parseDecimalInputToMilli(formData.get("liters"), { min: 0.001, max: 10000 }),
    costCents: parseEuroInputToCents(formData.get("cost")),
    note: optionalText(formData, "note") ?? ""
  };
}

async function resolveFamilyCar(familyId: string, carId: string) {
  const car = await db.car.findFirst({
    where: {
      id: carId,
      familyId,
      archivedAt: null
    }
  });
  if (!car) throw new Error("Das ausgewählte Auto ist nicht verfügbar.");
  return car;
}

async function resolveFuelImportCarId(formData: FormData, familyId: string, userId: string, role: "ADMIN" | "MEMBER", fileName: string) {
  const carId = optionalText(formData, "carId");
  if (carId) return (await resolveFamilyCar(familyId, carId)).id;

  requireFamilyAdmin(role);
  const name = inferCarNameFromFuelFileName(fileName);
  const existing = await db.car.findFirst({
    where: {
      familyId,
      name,
      archivedAt: null
    }
  });
  if (existing) return existing.id;

  const car = await db.car.create({
    data: {
      familyId,
      createdByUserId: userId,
      name
    }
  });
  return car.id;
}

function requireFamilyAdmin(role: "ADMIN" | "MEMBER") {
  if (!isFamilyAdmin(role)) throw new Error("Nur Admins können Autos verwalten.");
}

function exportYearFromFormData(formData: FormData) {
  const year = Number(formData.get("year"));
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new Error("Bitte ein gültiges Exportjahr auswählen.");
  }
  return year;
}

function primaryImportedYear(rows: ExpenseFormatRow[]) {
  const counts = new Map<number, number>();
  for (const row of rows) {
    const year = row.date.getFullYear();
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? new Date().getFullYear();
}

function toArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function scopeValue(formData: FormData) {
  return formData.get("scope") === "PRIVATE" ? "PRIVATE" : "FAMILY";
}

function enumValue<T extends string>(formData: FormData, key: string, allowed: readonly T[], fallback: T) {
  const value = String(formData.get(key) ?? fallback) as T;
  return allowed.includes(value) ? value : fallback;
}

function normalizeLoginName(name: string) {
  return name.trim().toLocaleLowerCase("de-DE");
}

async function slowRecoveryFailure() {
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function recordLoginFailure(normalizedName: string) {
  const now = new Date();
  const existing = await db.loginAttempt.findUnique({ where: { normalizedName } });
  const previousFailures = existing?.lockedUntil && existing.lockedUntil <= now ? 0 : existing?.failedCount ?? 0;
  const failedCount = previousFailures + 1;
  const lockedUntil = failedCount >= MAX_LOGIN_FAILURES
    ? new Date(now.getTime() + LOGIN_LOCK_MINUTES * 60_000)
    : null;

  await db.loginAttempt.upsert({
    where: { normalizedName },
    create: {
      normalizedName,
      failedCount,
      lockedUntil,
      lastFailedAt: now
    },
    update: {
      failedCount,
      lockedUntil,
      lastFailedAt: now
    }
  });
}
