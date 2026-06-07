export type FuelEntryForStats = {
  id: string;
  date: Date | string;
  odometerKm: number;
  litersMilli: number;
  costCents: number;
  note: string;
};

export type FuelEntryWithDerived = FuelEntryForStats & {
  drivenKm: number | null;
  litersPer100Km: number | null;
  pricePerLiterCents: number | null;
};

export type FuelStats = {
  totalCostCents: number;
  totalLitersMilli: number;
  drivenKm: number;
  averageLitersPer100Km: number | null;
  averagePricePerLiterCents: number | null;
  lastOdometerKm: number | null;
};

export function addFuelDerivedFields(entries: FuelEntryForStats[]): FuelEntryWithDerived[] {
  const ascending = [...entries].sort(compareFuelEntriesAscending);
  const previousById = new Map<string, FuelEntryForStats | null>();
  let previous: FuelEntryForStats | null = null;
  for (const entry of ascending) {
    previousById.set(entry.id, previous);
    previous = entry;
  }

  return entries.map((entry) => {
    const previousEntry = previousById.get(entry.id) ?? null;
    const drivenKm = previousEntry ? entry.odometerKm - previousEntry.odometerKm : null;
    return {
      ...entry,
      drivenKm,
      litersPer100Km: drivenKm && drivenKm > 0 ? (entry.litersMilli / 1000 / drivenKm) * 100 : null,
      pricePerLiterCents: entry.litersMilli > 0 ? (entry.costCents * 1000) / entry.litersMilli : null
    };
  });
}

export function calculateFuelStats(entries: FuelEntryForStats[]): FuelStats {
  const derived = addFuelDerivedFields(entries);
  return calculateFuelStatsFromDerived(derived);
}

export function calculateFuelStatsFromDerived(entries: FuelEntryWithDerived[]): FuelStats {
  const totalCostCents = entries.reduce((sum, entry) => sum + entry.costCents, 0);
  const totalLitersMilli = entries.reduce((sum, entry) => sum + entry.litersMilli, 0);
  const drivenKm = entries.reduce((sum, entry) => sum + Math.max(0, entry.drivenKm ?? 0), 0);
  const ordered = [...entries].sort(compareFuelEntriesAscending);

  return {
    totalCostCents,
    totalLitersMilli,
    drivenKm,
    averageLitersPer100Km: drivenKm > 0 ? (totalLitersMilli / 1000 / drivenKm) * 100 : null,
    averagePricePerLiterCents: totalLitersMilli > 0 ? (totalCostCents * 1000) / totalLitersMilli : null,
    lastOdometerKm: ordered.at(-1)?.odometerKm ?? null
  };
}

export function compareFuelEntriesAscending(a: Pick<FuelEntryForStats, "date" | "odometerKm">, b: Pick<FuelEntryForStats, "date" | "odometerKm">) {
  const dateDelta = new Date(a.date).getTime() - new Date(b.date).getTime();
  return dateDelta || a.odometerKm - b.odometerKm;
}

export function formatLiters(litersMilli: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3
  }).format(litersMilli / 1000);
}

export function formatDecimal(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

export function formatKilometers(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value);
}

export function formatLitersInput(litersMilli: number) {
  return (litersMilli / 1000).toFixed(3).replace(".", ",").replace(/,?0+$/, "");
}

export function formatEuroInputFromCents(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}
