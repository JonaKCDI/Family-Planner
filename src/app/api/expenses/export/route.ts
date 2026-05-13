import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await requireSession();
  const expenses = await db.expense.findMany({
    where: {
      familyId: session.family.id,
      ownerUserId: session.user.id
    },
    include: { category: true, label: true },
    orderBy: { date: "desc" }
  });
  const rows = [
    ["id", "kind", "amountCents", "currency", "date", "paymentMethod", "category", "label", "description"],
    ...expenses.map((expense) => [
      expense.id,
      expense.kind,
      String(expense.amountCents),
      expense.currency,
      expense.date.toISOString().slice(0, 10),
      expense.paymentMethod,
      expense.category?.name ?? "",
      expense.label?.name ?? "",
      expense.description
    ])
  ];

  return new NextResponse(stringifyCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expenses-${session.user.name}.csv"`
    }
  });
}

function stringifyCsv(rows: string[][]) {
  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, "\"\"")}"`).join(","))
    .join("\n");
}
