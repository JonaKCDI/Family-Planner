import ExcelJS from "exceljs";

export type FuelFormatRow = {
  id?: string;
  date: Date;
  odometerKm: number;
  litersMilli: number;
  costCents: number;
  note: string;
};

export type FuelExportRow = FuelFormatRow & {
  id: string;
};

const dataSheetName = "Daten";
const legacySheetName = "Tabelle1";
const dataHeaders = ["id", "datum", "kilometerstand", "liter", "kostenEuro", "bemerkung"];
const dataHeaderScanLimit = 20;

export async function parseFuelWorkbook(buffer: ArrayBuffer, fileName = "Verbrauch.xlsx"): Promise<FuelFormatRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const dataSheet = workbook.getWorksheet(dataSheetName);
  if (dataSheet) return parseDataSheet(dataSheet);
  return parseLegacySheet(workbook.getWorksheet(legacySheetName) ?? workbook.worksheets[0], fileName);
}

export async function buildFuelWorkbook(entries: FuelExportRow[], carName: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Family App";
  workbook.created = new Date();
  const ordered = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime() || a.odometerKm - b.odometerKm);

  const dataSheet = workbook.addWorksheet(dataSheetName);
  dataSheet.columns = [
    { key: "id", width: 28 },
    { key: "date", width: 13 },
    { key: "odometerKm", width: 16 },
    { key: "liters", width: 12 },
    { key: "costEuro", width: 12 },
    { key: "note", width: 32 }
  ];
  dataSheet.addRow(dataHeaders);
  for (const entry of ordered) {
    dataSheet.addRow([
      entry.id,
      toIsoDate(entry.date),
      entry.odometerKm,
      entry.litersMilli / 1000,
      entry.costCents / 100,
      entry.note
    ]);
    const addedRow = dataSheet.lastRow;
    if (addedRow) {
      addedRow.getCell(4).numFmt = "#,##0.000";
      addedRow.getCell(5).numFmt = '#,##0.00 "€"';
    }
  }
  dataSheet.getRow(1).font = { bold: true };
  dataSheet.views = [{ state: "frozen", ySplit: 1 }];

  const worksheet = workbook.addWorksheet(legacySheetName);
  worksheet.columns = [
    { key: "date", width: 13 },
    { key: "odometer", width: 12 },
    { key: "driven", width: 14 },
    { key: "liters", width: 12 },
    { key: "cost", width: 12 },
    { key: "consumption", width: 12 },
    { key: "price", width: 12 },
    { key: "note", width: 28 },
    { key: "metric", width: 26 },
    { key: "metricValue", width: 14 }
  ];
  worksheet.getCell("H2").value = `Verbrauch ${carName}`;
  worksheet.getCell("H2").alignment = { horizontal: "center" };
  worksheet.getRow(5).values = ["Datum", "km", "gefahrene km", "l", "€", "l/100km", "€/l", "Bemerkungen", "Insgesamte Spritkosten:", { formula: "SUM(E:E)" }];
  worksheet.getCell("J5").numFmt = '#,##0.00 "€"';
  worksheet.getCell("I6").value = "Insgesamt verbr. Liter";
  worksheet.getCell("J6").value = { formula: "SUM(D:D)" };
  worksheet.getRow(5).font = { bold: true };

  ordered.forEach((entry, index) => {
    const rowNumber = 6 + index;
    worksheet.getCell(rowNumber, 1).value = entry.date;
    worksheet.getCell(rowNumber, 2).value = entry.odometerKm;
    worksheet.getCell(rowNumber, 4).value = entry.litersMilli / 1000;
    worksheet.getCell(rowNumber, 5).value = entry.costCents / 100;
    worksheet.getCell(rowNumber, 7).value = { formula: `E${rowNumber}/D${rowNumber}` };
    worksheet.getCell(rowNumber, 8).value = entry.note || undefined;
    if (index > 0) {
      worksheet.getCell(rowNumber, 3).value = { formula: `B${rowNumber}-B${rowNumber - 1}` };
      worksheet.getCell(rowNumber, 6).value = { formula: `D${rowNumber}/C${rowNumber}*100` };
    }
    worksheet.getCell(rowNumber, 1).numFmt = "dd.mm.yyyy";
    worksheet.getCell(rowNumber, 5).numFmt = '#,##0.00 "€"';
    worksheet.getCell(rowNumber, 6).numFmt = "0.00";
    worksheet.getCell(rowNumber, 7).numFmt = '#,##0.00 "€"';
  });
  worksheet.views = [{ state: "frozen", ySplit: 5 }];

  return workbook.xlsx.writeBuffer();
}

export function inferCarNameFromFuelFileName(fileName: string) {
  const baseName = fileName
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/\.[^.]+$/, "") ?? "Auto";
  const cleaned = baseName
    .replace(/^Verbrauch[_\s-]*/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+-\s+/g, " - ")
    .trim();
  return cleaned || "Auto";
}

function parseDataSheet(worksheet: ExcelJS.Worksheet) {
  const header = findDataHeader(worksheet);
  const missing = ["date", "odometerKm"].filter((field) => header.indexes[field as keyof typeof header.indexes] < 0);
  if (header.indexes.litersMilli < 0 && header.indexes.liters < 0) missing.push("liter");
  if (header.indexes.costCents < 0 && header.indexes.costEuro < 0) missing.push("kostenEuro");
  if (missing.length > 0) {
    throw new Error(`Excel-Datenblatt braucht die Spalten: ${missing.join(", ")}.`);
  }

  const rows: FuelFormatRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= header.rowNumber) return;
    const date = cellDate(row.getCell(header.indexes.date + 1));
    const odometerKm = cellInteger(row.getCell(header.indexes.odometerKm + 1));
    const litersMilli = header.indexes.litersMilli >= 0
      ? cellInteger(row.getCell(header.indexes.litersMilli + 1))
      : milliFromDecimalCell(row.getCell(header.indexes.liters + 1));
    const costCents = header.indexes.costCents >= 0
      ? cellInteger(row.getCell(header.indexes.costCents + 1))
      : centsFromDecimalCell(row.getCell(header.indexes.costEuro + 1));
    if (!date || odometerKm === null || litersMilli === null || costCents === null) return;
    rows.push({
      id: header.indexes.id >= 0 ? cellText(row.getCell(header.indexes.id + 1)) || undefined : undefined,
      date,
      odometerKm,
      litersMilli,
      costCents,
      note: header.indexes.note >= 0 ? cellText(row.getCell(header.indexes.note + 1)) : ""
    });
  });
  return rows;
}

function parseLegacySheet(worksheet: ExcelJS.Worksheet | undefined, fileName: string) {
  if (!worksheet) throw new Error(`In ${fileName} wurde kein lesbares Tabellenblatt gefunden.`);
  const rows: FuelFormatRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < 6) return;
    const date = cellDate(row.getCell(1));
    const odometerKm = cellInteger(row.getCell(2));
    const liters = cellNumber(row.getCell(4));
    const cost = cellNumber(row.getCell(5));
    if (!date || odometerKm === null || liters === null || cost === null) return;
    rows.push({
      date,
      odometerKm,
      litersMilli: Math.round(liters * 1000),
      costCents: Math.round(cost * 100),
      note: cellText(row.getCell(8))
    });
  });
  return rows;
}

function findDataHeader(worksheet: ExcelJS.Worksheet) {
  const maxRow = Math.min(worksheet.rowCount, dataHeaderScanLimit);
  let bestMatch = {
    rowNumber: 1,
    indexes: dataColumnIndexes(rowHeaderNames(worksheet.getRow(1))),
    matchCount: 0
  };

  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber += 1) {
    const indexes = dataColumnIndexes(rowHeaderNames(worksheet.getRow(rowNumber)));
    const matchCount = [
      indexes.date >= 0,
      indexes.odometerKm >= 0,
      indexes.litersMilli >= 0 || indexes.liters >= 0,
      indexes.costCents >= 0 || indexes.costEuro >= 0
    ].filter(Boolean).length;
    if (matchCount > bestMatch.matchCount) bestMatch = { rowNumber, indexes, matchCount };
    if (matchCount === 4) return { rowNumber, indexes };
  }
  return { rowNumber: bestMatch.rowNumber, indexes: bestMatch.indexes };
}

function rowHeaderNames(row: ExcelJS.Row) {
  return Array.from({ length: row.cellCount }, (_, index) => normalizeHeader(cellText(row.getCell(index + 1))));
}

function dataColumnIndexes(header: string[]) {
  return {
    id: findColumn(header, ["id", "eintragsid", "fuelentryid", "fuel_entry_id"]),
    date: findColumn(header, ["datum", "date"]),
    odometerKm: findColumn(header, ["kilometerstand", "odometer", "odometerkm", "km"]),
    liters: findColumn(header, ["liter", "liters", "l"]),
    litersMilli: findColumn(header, ["litermilli", "litersmilli", "liter_milli", "liters_milli"]),
    costEuro: findColumn(header, ["kosteneuro", "costeuro", "kosten", "cost", "euro", "eur", "€"]),
    costCents: findColumn(header, ["kostencents", "costcents", "kosten_cents", "cost_cents"]),
    note: findColumn(header, ["bemerkung", "bemerkungen", "notiz", "note", "notes"])
  };
}

function findColumn(header: string[], names: string[]) {
  return header.findIndex((field) => names.includes(field.replace(/[\s-]/g, "")));
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^"|"$/g, "")
    .toLowerCase();
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
  if (typeof value === "object" && value && "result" in value && value.result instanceof Date) return value.result;
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

function milliFromDecimalCell(cell: ExcelJS.Cell) {
  const value = cellNumber(cell);
  return value === null ? null : Math.round(value * 1000);
}

function centsFromDecimalCell(cell: ExcelJS.Cell) {
  const value = cellNumber(cell);
  return value === null ? null : Math.round(value * 100);
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
