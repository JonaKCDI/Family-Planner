import ExcelJS from "exceljs";
import { parseEuroToCents } from "@/lib/format";

export type ExpenseFormatRow = {
  id?: string;
  kind: "EXPENSE" | "INCOME";
  amountCents: number;
  currency: string;
  date: Date;
  paymentMethod: string;
  categoryName: string;
  labelName: string;
  description: string;
};

export type ExpenseExportRow = ExpenseFormatRow & {
  id: string;
};

const csvHeader = ["id", "kind", "amountCents", "currency", "date", "paymentMethod", "category", "label", "description"];
const monthSheets = [
  { name: "Januar", month: 0 },
  { name: "Februar", month: 1 },
  { name: "Maerz", month: 2 },
  { name: "April", month: 3 },
  { name: "Mai", month: 4 },
  { name: "Juni", month: 5 },
  { name: "Juli", month: 6 },
  { name: "August", month: 7 },
  { name: "September", month: 8 },
  { name: "Oktober", month: 9 },
  { name: "November", month: 10 },
  { name: "Dezember", month: 11 }
] as const;

export function parseExpenseCsv(content: string): ExpenseFormatRow[] {
  const rows = normalizeWrappedCsvRows(parseCsv(content));
  const header = rows.shift()?.map(normalizeCsvHeader) ?? [];
  const indexes = csvColumnIndexes(header);
  const required = ["id", "kind", "amountCents", "currency", "date", "category", "label", "description"] as const;
  const missing = required.filter((field) => indexes[field] < 0);
  if (missing.length > 0) {
    throw new Error(`CSV braucht die Spalten: ${required.join(", ")}. Gefunden wurden: ${header.join(", ") || "keine Kopfzeile"}`);
  }

  return rows.flatMap((row) => {
    if (row.length === 0 || row.every((cell) => !cell.trim())) return [];
    return [{
      id: row[indexes.id]?.trim() || undefined,
      kind: normalizeTransactionKind(row[indexes.kind]),
      amountCents: parseCsvAmountCents(row[indexes.amountCents]),
      currency: row[indexes.currency]?.trim() || "EUR",
      date: new Date(row[indexes.date] ?? new Date()),
      paymentMethod: row[indexes.paymentMethod]?.trim() || "Nicht angegeben",
      categoryName: row[indexes.category]?.trim() ?? "",
      labelName: row[indexes.label]?.trim() ?? "",
      description: row[indexes.description]?.trim() || "CSV Import"
    }];
  });
}

export function stringifyExpenseCsv(expenses: ExpenseExportRow[]) {
  const rows = [
    csvHeader,
    ...expenses.map((expense) => [
      expense.id,
      expense.kind,
      String(expense.amountCents),
      expense.currency,
      toIsoDate(expense.date),
      expense.paymentMethod,
      expense.categoryName,
      expense.labelName,
      expense.description
    ])
  ];
  return stringifyCsv(rows);
}

export async function parseExpenseWorkbook(buffer: ArrayBuffer, fileName = "Ausgaben_2026.xlsx"): Promise<ExpenseFormatRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const workbookYear = getWorkbookYear(fileName) ?? new Date().getFullYear();
  const rows: ExpenseFormatRow[] = [];

  for (const sheetInfo of monthSheets) {
    const worksheet = workbook.getWorksheet(sheetInfo.name);
    if (!worksheet) continue;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber < 4) return;
      const label = cellText(row.getCell(2));
      const rawDate = cellDate(row.getCell(3));
      const categoryName = cellText(row.getCell(4));
      const name = cellText(row.getCell(5));
      const store = cellText(row.getCell(6));
      const amount = cellNumber(row.getCell(7));
      const paymentMethod = cellText(row.getCell(8)) || "Nicht angegeben";
      if (!rawDate || amount === null) return;

      const day = Math.min(rawDate.getDate(), daysInMonth(workbookYear, sheetInfo.month));
      const signedCents = Math.round(amount * 100);
      rows.push({
        kind: signedCents >= 0 ? "INCOME" : "EXPENSE",
        amountCents: Math.abs(signedCents),
        currency: "EUR",
        date: new Date(Date.UTC(workbookYear, sheetInfo.month, day)),
        paymentMethod,
        categoryName,
        labelName: label,
        description: [name, store].filter(Boolean).join(" · ") || categoryName || "Excel Import"
      });
    });
  }

  return rows;
}

export async function buildExpenseWorkbook(expenses: ExpenseExportRow[], year: number) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Family App";
  workbook.created = new Date();
  const categories = [...new Set(expenses.map((expense) => expense.categoryName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));

  for (const sheetInfo of monthSheets) {
    const worksheet = workbook.addWorksheet(sheetInfo.name);
    worksheet.columns = [
      { key: "emptyA", width: 4 },
      { key: "label", width: 18 },
      { key: "date", width: 13 },
      { key: "category", width: 18 },
      { key: "name", width: 24 },
      { key: "store", width: 20 },
      { key: "amount", width: 12 },
      { key: "payment", width: 16 },
      { key: "metric", width: 12 },
      { key: "metricValue", width: 14 },
      { key: "emptyK", width: 4 },
      { key: "categoryList", width: 20 },
      { key: "categoryTotal", width: 14 }
    ];
    worksheet.getCell("B3").value = "Label";
    worksheet.getCell("C3").value = "Datum";
    worksheet.getCell("D3").value = "Zweck";
    worksheet.getCell("E3").value = "Bezeichnung";
    worksheet.getCell("F3").value = "Laden";
    worksheet.getCell("G3").value = "Betrag";
    worksheet.getCell("H3").value = "Zahlungsart";
    worksheet.getCell("L3").value = "Zwecke";
    const monthExpenses = expenses
      .filter((expense) => expense.date.getFullYear() === year && expense.date.getMonth() === sheetInfo.month)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    let rowNumber = 4;
    for (const expense of monthExpenses) {
      const signedAmount = (expense.kind === "INCOME" ? expense.amountCents : -expense.amountCents) / 100;
      worksheet.getCell(rowNumber, 2).value = expense.labelName || undefined;
      worksheet.getCell(rowNumber, 3).value = expense.date;
      worksheet.getCell(rowNumber, 4).value = expense.categoryName;
      worksheet.getCell(rowNumber, 5).value = expense.description;
      worksheet.getCell(rowNumber, 7).value = signedAmount;
      worksheet.getCell(rowNumber, 8).value = expense.paymentMethod === "Nicht angegeben" ? undefined : expense.paymentMethod;
      worksheet.getCell(rowNumber, 3).numFmt = "dd.mm.yyyy";
      worksheet.getCell(rowNumber, 7).numFmt = "#,##0.00";
      rowNumber += 1;
    }
    worksheet.getCell("I8").value = "Saldo:";
    worksheet.getCell("J8").value = { formula: "SUM(G4:G100000)" };
    worksheet.getCell("I9").value = "Ausgaben:";
    worksheet.getCell("J9").value = { formula: 'SUMIF(G:G,"<0",G:G)' };
    categories.forEach((category, index) => {
      const targetRow = 4 + index;
      worksheet.getCell(targetRow, 12).value = category;
      worksheet.getCell(targetRow, 13).value = { formula: `SUMIF(D:D,L${targetRow},G:G)` };
    });
    worksheet.getRow(3).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 3 }];
  }

  const summary = workbook.addWorksheet("gesamt");
  summary.columns = [{ width: 4 }, { width: 18 }, { width: 18 }, { width: 4 }, { width: 24 }, { width: 16 }];
  summary.getCell("B18").value = "Saldo";
  summary.getCell("C18").value = { formula: monthSheets.map((sheet) => `${sheet.name}!J8`).join("+") };
  summary.getCell("B19").value = "Ausgaben";
  summary.getCell("C19").value = { formula: monthSheets.map((sheet) => `${sheet.name}!J9`).join("+") };
  categories.forEach((category, index) => {
    const row = 14 + index;
    summary.getCell(row, 5).value = category;
    summary.getCell(row, 6).value = { formula: monthSheets.map((sheet) => `${sheet.name}!M${4 + index}`).join("+") };
  });

  return workbook.xlsx.writeBuffer();
}

function parseCsv(content: string) {
  const delimiter = detectCsvDelimiter(content);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function normalizeWrappedCsvRows(rows: string[][]) {
  if (!rows[0] || rows[0].length !== 1 || !rows[0][0].includes(",")) return rows;
  return rows.map((row) => {
    if (row.length !== 1) return row;
    const reparsed = parseCsv(row[0]);
    return reparsed[0] ?? row;
  });
}

function detectCsvDelimiter(content: string) {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t"];
  return candidates
    .map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ",";
}

function normalizeCsvHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^"|"$/g, "")
    .toLowerCase();
}

function csvColumnIndexes(header: string[]) {
  return {
    id: findCsvColumn(header, ["id", "expenseid", "expense_id", "eintragsid"]),
    kind: findCsvColumn(header, ["kind", "type", "art", "typ"]),
    amountCents: findCsvColumn(header, ["amountcents", "amount_cents", "betragcent", "betragcents", "betrag_cent", "betrag_cents", "amount", "betrag"]),
    currency: findCsvColumn(header, ["currency", "währung", "waehrung"]),
    date: findCsvColumn(header, ["date", "datum"]),
    paymentMethod: findCsvColumn(header, ["paymentmethod", "payment_method", "bezahlart", "zahlungsart", "zahlungsmethode"]),
    category: findCsvColumn(header, ["category", "kategorie"]),
    label: findCsvColumn(header, ["label", "projekt", "project"]),
    description: findCsvColumn(header, ["description", "beschreibung", "notiz", "notes"])
  };
}

function findCsvColumn(header: string[], names: string[]) {
  return header.findIndex((field) => names.includes(field.replace(/[\s-]/g, "")));
}

function normalizeTransactionKind(value: string | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["income", "einnahme", "in"].includes(normalized) ? "INCOME" as const : "EXPENSE" as const;
}

function parseCsvAmountCents(value: string | undefined) {
  const text = String(value ?? "0").trim();
  if (!text.includes(",") && !text.includes(".") && /^-?\d+$/.test(text)) {
    return Math.abs(Number(text));
  }
  return Math.abs(parseEuroToCents(text));
}

function stringifyCsv(rows: string[][]) {
  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, "\"\"")}"`).join(","))
    .join("\n");
}

function getWorkbookYear(fileName: string) {
  const match = fileName.match(/(?:^|[^0-9])(20[0-9]{2})(?:[^0-9]|$)/);
  return match ? Number(match[1]) : null;
}

function cellText(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "text" in value) return String(value.text ?? "").trim();
  if (typeof value === "object" && "result" in value) return String(value.result ?? "").trim();
  return String(value).trim();
}

function cellDate(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(Math.round((value - 25569) * 86400 * 1000));
  const text = cellText(cell);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function cellNumber(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value && "result" in value && typeof value.result === "number") return value.result;
  const text = cellText(cell).replace(/\./g, "").replace(",", ".");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
