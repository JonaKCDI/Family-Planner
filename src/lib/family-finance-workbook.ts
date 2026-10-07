import ExcelJS from "exceljs";
import type { FamilyFinanceExpense } from "./family-finance";

export async function buildFamilyFinanceWorkbook(rows: FamilyFinanceExpense[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Family App";
  const marker = workbook.addWorksheet("Familienauswertung");
  marker.addRow(["family-finance-report-v1", "Auswertung – kein persönliches Importformat"]);
  const sheet = workbook.addWorksheet("Gemeinsame Ausgaben");
  sheet.columns = [
    {header:"Datum",key:"date",width:14}, {header:"Bezahlt von",key:"person",width:22},
    {header:"Betrag",key:"amount",width:16}, {header:"Währung",key:"currency",width:12},
    {header:"Beschreibung",key:"description",width:40}, {header:"Laden",key:"store",width:22},
    {header:"Zahlungsart",key:"payment",width:22}, {header:"Familienkategorie",key:"category",width:24},
    {header:"Familienlabel",key:"label",width:24}
  ];
  for (const row of rows) sheet.addRow({date:row.date.toISOString().slice(0,10),person:row.person.name,amount:row.amountCents/100,currency:row.currency,description:row.description,store:row.store,payment:row.paymentMethod,category:row.category?.name??"Nicht zugeordnet",label:row.label?.name??""});
  sheet.getColumn("amount").numFmt = "#,##0.00";
  sheet.views = [{state:"frozen",ySplit:1}];
  sheet.getRow(1).font = {bold:true};
  sheet.autoFilter = "A1:I1";
  return workbook.xlsx.writeBuffer();
}
