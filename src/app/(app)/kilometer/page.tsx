import {
  archiveCar,
  createCar,
  deleteFuelEntry,
  exportFuelToSynologyExcel,
  importFuelFromSynologyExcel,
  importFuelFromUploadedXlsx,
  unarchiveCar,
  updateCar,
  updateFuelEntry
} from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import {
  addFuelDerivedFields,
  calculateFuelStats,
  calculateFuelStatsFromDerived,
  formatDecimal,
  formatEuroInputFromCents,
  formatKilometers,
  formatLiters,
  formatLitersInput
} from "@/lib/mileage";
import { buildMonthSelectOptions, formatMonthKeyLabel, splitMonthKey } from "@/lib/month-options";
import { isFamilyAdmin } from "@/lib/permissions";
import { getFuelEntriesForCar, getVisibleCars } from "@/lib/queries";
import { ActionModal } from "@/components/action-modal";
import { EmptyState, PageHeader } from "@/components/ui";

type MileagePageParams = {
  car?: string | null;
  month?: string | null;
  year?: string | null;
  from?: string | null;
  to?: string | null;
  q?: string | null;
};

type MileagePageProps = {
  searchParams: Promise<MileagePageParams>;
};

export default async function MileagePage({ searchParams }: MileagePageProps) {
  const session = await requireSession();
  const params = cleanMileageParams(await searchParams);
  const isAdmin = isFamilyAdmin(session.role);
  const [activeCars, allCars] = await Promise.all([
    getVisibleCars(session.family.id),
    getVisibleCars(session.family.id, { includeArchived: true })
  ]);
  const selectedCar = activeCars.find((car) => car.id === params.car) ?? activeCars[0] ?? null;
  const entries = selectedCar ? await getFuelEntriesForCar(session.family.id, selectedCar.id) : [];
  const derivedEntries = addFuelDerivedFields(entries);
  const query = normalizeSearch(params.q);
  const currentMonthKey = getMonthKey();
  const years = [...new Set([new Date().getFullYear(), ...entries.map((entry) => new Date(entry.date).getFullYear())])].sort((a, b) => b - a);
  const range = getRange(params, currentMonthKey);
  const selectedMonth = range.mode === "month" ? splitMonthKey(range.key) : null;
  const currentMonth = splitMonthKey(currentMonthKey);
  const monthOptions = buildMonthSelectOptions();
  const filterYear = String(selectedMonth?.year ?? params.year ?? currentMonth?.year ?? years[0] ?? new Date().getFullYear());
  const selectedEntries = derivedEntries
    .filter((entry) => isInRange(entry.date, range.from, range.to))
    .filter((entry) => !query || normalizeSearch(entry.note).includes(query) || String(entry.odometerKm).includes(query));
  const stats = calculateFuelStatsFromDerived(selectedEntries);
  const allTimeStats = calculateFuelStats(entries);
  const monthlyRows = buildMonthlyRows(derivedEntries);
  const returnTo = getMileageHref(params, {});
  const activeFilterChips = buildMileageActiveFilterChips(params, range);

  return (
    <>
      <PageHeader title="Kilometer" description="Tankstopps, Verbrauch und Kilometerstände pro Auto." />

      <section className="filter-system" aria-label="Kilometerfilter">
        <div className="period-tabs car-tabs" role="list" aria-label="Autos">
          {activeCars.map((car) => (
            <a role="listitem" className={selectedCar?.id === car.id ? "active" : ""} href={getMileageHref(params, { car: car.id })} key={car.id}>
              {car.name}
            </a>
          ))}
        </div>
        {selectedCar ? (
          <>
            <div className="period-tabs" role="list" aria-label="Zeitraum">
              <a role="listitem" className={range.mode === "month" && range.key === currentMonthKey ? "active" : ""} href={getMileageHref(params, { month: currentMonthKey, year: undefined, from: undefined, to: undefined })}>Aktueller Monat</a>
              {years.map((year) => <a role="listitem" className={range.mode === "year" && params.year === String(year) ? "active" : ""} href={getMileageHref(params, { year: String(year), month: undefined, from: undefined, to: undefined })} key={year}>{year}</a>)}
            </div>
            {activeFilterChips.length > 0 ? (
              <div className="active-filter-row" aria-label="Aktive Filter">
                {activeFilterChips.map((chip) => (
                  <a className="filter-chip" href={getMileageHref(params, chip.clear)} key={chip.label}>
                    <span>{chip.label}</span>
                    <strong aria-hidden="true">×</strong>
                  </a>
                ))}
                <a className="filter-chip clear-all" href={getMileageHref(params, { q: undefined, from: undefined, to: undefined, month: undefined, year: undefined })}>Alle löschen</a>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="overview-actions">
        {selectedCar ? (
          <ActionModal title="Kilometer filtern" trigger="Filter">
            <form action="/kilometer" className="form form-grid expense-filter-form" method="get">
              <MileageHiddenFields params={params} includeCar />
              <fieldset className="fieldset full-span compact-fieldset period-picker-fieldset">
                <legend>Monat/Jahr</legend>
                <div className="period-select-row">
                  <label>
                    Monat
                    <select name="month" defaultValue={selectedMonth?.month ?? ""}>
                      <option value="">Kein Monatsfilter</option>
                      {monthOptions.map((month) => <option value={month.value} key={month.value}>{month.label}</option>)}
                    </select>
                  </label>
                  <label>
                    Jahr
                    <select name="year" defaultValue={filterYear}>
                      {years.map((year) => <option value={year} key={year}>{year}</option>)}
                    </select>
                  </label>
                </div>
              </fieldset>
              <fieldset className="fieldset full-span compact-fieldset">
                <legend>Zeitraum optional eingrenzen</legend>
                <div className="form-grid">
                  <label>Von<input name="from" type="date" defaultValue={params.from ?? ""} /></label>
                  <label>Bis<input name="to" type="date" defaultValue={params.to ?? ""} /></label>
                </div>
              </fieldset>
              <label className="full-span">Suche<input name="q" type="search" defaultValue={params.q ?? ""} placeholder="Bemerkung oder Kilometerstand ..." /></label>
              <div className="filter-actions full-span">
                <button className="button" type="submit">Anwenden</button>
                <a className="button secondary" href={getMileageHref(params, { q: undefined, from: undefined, to: undefined })}>Filter löschen</a>
              </div>
            </form>
          </ActionModal>
        ) : null}

        <ActionModal title="Kilometer-Setup" trigger="Setup" wide>
          <div className="expense-setup-layout">
            {selectedCar ? (
              <section className="setup-card setup-card-primary">
                <div className="setup-card-head">
                  <div>
                    <h2 className="section-title">Excel-Sicherung</h2>
                    <p className="muted">Export und Import über die komplette Historie.</p>
                  </div>
                </div>
                <form action={importFuelFromUploadedXlsx} className="excel-actions">
                  <label className="excel-car-picker">
                    <span>Auto</span>
                    <select name="carId" defaultValue={selectedCar.id}>
                      {activeCars.map((car) => <option value={car.id} key={car.id}>{car.name}</option>)}
                      {isAdmin ? <option value="">Neues Auto aus Dateiname</option> : null}
                    </select>
                  </label>
                  <div className="setup-action-row">
                    <div className="mileage-excel-form">
                      <strong>Excel herunterladen</strong>
                      <button className="button secondary" formAction="/api/mileage/export" formMethod="get" formNoValidate type="submit">
                        Excel herunterladen
                      </button>
                    </div>
                    <div className="upload-form">
                      <strong>Excel hochladen</strong>
                      <input name="xlsxFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
                      <button className="button secondary" type="submit">Excel hochladen</button>
                    </div>
                    <div className="mileage-excel-form">
                      <strong>Synology importieren</strong>
                      <button className="button secondary" formAction={importFuelFromSynologyExcel} formNoValidate type="submit">
                        Synology importieren
                      </button>
                    </div>
                    <div className="mileage-excel-form">
                      <strong>Synology exportieren</strong>
                      <button className="button secondary" formAction={exportFuelToSynologyExcel} formNoValidate type="submit">
                        Synology exportieren
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            ) : null}

            {isAdmin ? (
              <details className="setup-card car-setup-card" open>
                <summary>
                  <span>
                    <strong>Autos verwalten</strong>
                    <small>Aktive Autos stehen im Kilometer-Tab und im Plus-Menü bereit</small>
                  </span>
                </summary>
                <div className="setup-two-column car-setup-grid">
                  <form action={createCar} className="form compact car-create-form">
                    <strong>Auto hinzufügen</strong>
                    <label>Name<input name="name" placeholder="Seat Leon - weiß" required /></label>
                    <label>Kennzeichen<input name="licensePlate" placeholder="Optional" /></label>
                    <label>Farbe<input name="color" type="color" defaultValue="#16776f" /></label>
                    <label>Notizen<textarea name="notes" /></label>
                    <button className="button secondary" type="submit">Auto speichern</button>
                  </form>
                  <div className="category-editor-list car-editor-list">
                    {allCars.map((car) => (
                      <details className="category-editor car-editor" key={car.id}>
                        <summary>
                          <span className="color-dot" style={{ background: car.color }} />
                          <span>{car.name}{car.archivedAt ? " (archiviert)" : ""}</span>
                          <strong>{car.licensePlate || "Ohne Kennzeichen"}</strong>
                        </summary>
                        <form action={updateCar} className="form compact">
                          <input type="hidden" name="id" value={car.id} />
                          <label>Name<input name="name" defaultValue={car.name} required /></label>
                          <label>Kennzeichen<input name="licensePlate" defaultValue={car.licensePlate} /></label>
                          <label>Farbe<input name="color" type="color" defaultValue={car.color} /></label>
                          <label>Notizen<textarea name="notes" defaultValue={car.notes} /></label>
                          <button className="button secondary" type="submit">Änderungen speichern</button>
                        </form>
                        <form action={car.archivedAt ? unarchiveCar : archiveCar} className="inline-form">
                          <input type="hidden" name="id" value={car.id} />
                          <button className="button secondary" type="submit">{car.archivedAt ? "Wieder aktivieren" : "Archivieren"}</button>
                        </form>
                      </details>
                    ))}
                  </div>
                </div>
              </details>
            ) : (
              <div className="setup-card">
                <h2 className="section-title">Autos</h2>
                <p className="muted">Nur Admins können Autos anlegen, bearbeiten oder archivieren.</p>
              </div>
            )}
          </div>
        </ActionModal>
      </section>

      {!selectedCar ? (
        <EmptyState>Noch kein aktives Auto vorhanden. Admins können im Setup ein Auto anlegen oder eine Verbrauchsdatei importieren.</EmptyState>
      ) : (
        <>
          <section className="stats">
            <div className="stat"><span>Tankkosten</span><strong>{formatMoney(stats.totalCostCents)}</strong></div>
            <div className="stat"><span>Liter</span><strong>{formatLiters(stats.totalLitersMilli)} l</strong></div>
            <div className="stat"><span>Gefahrene km</span><strong>{formatKilometers(stats.drivenKm)} km</strong></div>
            <div className="stat"><span>Ø l/100 km</span><strong>{formatDecimal(stats.averageLitersPer100Km)} l</strong><small>Ø {formatMoney(Math.round(stats.averagePricePerLiterCents ?? 0))}/l</small></div>
            <div className="stat"><span>Letzter Stand</span><strong>{formatKilometers(allTimeStats.lastOdometerKm)} km</strong><small>{selectedCar.name}</small></div>
          </section>

          <details className="panel expense-section" open>
            <summary className="expense-section-summary">
              <div>
                <h2 className="section-title">Tankstopps</h2>
                <p className="muted">{formatDate(range.from)} bis {formatDate(range.to)} · {selectedEntries.length} Einträge</p>
              </div>
            </summary>
            {selectedEntries.length === 0 ? (
              <EmptyState>Noch keine Tankstopps im gewählten Zeitraum.</EmptyState>
            ) : (
              <div className="expense-list">
                {selectedEntries.map((entry) => (
                  <details className="expense-row mileage-row" key={entry.id}>
                    <summary>
                      <span className="mileage-date">{formatDate(entry.date)}</span>
                      <span className="mileage-main">
                        <span className="mileage-odometer">{formatKilometers(entry.odometerKm)} km</span>
                        <small>{entry.note || "Ohne Bemerkung"}</small>
                      </span>
                      <span className="mileage-values" aria-label="Tankdaten">
                        <span className="mileage-value"><small>Liter</small><b>{formatLiters(entry.litersMilli)} l</b></span>
                        <span className="mileage-value"><small>Verbrauch</small><b>{formatDecimal(entry.litersPer100Km)} l/100 km</b></span>
                        <span className="mileage-value"><small>Gefahren</small><b>{entry.drivenKm === null ? "-" : `${formatKilometers(entry.drivenKm)} km`}</b></span>
                        <span className="mileage-value"><small>Preis</small><b>{formatMoney(Math.round(entry.pricePerLiterCents ?? 0))}/l</b></span>
                      </span>
                      <strong className="mileage-cost">{formatMoney(entry.costCents)}</strong>
                    </summary>
                    <div className="expense-detail">
                      <div className="mileage-detail-grid">
                        <span><small>Gefahren</small><b>{entry.drivenKm === null ? "Erster Eintrag" : `${formatKilometers(entry.drivenKm)} km`}</b></span>
                        <span><small>Verbrauch</small><b>{formatDecimal(entry.litersPer100Km)} l/100 km</b></span>
                        <span><small>Tankmenge</small><b>{formatLiters(entry.litersMilli)} l</b></span>
                        <span><small>Preis je Liter</small><b>{formatMoney(Math.round(entry.pricePerLiterCents ?? 0))}/l</b></span>
                      </div>
                      <div className="entry-actions">
                        <form action={deleteFuelEntry}>
                          <input type="hidden" name="id" value={entry.id} />
                          <input type="hidden" name="carId" value={selectedCar.id} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <button className="button secondary danger-subtle" type="submit">Löschen</button>
                        </form>
                        <ActionModal title="Tankstopp bearbeiten" trigger="Bearbeiten">
                          <form action={updateFuelEntry} className="form form-grid modal-form">
                            <input type="hidden" name="id" value={entry.id} />
                            <input type="hidden" name="carId" value={selectedCar.id} />
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <label>Datum<input name="date" type="date" defaultValue={toDateInputValue(entry.date)} required /></label>
                            <label>Kilometerstand<input name="odometerKm" type="number" inputMode="numeric" min="0" defaultValue={entry.odometerKm} required /></label>
                            <label>Liter<input name="liters" inputMode="decimal" defaultValue={formatLitersInput(entry.litersMilli)} required /></label>
                            <label>Betrag in EUR<input name="cost" inputMode="decimal" defaultValue={formatEuroInputFromCents(entry.costCents)} required /></label>
                            <label className="full-span">Bemerkung<input name="note" defaultValue={entry.note} /></label>
                            <button className="button full-span" type="submit">Änderungen speichern</button>
                          </form>
                        </ActionModal>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </details>

          <details className="panel spacing-top">
            <summary className="section-title">Analyse</summary>
            <div className="analysis-grid">
              <div>
                <h3>Monate</h3>
                {monthlyRows.length === 0 ? <EmptyState>Noch keine Daten vorhanden.</EmptyState> : (
                  <div className="mini-table">
                    <div className="mini-table-head"><span>Monat</span><span>km</span><span>Liter</span><span>Kosten</span><span>Ø</span></div>
                    {monthlyRows.map((row) => (
                      <div className="mini-table-row" key={row.label}>
                        <span>{row.label}</span>
                        <span>{formatKilometers(row.drivenKm)}</span>
                        <span>{formatLiters(row.litersMilli)} l</span>
                        <span>{formatMoney(row.costCents)}</span>
                        <strong>{formatDecimal(row.averageLitersPer100Km)} l</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </details>
        </>
      )}
    </>
  );
}

function MileageHiddenFields({ params, includeCar = false, includeSearch = false }: { params: MileagePageParams; includeCar?: boolean; includeSearch?: boolean }) {
  return (
    <>
      {includeCar && params.car ? <input type="hidden" name="car" value={params.car} /> : null}
      {includeSearch && params.q ? <input type="hidden" name="q" value={params.q} /> : null}
    </>
  );
}

function buildMonthlyRows(entries: ReturnType<typeof addFuelDerivedFields>) {
  const rows = new Map<string, { label: string; costCents: number; litersMilli: number; drivenKm: number }>();
  for (const entry of entries) {
    const date = new Date(entry.date);
    const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const row = rows.get(label) ?? { label, costCents: 0, litersMilli: 0, drivenKm: 0 };
    row.costCents += entry.costCents;
    row.litersMilli += entry.litersMilli;
    row.drivenKm += Math.max(0, entry.drivenKm ?? 0);
    rows.set(label, row);
  }
  return [...rows.values()]
    .map((row) => ({
      ...row,
      averageLitersPer100Km: row.drivenKm > 0 ? (row.litersMilli / 1000 / row.drivenKm) * 100 : null
    }))
    .sort((a, b) => b.label.localeCompare(a.label))
    .slice(0, 12);
}

function getRange(params: MileagePageParams, currentMonthKey: string) {
  const fallbackMonth = monthRange(currentMonthKey) ?? monthRange(getMonthKey())!;
  if (params.from || params.to) {
    return {
      mode: "custom" as const,
      from: params.from ? new Date(params.from) : fallbackMonth.from,
      to: params.to ? endOfDay(new Date(params.to)) : fallbackMonth.to
    };
  }
  if (params.month) {
    const range = monthRange(params.month);
    if (range) return { mode: "month" as const, key: params.month, ...range };
  }
  if (params.year) {
    const year = Number(params.year);
    if (Number.isInteger(year) && year >= 1900 && year <= 2100) {
      return { mode: "year" as const, from: new Date(year, 0, 1), to: endOfDay(new Date(year, 11, 31)) };
    }
  }
  return { mode: "month" as const, key: currentMonthKey, ...fallbackMonth };
}

function getMileageHref(params: MileagePageParams, overrides: MileagePageParams) {
  const next = cleanMileageParams({ ...params, ...overrides });
  const search = new URLSearchParams();
  for (const key of ["car", "from", "to", "year", "month", "q"] as const) {
    const value = next[key];
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/kilometer?${query}` : "/kilometer";
}

function cleanMileageParams(params: MileagePageParams) {
  const next: MileagePageParams = {};
  for (const key of ["car", "from", "to", "year", "month", "q"] as const) {
    const value = String(params[key] ?? "").trim();
    if (value) next[key] = value;
  }

  if (next.month && /^\d{2}$/.test(next.month) && next.year) {
    next.month = `${next.year}-${next.month}`;
  } else if (next.month && !/^\d{4}-\d{2}$/.test(next.month)) {
    delete next.month;
  }

  if (next.from || next.to) {
    delete next.year;
    delete next.month;
  } else if (next.month) {
    delete next.year;
  } else if (next.year) {
    delete next.month;
  }
  return next;
}

function buildMileageActiveFilterChips(params: MileagePageParams, range: ReturnType<typeof getRange>) {
  const chips: { label: string; clear: Partial<MileagePageParams> }[] = [];
  if (range.mode === "year" && params.year) {
    chips.push({ label: params.year, clear: { year: undefined } });
  }
  if (range.mode === "month" && params.month) {
    chips.push({ label: `Monat: ${formatMonthKeyLabel(params.month)}`, clear: { month: undefined } });
  }
  if (range.mode === "custom") {
    chips.push({ label: `Zeitraum: ${formatDate(range.from)} - ${formatDate(range.to)}`, clear: { from: undefined, to: undefined } });
  }
  if (params.q) {
    chips.push({ label: `Suche: ${params.q}`, clear: { q: undefined } });
  }
  return chips;
}

function monthRange(monthKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  return { from: new Date(year, month - 1, 1), to: endOfDay(new Date(year, month, 0)) };
}

function endOfDay(date: Date) {
  date.setHours(23, 59, 59, 999);
  return date;
}

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isInRange(date: Date | string, from: Date, to: Date) {
  const value = new Date(date).getTime();
  return value >= from.getTime() && value <= to.getTime();
}

function normalizeSearch(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function toDateInputValue(date: Date | string) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
