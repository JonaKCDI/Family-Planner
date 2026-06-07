import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { attachmentDisposition } from "@/lib/file-names";
import { buildFuelWorkbook } from "@/lib/mileage-formats";

export async function GET(request: Request) {
  const session = await requireSession();
  const searchParams = new URL(request.url).searchParams;
  const carId = searchParams.get("carId") ?? searchParams.get("car");
  if (!carId) return new NextResponse("Auto fehlt.", { status: 400 });

  const car = await db.car.findFirst({
    where: {
      id: carId,
      familyId: session.family.id
    }
  });
  if (!car) return new NextResponse("Auto nicht gefunden.", { status: 404 });

  const entries = await db.fuelEntry.findMany({
    where: {
      familyId: session.family.id,
      carId: car.id
    },
    orderBy: [{ date: "asc" }, { odometerKm: "asc" }]
  });

  const rows = entries.map((entry) => ({
    id: entry.id,
    date: entry.date,
    odometerKm: entry.odometerKm,
    litersMilli: entry.litersMilli,
    costCents: entry.costCents,
    note: entry.note
  }));

  return new NextResponse(await buildFuelWorkbook(rows, car.name), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": attachmentDisposition(`Verbrauch-${car.name}.xlsx`)
    }
  });
}
