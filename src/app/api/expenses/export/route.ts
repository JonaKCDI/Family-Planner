import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildExpenseWorkbook, stringifyExpenseCsv } from "@/lib/expense-formats";

export async function GET(request: Request) {
  const session = await requireSession();
  const format = new URL(request.url).searchParams.get("format");
  const expenses = await db.expense.findMany({
    where: {
      familyId: session.family.id,
      ownerUserId: session.user.id
    },
    include: { category: true, label: true },
    orderBy: { date: "desc" }
  });

  const rows = expenses.map((expense) => ({
    id: expense.id,
    kind: expense.kind,
    amountCents: expense.amountCents,
    currency: expense.currency,
    date: expense.date,
    paymentMethod: expense.paymentMethod,
    categoryName: expense.category?.name ?? "",
    labelName: expense.label?.name ?? "",
    description: expense.description
  }));

  if (format === "xlsx") {
    const year = Number(new URL(request.url).searchParams.get("year")) || new Date().getFullYear();
    return new NextResponse(await buildExpenseWorkbook(rows, year), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Ausgaben_${year}-${session.user.name}.xlsx"`
      }
    });
  }

  return new NextResponse(stringifyExpenseCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expenses-${session.user.name}.csv"`
    }
  });
}
