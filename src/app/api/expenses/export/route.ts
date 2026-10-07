import { enrichPersonalExport } from "@/lib/family-finance-backup";
import { getFamilyFinance } from "@/lib/family-finance";
import { filterFamilyExpenses } from "@/lib/family-finance-filters";
import { buildFamilyFinanceWorkbook } from "@/lib/family-finance-workbook";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildExpenseWorkbook } from "@/lib/expense-formats";
import { attachmentDisposition } from "@/lib/file-names";

export async function GET(request: Request) {
  const session = await requireSession();
  const query = new URL(request.url).searchParams;
  if (query.get("bereich") === "familie") {
    const { expenses } = await getFamilyFinance();
    const rows = filterFamilyExpenses(expenses, Object.fromEntries(query));
    return new NextResponse(await buildFamilyFinanceWorkbook(rows), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": attachmentDisposition(`Familienauswertung-${query.get("year") || query.get("month") || new Date().getFullYear()}.xlsx`) } });
  }
  const year = exportYearFromValue(new URL(request.url).searchParams.get("year"));
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

  const rows = expenses.map((expense) => ({
    sharedWithFamily: expense.sharedWithFamily,
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
  }));

  return new NextResponse(await buildExpenseWorkbook(await enrichPersonalExport(rows, session.family.id, session.user.id), year), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": attachmentDisposition(`Ausgaben_${year}-${session.user.name}.xlsx`)
    }
  });
}

function exportYearFromValue(value: string | null) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : new Date().getFullYear();
}
