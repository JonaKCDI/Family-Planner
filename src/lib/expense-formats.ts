import ExcelJS from "exceljs";

export type ExpenseFormatRow = {
  id?: string;
  kind: "EXPENSE" | "INCOME";
  amountCents: number;
  currency: string;
  date: Date;
  paymentMethod: string;
  store: string;
  categoryName: string;
  labelName: string;
  contractId?: string;
  contractProvider?: string;
  contractType?: string;
  description: string;
};

export type ExpenseExportRow = ExpenseFormatRow & {
  id: string;
};

const dataSheetName = "Daten";
const dataSheetHeader = [
  "id",
  "art",
  "betragCents",
  "waehrung",
  "datum",
  "zahlungsart",
  "laden",
  "kategorie",
  "label",
  "vertragId",
  "vertragAnbieter",
  "vertragArt",
  "beschreibung"
];
const dataRequiredFields = ["kind", "amountCents", "currency", "date", "category", "label", "description"] as const;
const dataHeaderScanLimit = 20;
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

export async function parseExpenseWorkbook(buffer: ArrayBuffer, fileName = "Ausgaben_2026.xlsx"): Promise<ExpenseFormatRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const dataSheet = workbook.getWorksheet(dataSheetName);
  if (dataSheet) return parseDataSheet(dataSheet);

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
        store,
        categoryName,
        labelName: label,
        description: name || categoryName || "Excel Import"
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

  const dataSheet = workbook.addWorksheet(dataSheetName);
  dataSheet.columns = [
    { key: "id", width: 28 },
    { key: "kind", width: 12 },
    { key: "amountCents", width: 14 },
    { key: "currency", width: 10 },
    { key: "date", width: 13 },
    { key: "paymentMethod", width: 16 },
    { key: "store", width: 20 },
    { key: "categoryName", width: 18 },
    { key: "labelName", width: 18 },
    { key: "contractId", width: 28 },
    { key: "contractProvider", width: 22 },
    { key: "contractType", width: 18 },
    { key: "description", width: 32 }
  ];
  dataSheet.addRow(dataSheetHeader);
  for (const expense of [...expenses].sort((a, b) => b.date.getTime() - a.date.getTime())) {
    dataSheet.addRow([
      expense.id,
      expense.kind,
      expense.amountCents,
      expense.currency,
      toIsoDate(expense.date),
      expense.paymentMethod,
      expense.store,
      expense.categoryName,
      expense.labelName,
      expense.contractId ?? "",
      expense.contractProvider ?? "",
      expense.contractType ?? "",
      expense.description
    ]);
  }
  dataSheet.getRow(1).font = { bold: true };
  dataSheet.views = [{ state: "frozen", ySplit: 1 }];

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
      worksheet.getCell(rowNumber, 6).value = expense.store || undefined;
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

function normalizeWorkbookHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^"|"$/g, "")
    .toLowerCase();
}

function parseDataSheet(worksheet: ExcelJS.Worksheet): ExpenseFormatRow[] {
  const header = findDataSheetHeader(worksheet);
  const missing = dataRequiredFields.filter((field) => header.indexes[field] < 0);
  if (missing.length > 0) {
    throw new Error(`Excel-Datenblatt braucht die Spalten: ${dataRequiredFields.join(", ")}.`);
  }

  const rows: ExpenseFormatRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= header.rowNumber) return;
    const date = cellDate(row.getCell(header.indexes.date + 1));
    const amountCents = cellInteger(row.getCell(header.indexes.amountCents + 1));
    if (!date || amountCents === null) return;
    rows.push({
      id: header.indexes.id >= 0 ? cellText(row.getCell(header.indexes.id + 1)) || undefined : undefined,
      kind: normalizeTransactionKind(cellText(row.getCell(header.indexes.kind + 1))),
      amountCents: Math.abs(amountCents),
      currency: cellText(row.getCell(header.indexes.currency + 1)) || "EUR",
      date,
      paymentMethod: header.indexes.paymentMethod >= 0 ? cellText(row.getCell(header.indexes.paymentMethod + 1)) || "Nicht angegeben" : "Nicht angegeben",
      store: header.indexes.store >= 0 ? cellText(row.getCell(header.indexes.store + 1)) : "",
      categoryName: cellText(row.getCell(header.indexes.category + 1)),
      labelName: cellText(row.getCell(header.indexes.label + 1)),
      contractId: header.indexes.contractId >= 0 ? cellText(row.getCell(header.indexes.contractId + 1)) || undefined : undefined,
      contractProvider: header.indexes.contractProvider >= 0 ? cellText(row.getCell(header.indexes.contractProvider + 1)) || undefined : undefined,
      contractType: header.indexes.contractType >= 0 ? cellText(row.getCell(header.indexes.contractType + 1)) || undefined : undefined,
      description: cellText(row.getCell(header.indexes.description + 1)) || "Excel Import"
    });
  });
  return rows;
}

function findDataSheetHeader(worksheet: ExcelJS.Worksheet) {
  const maxRow = Math.min(worksheet.rowCount, dataHeaderScanLimit);
  let bestMatch = {
    rowNumber: 1,
    indexes: dataColumnIndexes(rowHeaderNames(worksheet.getRow(1))),
    matchCount: 0
  };

  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber += 1) {
    const indexes = dataColumnIndexes(rowHeaderNames(worksheet.getRow(rowNumber)));
    const matchCount = dataRequiredFields.filter((field) => indexes[field] >= 0).length;
    if (matchCount > bestMatch.matchCount) {
      bestMatch = { rowNumber, indexes, matchCount };
    }
    if (matchCount === dataRequiredFields.length) return { rowNumber, indexes };
  }

  return { rowNumber: bestMatch.rowNumber, indexes: bestMatch.indexes };
}

function rowHeaderNames(row: ExcelJS.Row) {
  return Array.from({ length: row.cellCount }, (_, index) => normalizeWorkbookHeader(cellText(row.getCell(index + 1))));
}

function dataColumnIndexes(header: string[]) {
  return {
    id: findWorkbookColumn(header, ["id", "expenseid", "expense_id", "eintragsid"]),
    kind: findWorkbookColumn(header, ["kind", "type", "art", "typ"]),
    amountCents: findWorkbookColumn(header, ["amountcents", "amount_cents", "betragcent", "betragcents", "betrag_cent", "betrag_cents"]),
    currency: findWorkbookColumn(header, ["currency", "währung", "waehrung", "wahrung"]),
    date: findWorkbookColumn(header, ["date", "datum"]),
    paymentMethod: findWorkbookColumn(header, ["paymentmethod", "payment_method", "bezahlart", "zahlungsart", "zahlungsmethode"]),
    store: findWorkbookColumn(header, ["store", "shop", "laden", "haendler", "händler", "merchant"]),
    category: findWorkbookColumn(header, ["category", "kategorie"]),
    label: findWorkbookColumn(header, ["label", "projekt", "project"]),
    contractId: findWorkbookColumn(header, ["contractid", "contract_id", "vertragid", "vertrag_id"]),
    contractProvider: findWorkbookColumn(header, ["contractprovider", "contract_provider", "vertraganbieter", "vertrag_anbieter", "anbieter"]),
    contractType: findWorkbookColumn(header, ["contracttype", "contract_type", "vertragart", "vertragsart"]),
    description: findWorkbookColumn(header, ["description", "beschreibung", "notiz", "notes"])
  };
}

function findWorkbookColumn(header: string[], names: string[]) {
  return header.findIndex((field) => names.includes(field.replace(/[\s-]/g, "")));
}

function normalizeTransactionKind(value: string | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["income", "einnahme", "in"].includes(normalized) ? "INCOME" as const : "EXPENSE" as const;
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

function cellInteger(cell: ExcelJS.Cell) {
  const value = cellNumber(cell);
  return value === null ? null : Math.round(value);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
