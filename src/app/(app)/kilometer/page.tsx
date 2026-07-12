import {
  archiveCar,
  createCar,
  deleteFuelEntry,
  exportFuelToSynologyExcel,
  importFuelFromSynologyExcel,
  importFuelFromUploadedXlsx,
  unarchiveCar,
  updateCar,
  updateFuelExpenseSettings,
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
import { getExpenseLabels, getFuelEntriesForCar, getFuelExpenseSettings, getVisibleCars, getVisibleCategories } from "@/lib/queries";
import { ActionModal } from "@/components/action-modal";
import { Search } from "lucide-react";
import { AutosaveForm } from "@/components/autosave-form";
import { ExcelProgressPanel } from "@/components/excel-progress-panel";
import { PeriodNavLink } from "@/components/period-nav-link";
import { SearchableSelect } from "@/components/searchable-select";
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
  const [activeCars, allCars, categories, labels, fuelExpenseSettings] = await Promise.all([
    getVisibleCars(session.family.id),
    getVisibleCars(session.family.id, { includeArchived: true }),
    getVisibleCategories(session.family.id, session.user.id, "EXPENSE"),
    getExpenseLabels(session.family.id, session.user.id),
    getFuelExpenseSettings(session.family.id, session.user.id)
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
      <PageHeader title="Auto" description="Tankstopps, Verbrauch und Kilometerstände pro Auto." />

      <details className="compact-search page-search" open={Boolean(query)}>
        <summary aria-label="Tankstopps durchsuchen" title="Suchen"><Search aria-hidden="true" size={19} /></summary>
        <form className="search-bar">
          <MileageHiddenFields params={params} includeCar includePeriod />
          <label>
            <span>Tankstopps durchsuchen</span>
            <input name="q" type="search" defaultValue={params.q ?? ""} placeholder="Bemerkung oder Kilometerstand ..." autoFocus={Boolean(query)} />
          </label>
          <button className="button secondary" type="submit">Suchen</button>
          {query ? <a className="button secondary" href={getMileageHref(params, { q: undefined })}>Suche schließen</a> : null}
        </form>
      </details>

      <section className="filter-system" aria-label="Kilometerfilter">
        {selectedCar ? (
          <>
            <div className="period-navigator mileage-navigator">
              <MileagePeriodNavigator params={params} range={range} currentMonthKey={currentMonthKey} />
              <div className="period-tools mileage-period-tools">
                <PeriodNavLink className="button period-primary-action" href={getMileageHref(params, { month: currentMonthKey, year: undefined, from: undefined, to: undefined })}>Aktuell</PeriodNavLink>
                <ActionModal title="Kilometer filtern" trigger="Filter" modalId="kilometer-filter" triggerClassName="button period-primary-action">
                  <MileageFilterForm
                    params={params}
                    selectedMonth={selectedMonth}
                    filterYear={filterYear}
                    years={years}
                    monthOptions={monthOptions}
                  />
                </ActionModal>
                <CarPicker cars={activeCars} selectedCarId={selectedCar.id} params={params} />
                <ActionModal title="Kilometer-Setup" trigger="Setup" modalId="kilometer-setup" triggerClassName="button secondary mileage-setup-action" wide>
                  <MileageSetupPanel
                    selectedCar={selectedCar}
                    activeCars={activeCars}
                    allCars={allCars}
                    categories={categories}
                    labels={labels}
                    fuelExpenseSettings={fuelExpenseSettings}
                    isAdmin={isAdmin}
                  />
                </ActionModal>
              </div>
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
        ) : (
          <div className="overview-actions secondary-filter-actions mileage-secondary-actions">
            <ActionModal title="Kilometer-Setup" trigger="Setup" modalId="kilometer-setup" wide>
              <MileageSetupPanel
                selectedCar={selectedCar}
                activeCars={activeCars}
                allCars={allCars}
                categories={categories}
                labels={labels}
                fuelExpenseSettings={fuelExpenseSettings}
                isAdmin={isAdmin}
              />
            </ActionModal>
          </div>
        )}
      </section>

      {!selectedCar ? (
        <EmptyState>Noch kein aktives Auto vorhanden. Admins können im Setup ein Auto anlegen oder eine Verbrauchsdatei importieren.</EmptyState>
      ) : (
        <>
          <section className="stats">
            <div className="stat"><span>Tankkosten</span><strong>{formatMoney(stats.totalCostCents)}</strong></div>
            <div className="stat"><span>Liter</span><strong>{formatLiters(stats.totalLitersMilli)} l</strong></div>
            <div className="stat"><span>Gefahrene km</span><strong>{formatKilometers(stats.drivenKm)} km</strong><small>Letzter Stand {formatKilometers(allTimeStats.lastOdometerKm)} km</small></div>
            <div className="stat"><span>Ø l/100 km</span><strong>{formatDecimal(stats.averageLitersPer100Km)} l</strong><small>Ø {formatMoney(Math.round(stats.averagePricePerLiterCents ?? 0))}/l</small></div>
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
                        <ActionModal title="Tankstopp bearbeiten" trigger="Bearbeiten" modalId={`fuel-entry-${entry.id}`}>
                          <AutosaveForm action={updateFuelEntry} className="form form-grid modal-form">
                            <input type="hidden" name="id" value={entry.id} />
                            <input type="hidden" name="carId" value={selectedCar.id} />
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <label>Datum<input name="date" type="date" defaultValue={toDateInputValue(entry.date)} required /></label>
                            <label>Kilometerstand<input name="odometerKm" type="number" inputMode="numeric" min="0" defaultValue={entry.odometerKm} required /></label>
                            <label>Liter<input name="liters" inputMode="decimal" defaultValue={formatLitersInput(entry.litersMilli)} required /></label>
                            <label>Betrag in EUR<input name="cost" inputMode="decimal" defaultValue={formatEuroInputFromCents(entry.costCents)} required /></label>
                            <label className="full-span">Bemerkung<input name="note" defaultValue={entry.note} /></label>
                            <button className="button full-span autosave-submit" type="submit">Speichern</button>
                          </AutosaveForm>
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

function MileageHiddenFields({
  params,
  includeCar = false,
  includePeriod = false,
  includeSearch = false
}: {
  params: MileagePageParams;
  includeCar?: boolean;
  includePeriod?: boolean;
  includeSearch?: boolean;
}) {
  return (
    <>
      {includeCar && params.car ? <input type="hidden" name="car" value={params.car} /> : null}
      {includePeriod && params.year ? <input type="hidden" name="year" value={params.year} /> : null}
      {includePeriod && params.month ? <input type="hidden" name="month" value={params.month} /> : null}
      {includePeriod && params.from ? <input type="hidden" name="from" value={params.from} /> : null}
      {includePeriod && params.to ? <input type="hidden" name="to" value={params.to} /> : null}
      {includeSearch && params.q ? <input type="hidden" name="q" value={params.q} /> : null}
    </>
  );
}

function MileagePeriodNavigator({
  params,
  range,
  currentMonthKey
}: {
  params: MileagePageParams;
  range: ReturnType<typeof getRange>;
  currentMonthKey: string;
}) {
  const currentYear = range.mode === "year" ? range.from.getFullYear() : Number((range.mode === "month" ? range.key : currentMonthKey).slice(0, 4));
  const monthKey = range.mode === "month" ? range.key : `${currentYear}-${currentMonthKey.slice(5)}`;
  const isYear = range.mode === "year";
  const previousHref = isYear ? buildMileageYearNavigationHref(params, currentYear, -1) : buildMileageMonthNavigationHref(params, monthKey, -1);
  const nextHref = isYear ? buildMileageYearNavigationHref(params, currentYear, 1) : buildMileageMonthNavigationHref(params, monthKey, 1);
  const title = isYear ? String(currentYear) : range.mode === "custom" ? "Freier Zeitraum" : formatMonthKeyLabel(monthKey);
  const detail = isYear ? "Jahresansicht" : range.mode === "custom" ? `${formatDate(range.from)} bis ${formatDate(range.to)}` : "Monatsansicht";

  return (
    <div className="period-nav-main">
      <PeriodNavLink className="period-nav-button" href={previousHref} aria-label={isYear ? "Vorheriges Jahr" : "Vorheriger Monat"} title={isYear ? "Vorheriges Jahr" : "Vorheriger Monat"}>
        <span aria-hidden="true">&lsaquo;</span>
      </PeriodNavLink>
      <div className="period-nav-current" aria-live="polite">
        <span>{detail}</span>
        <strong>{title}</strong>
      </div>
      <PeriodNavLink className="period-nav-button" href={nextHref} aria-label={isYear ? "Nächstes Jahr" : "Nächster Monat"} title={isYear ? "Nächstes Jahr" : "Nächster Monat"}>
        <span aria-hidden="true">&rsaquo;</span>
      </PeriodNavLink>
      <div className="period-mode-toggle" role="list" aria-label="Zeitraum-Modus">
        <PeriodNavLink role="listitem" className={!isYear && range.mode !== "custom" ? "active" : ""} href={getMileageHref(params, { month: monthKey, year: undefined, from: undefined, to: undefined })}>Monat</PeriodNavLink>
        <PeriodNavLink role="listitem" className={isYear ? "active" : ""} href={getMileageHref(params, { year: String(currentYear), month: undefined, from: undefined, to: undefined })}>Jahr</PeriodNavLink>
      </div>
    </div>
  );
}

function CarPicker({
  cars,
  selectedCarId,
  params
}: {
  cars: Awaited<ReturnType<typeof getVisibleCars>>;
  selectedCarId: string;
  params: MileagePageParams;
}) {
  if (cars.length <= 1) {
    return (
      <span className="button secondary mileage-car-static" aria-label="Ausgewähltes Auto">
        {cars[0]?.name ?? "Kein Auto"}
      </span>
    );
  }

  return (
    <ActionModal title="Auto auswählen" trigger={cars.find((car) => car.id === selectedCarId)?.name ?? "Auto"} triggerLabel="Auto auswählen" modalId="kilometer-auto" triggerClassName="button secondary mileage-car-trigger">
      <div className="mileage-car-menu" role="list" aria-label="Autos">
        {cars.map((car) => (
          <a role="listitem" className={selectedCarId === car.id ? "active" : ""} href={getMileageHref(params, { car: car.id })} key={car.id}>
            <span className="color-dot" style={{ background: car.color }} />
            <span>
              <strong>{car.name}</strong>
              {car.licensePlate ? <small>{car.licensePlate}</small> : null}
            </span>
          </a>
        ))}
      </div>
    </ActionModal>
  );
}

function MileageFilterForm({
  params,
  selectedMonth,
  filterYear,
  years,
  monthOptions
}: {
  params: MileagePageParams;
  selectedMonth: ReturnType<typeof splitMonthKey> | null;
  filterYear: string;
  years: number[];
  monthOptions: ReturnType<typeof buildMonthSelectOptions>;
}) {
  return (
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
  );
}

function MileageSetupPanel({
  selectedCar,
  activeCars,
  allCars,
  categories,
  labels,
  fuelExpenseSettings,
  isAdmin
}: {
  selectedCar: Awaited<ReturnType<typeof getVisibleCars>>[number] | null;
  activeCars: Awaited<ReturnType<typeof getVisibleCars>>;
  allCars: Awaited<ReturnType<typeof getVisibleCars>>;
  categories: Awaited<ReturnType<typeof getVisibleCategories>>;
  labels: Awaited<ReturnType<typeof getExpenseLabels>>;
  fuelExpenseSettings: Awaited<ReturnType<typeof getFuelExpenseSettings>>;
  isAdmin: boolean;
}) {
  return (
    <div className="expense-setup-layout">
      {selectedCar ? (
        <section className="setup-card setup-card-primary">
          <div className="setup-card-head">
            <div>
              <h2 className="section-title">Excel-Sicherung</h2>
              <p className="muted">Export und Import über die komplette Historie.</p>
            </div>
          </div>
          <ExcelProgressPanel>
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
                  <button className="button secondary" formAction="/api/mileage/export" formMethod="get" formNoValidate type="submit" data-excel-progress="Verbrauchsdatei wird vorbereitet ...">
                    Excel herunterladen
                  </button>
                </div>
                <div className="upload-form">
                  <strong>Excel hochladen</strong>
                  <input name="xlsxFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
                  <button className="button secondary" type="submit" data-excel-progress="Verbrauchsdatei wird importiert ...">Excel hochladen</button>
                </div>
                <div className="mileage-excel-form">
                  <strong>Synology importieren</strong>
                  <button className="button secondary" formAction={importFuelFromSynologyExcel} formNoValidate type="submit" data-excel-progress="Synology-Import läuft ...">
                    Synology importieren
                  </button>
                </div>
                <div className="mileage-excel-form">
                  <strong>Synology exportieren</strong>
                  <button className="button secondary" formAction={exportFuelToSynologyExcel} formNoValidate type="submit" data-excel-progress="Synology-Export läuft ...">
                    Synology exportieren
                  </button>
                </div>
              </div>
            </form>
          </ExcelProgressPanel>
        </section>
      ) : null}

      <details className="setup-card" open>
        <summary>
          <span>
            <strong>Ausgabenbuchung</strong>
            <small>Vorgaben für Tankstopps aus dem Plus-Menü</small>
          </span>
        </summary>
        <AutosaveForm action={updateFuelExpenseSettings} className="form form-grid modal-form">
          <label className="checkbox-field full-span">
            <input name="autoCreateExpense" type="checkbox" defaultChecked={fuelExpenseSettings?.autoCreateExpense ?? false} />
            Tankstopps automatisch als Ausgabe vorbereiten
          </label>
          <SearchableSelect name="defaultCategoryId" label="Kategorie" options={categories} defaultValue={fuelExpenseSettings?.defaultCategoryId} emptyLabel="Keine Kategorie" placeholder="Kategorie suchen oder auswählen" />
          <SearchableSelect name="defaultLabelId" label="Label / Projekt" options={labels} defaultValue={fuelExpenseSettings?.defaultLabelId} emptyLabel="Kein Label" placeholder="Label suchen oder auswählen" />
          <label>Bezahlart<input name="defaultPaymentMethod" defaultValue={fuelExpenseSettings?.defaultPaymentMethod ?? ""} placeholder="Optional" /></label>
          <label>Laden<input name="defaultStore" defaultValue={fuelExpenseSettings?.defaultStore ?? ""} placeholder="Optional" /></label>
          <label className="full-span">Beschreibung<input name="defaultDescription" defaultValue={fuelExpenseSettings?.defaultDescription ?? ""} placeholder="Pflicht, wenn automatisch gebucht werden soll" /></label>
          <button className="button secondary full-span autosave-submit" type="submit">Ausgabenbuchung speichern</button>
        </AutosaveForm>
      </details>

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
                  <AutosaveForm action={updateCar} className="form compact">
                    <input type="hidden" name="id" value={car.id} />
                    <label>Name<input name="name" defaultValue={car.name} required /></label>
                    <label>Kennzeichen<input name="licensePlate" defaultValue={car.licensePlate} /></label>
                    <label>Farbe<input name="color" type="color" defaultValue={car.color} /></label>
                    <label>Notizen<textarea name="notes" defaultValue={car.notes} /></label>
                    <button className="button secondary autosave-submit" type="submit">Speichern</button>
                  </AutosaveForm>
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

function buildMileageMonthNavigationHref(params: MileagePageParams, monthKey: string, delta: number) {
  const parts = splitMonthKey(monthKey) ?? splitMonthKey(getMonthKey())!;
  const date = new Date(parts.year, Number(parts.month) - 1 + delta, 1);
  return getMileageHref(params, {
    month: getMonthKey(date),
    year: undefined,
    from: undefined,
    to: undefined
  });
}

function buildMileageYearNavigationHref(params: MileagePageParams, year: number, delta: number) {
  return getMileageHref(params, {
    year: String(year + delta),
    month: undefined,
    from: undefined,
    to: undefined
  });
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
