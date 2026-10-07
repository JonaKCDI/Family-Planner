"use server";

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getFamilyFinance } from "./family-finance";
import { buildFamilyFinanceWorkbook } from "./family-finance-workbook";
import { safeFilePart } from "./file-names";

export async function exportFamilyFinanceToSynology(form: FormData) {
  const { session, expenses } = await getFamilyFinance();
  const year = Number(form.get("year"));
  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error("Ungültiges Jahr.");
  const directory = process.env.EXPENSE_EXCEL_DIR;
  if (!directory) throw new Error("Der Excel-Ordner ist noch nicht eingerichtet.");
  const rows = expenses.filter(e => e.date.getUTCFullYear() === year);
  const path = join(directory, `Familienauswertung-${safeFilePart(session.family.name)}-${year}.xlsx`);
  await mkdir(directory, {recursive:true});
  await writeFile(path, Buffer.from(await buildFamilyFinanceWorkbook(rows)));
}
