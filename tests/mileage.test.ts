import { describe, expect, test } from "vitest";
import ExcelJS from "exceljs";
import { buildFuelWorkbook, inferCarNameFromFuelFileName, parseFuelWorkbook } from "../src/lib/mileage-formats";
import { addFuelDerivedFields, calculateFuelStats, calculateFuelStatsFromDerived } from "../src/lib/mileage";

describe("mileage calculations", () => {
  const entries = [
    { id: "fuel_1", date: new Date("2020-10-07T00:00:00.000Z"), odometerKm: 17, litersMilli: 45340, costCents: 5300, note: "" },
    { id: "fuel_2", date: new Date("2020-10-10T00:00:00.000Z"), odometerKm: 595, litersMilli: 32260, costCents: 3900, note: "Papa hat gezahlt" },
    { id: "fuel_3", date: new Date("2020-11-02T00:00:00.000Z"), odometerKm: 913, litersMilli: 21260, costCents: 2400, note: "" }
  ];

  test("derives driven kilometers and consumption like the workbook", () => {
    const rows = addFuelDerivedFields(entries);
    expect(rows[0]).toMatchObject({ drivenKm: null, litersPer100Km: null });
    expect(rows[1].drivenKm).toBe(578);
    expect(rows[1].litersPer100Km).toBeCloseTo(5.5813148789);
    expect(rows[1].pricePerLiterCents).toBeCloseTo(120.8927464352);
    expect(rows[2].drivenKm).toBe(318);
    expect(rows[2].litersPer100Km).toBeCloseTo(6.6855345912);
  });

  test("calculates totals and averages from derived rows", () => {
    const stats = calculateFuelStats(entries);
    expect(stats).toMatchObject({
      totalCostCents: 11600,
      totalLitersMilli: 98860,
      drivenKm: 896,
      lastOdometerKm: 913
    });
    expect(stats.averageLitersPer100Km).toBeCloseTo(11.0334821429);
    expect(stats.averagePricePerLiterCents).toBeCloseTo(117.3376492);
  });

  test("keeps derived distance when stats are filtered to a later period", () => {
    const history = [
      { id: "fuel_dec", date: new Date("2025-12-22T00:00:00.000Z"), odometerKm: 48618, litersMilli: 45260, costCents: 7101, note: "" },
      { id: "fuel_jan_1", date: new Date("2026-01-05T00:00:00.000Z"), odometerKm: 49260, litersMilli: 40170, costCents: 6704, note: "" },
      { id: "fuel_jan_2", date: new Date("2026-01-22T00:00:00.000Z"), odometerKm: 49810, litersMilli: 34000, costCents: 5743, note: "" }
    ];
    const januaryRows = addFuelDerivedFields(history).filter((entry) => new Date(entry.date).getFullYear() === 2026);
    const stats = calculateFuelStatsFromDerived(januaryRows);

    expect(januaryRows.map((entry) => entry.drivenKm)).toEqual([642, 550]);
    expect(stats.drivenKm).toBe(1192);
    expect(stats.averageLitersPer100Km).toBeCloseTo(6.2223154362);
  });
});

describe("mileage Excel workbook format", () => {
  test("imports the legacy Tabelle1 format and ignores blank formula rows", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Tabelle1");
    worksheet.getCell("A5").value = "Datum";
    worksheet.getCell("B5").value = "km";
    worksheet.getCell("C5").value = "gefahrene km";
    worksheet.getCell("D5").value = "l";
    worksheet.getCell("E5").value = "€";
    worksheet.getCell("F5").value = "l/100km";
    worksheet.getCell("G5").value = "€/l";
    worksheet.getCell("H5").value = "Bemerkungen";
    worksheet.getCell("A6").value = new Date("2020-10-07T00:00:00.000Z");
    worksheet.getCell("B6").value = 17;
    worksheet.getCell("D6").value = 45.34;
    worksheet.getCell("E6").value = 53;
    worksheet.getCell("G6").value = { formula: "E6/D6" };
    worksheet.getCell("A7").value = new Date("2020-10-10T00:00:00.000Z");
    worksheet.getCell("B7").value = 595;
    worksheet.getCell("C7").value = { formula: "B7-B6" };
    worksheet.getCell("D7").value = 32.26;
    worksheet.getCell("E7").value = 39;
    worksheet.getCell("F7").value = { formula: "D7/C7*100" };
    worksheet.getCell("G7").value = { formula: "E7/D7" };
    worksheet.getCell("H7").value = "Papa hat gezahlt";
    worksheet.getCell("C20").value = { formula: "B20-B19" };
    worksheet.getCell("F20").value = { formula: "D20/C20*100" };
    worksheet.getCell("G20").value = { formula: "E20/D20" };

    const rows = await parseFuelWorkbook(await workbook.xlsx.writeBuffer(), "Verbrauch_Seat_Leon - weiß.xlsx");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ odometerKm: 17, litersMilli: 45340, costCents: 5300, note: "" });
    expect(rows[1]).toMatchObject({ odometerKm: 595, litersMilli: 32260, costCents: 3900, note: "Papa hat gezahlt" });
  });

  test("round-trips the canonical Daten sheet and exports legacy formulas", async () => {
    const buffer = await buildFuelWorkbook([{
      id: "fuel_1",
      date: new Date("2025-12-22T00:00:00.000Z"),
      odometerKm: 48618,
      litersMilli: 45260,
      costCents: 7101,
      note: "Letzter Stand"
    }, {
      id: "fuel_2",
      date: new Date("2026-01-03T00:00:00.000Z"),
      odometerKm: 49118,
      litersMilli: 30000,
      costCents: 4800,
      note: ""
    }], "Seat Leon - weiß");

    const parsed = await parseFuelWorkbook(buffer, "Verbrauch-Seat-Leon.xlsx");
    expect(parsed[0]).toMatchObject({ id: "fuel_1", odometerKm: 48618, litersMilli: 45260, costCents: 7101 });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const dataSheet = workbook.getWorksheet("Daten");
    expect(dataSheet?.getCell("D1").value).toBe("liter");
    expect(dataSheet?.getCell("E1").value).toBe("kostenEuro");
    expect(dataSheet?.getCell("D2").value).toBe(45.26);
    expect(dataSheet?.getCell("E2").value).toBe(71.01);
    const sheet = workbook.getWorksheet("Tabelle1");
    expect(sheet?.getCell("J5").value).toMatchObject({ formula: "SUM(E:E)" });
    expect(sheet?.getCell("J6").value).toMatchObject({ formula: "SUM(D:D)" });
    expect(sheet?.getCell("C7").value).toMatchObject({ formula: "B7-B6" });
    expect(sheet?.getCell("F7").value).toMatchObject({ formula: "D7/C7*100" });
    expect(sheet?.getCell("G7").value).toMatchObject({ formula: "E7/D7" });
  });

  test("infers car names from legacy filenames", () => {
    expect(inferCarNameFromFuelFileName("Verbrauch_Seat_Leon - weiß.xlsx")).toBe("Seat Leon - weiß");
  });
});
