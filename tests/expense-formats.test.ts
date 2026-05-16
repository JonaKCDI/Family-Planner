import { describe, expect, test } from "vitest";
import ExcelJS from "exceljs";
import { buildExpenseWorkbook, parseExpenseWorkbook } from "../src/lib/expense-formats";
import { parseEuroToCents } from "../src/lib/format";
import { buildCategoryRows, buildLabelRows, buildPeriodRows, sumByKind } from "../src/lib/expense-analytics";

describe("money parsing", () => {
  test("parses German euro input into cents", () => {
    expect(parseEuroToCents("1.234,56")).toBe(123456);
    expect(parseEuroToCents("42,50")).toBe(4250);
    expect(parseEuroToCents("-3,70")).toBe(-370);
  });
});

describe("expense analytics", () => {
  const categories = [
    { name: "Nahrung", color: "#1c8c55", monthlyBudgetCents: 50000 },
    { name: "Urlaub", color: "#2e6fea", monthlyBudgetCents: 100000 }
  ];
  const labels = [{ name: "Lappland", color: "#16776f", budgetCents: 70000 }];
  const entries = [
    { kind: "INCOME" as const, amountCents: 110000, date: new Date(2026, 1, 1), category: categories[0], label: null },
    { kind: "EXPENSE" as const, amountCents: 2371, date: new Date(2026, 1, 1), category: categories[0], label: labels[0] },
    { kind: "EXPENSE" as const, amountCents: 3209, date: new Date(2026, 1, 2), category: categories[1], label: labels[0] }
  ];

  test("calculates totals and saldo without sign mistakes", () => {
    expect(sumByKind(entries, "INCOME")).toBe(110000);
    expect(sumByKind(entries, "EXPENSE")).toBe(5580);
    expect(buildPeriodRows(entries, categories, "month")[0]).toMatchObject({ income: 110000, spending: 5580, saldo: 104420 });
  });

  test("builds category and label budget rows", () => {
    expect(buildCategoryRows(entries, categories, 5580, true).map((row) => [row.name, row.amount])).toEqual([["Urlaub", 3209], ["Nahrung", 2371]]);
    expect(buildLabelRows(entries, labels)[0]).toMatchObject({ name: "Lappland", amount: 5580, remaining: 64420 });
  });
});

describe("Excel workbook format", () => {
  test("imports signed workbook rows and normalizes to workbook year and sheet month", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Februar");
    worksheet.getCell("B3").value = "Label";
    worksheet.getCell("C3").value = "Datum";
    worksheet.getCell("D3").value = "Zweck";
    worksheet.getCell("E3").value = "Bezeichnung";
    worksheet.getCell("F3").value = "Laden";
    worksheet.getCell("G3").value = "Betrag";
    worksheet.getCell("H3").value = "Zahlungsart";
    worksheet.getCell("B4").value = "Lappland";
    worksheet.getCell("C4").value = new Date(2021, 0, 1);
    worksheet.getCell("D4").value = "Urlaub";
    worksheet.getCell("E4").value = "Nahrung";
    worksheet.getCell("F4").value = "Lidl";
    worksheet.getCell("G4").value = -23.71;
    worksheet.getCell("H4").value = "Kreditkarte";
    worksheet.getCell("C5").value = new Date(2025, 0, 1);
    worksheet.getCell("D5").value = "Gehalt";
    worksheet.getCell("G5").value = 1111;

    const rows = await parseExpenseWorkbook(await workbook.xlsx.writeBuffer(), "Ausgaben_2026.xlsx");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      kind: "EXPENSE",
      amountCents: 2371,
      categoryName: "Urlaub",
      labelName: "Lappland",
      paymentMethod: "Kreditkarte",
      store: "Lidl",
      description: "Nahrung"
    });
    expect(rows[0].date.toISOString().slice(0, 10)).toBe("2026-02-01");
    expect(rows[1]).toMatchObject({ kind: "INCOME", amountCents: 111100, paymentMethod: "Nicht angegeben" });
  });

  test("exports a matching month-sheet workbook", async () => {
    const buffer = await buildExpenseWorkbook([{
      id: "exp_1",
      kind: "EXPENSE",
      amountCents: 600,
      currency: "EUR",
      date: new Date(2026, 1, 2),
      paymentMethod: "Karte",
      store: "Aral",
      categoryName: "Urlaub",
      labelName: "Lappland",
      description: "Tanken"
    }], 2026);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet("Februar");
    expect(worksheet?.getCell("B3").value).toBe("Label");
    expect(worksheet?.getCell("D4").value).toBe("Urlaub");
    expect(worksheet?.getCell("F4").value).toBe("Aral");
    expect(worksheet?.getCell("G4").value).toBe(-6);
    expect(workbook.getWorksheet("gesamt")).toBeTruthy();
  });

  test("round-trips the canonical Excel data sheet with contract links", async () => {
    const buffer = await buildExpenseWorkbook([{
      id: "exp_2",
      kind: "EXPENSE",
      amountCents: 1299,
      currency: "EUR",
      date: new Date("2026-05-12T00:00:00.000Z"),
      paymentMethod: "Lastschrift",
      store: "Stadtwerke Portal",
      categoryName: "Wohnen",
      labelName: "",
      contractId: "contract_1",
      contractProvider: "Stadtwerke",
      contractType: "Strom",
      description: "Abschlag"
    }], 2026);

    expect((await parseExpenseWorkbook(buffer, "Ausgaben-Jona.xlsx"))[0]).toMatchObject({
      id: "exp_2",
      kind: "EXPENSE",
      amountCents: 1299,
      categoryName: "Wohnen",
      store: "Stadtwerke Portal",
      contractId: "contract_1",
      contractProvider: "Stadtwerke",
      contractType: "Strom",
      description: "Abschlag"
    });
  });

  test("imports Daten sheet when the table starts lower and further right", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Daten");
    worksheet.getCell("B2").value = "Meine alte Ausgabenliste";
    [
      "beschreibung",
      "laden",
      "label",
      "datum",
      "kategorie",
      "betragCents",
      "art",
      "waehrung",
      "zahlungsart"
    ].forEach((header, index) => {
      worksheet.getCell(6, 4 + index).value = header;
    });
    [
      "Tankstelle",
      "Shell",
      "Auto",
      "2026-04-12",
      "Mobilität",
      4250,
      "EXPENSE",
      "EUR",
      "Karte"
    ].forEach((value, index) => {
      worksheet.getCell(7, 4 + index).value = value;
    });

    const rows = await parseExpenseWorkbook(await workbook.xlsx.writeBuffer(), "Ausgaben_2026.xlsx");

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "EXPENSE",
      amountCents: 4250,
      currency: "EUR",
      categoryName: "Mobilität",
      labelName: "Auto",
      paymentMethod: "Karte",
      store: "Shell",
      description: "Tankstelle"
    });
    expect(rows[0].date.toISOString().slice(0, 10)).toBe("2026-04-12");
  });
});
