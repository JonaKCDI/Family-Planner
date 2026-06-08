import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildExpenseWorkbook } from "@/lib/expense-formats";
import { attachmentDisposition } from "@/lib/file-names";

export async function GET(request: Request) {
  const session = await requireSession();
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

  return new NextResponse(await buildExpenseWorkbook(rows, year), {
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
